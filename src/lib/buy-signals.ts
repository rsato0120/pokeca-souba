import type { Card, Forecast, PriceRecord, PriceExtremes } from '@/types/pokeca'

// 「AIが買うべきカード」候補の決定論的な選定。
// トップページ（表示）と scripts/generate-buy-theses.ts（AI論拠生成の対象選び）で
// 同じ基準を使うため、純粋関数としてここに集約する。データはすべて呼び出し側が注入する。

export interface BuyInput {
  card: Card
  slug: string
  forecast: Forecast | null
  history: PriceRecord[]        // 新しい順（desc）
  extremes: PriceExtremes | null
}

export interface BuyCandidate {
  card: Card
  slug: string
  mid: number                   // 現在の中央値相場
  score: number
  upsidePct: number             // AIの3ヶ月後 本線の上昇率(%)
  netUp: number                 // up_pct - down_pct
  pricePosition: number | null  // 全期間レンジ内の位置(0=最安,1=最高)。不明は null
  weekChange: number | null     // 7日変化率(%)
  factors: string[]             // 表示用の短い根拠ラベル（厚い論拠が無い時のフォールバック）
}

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

const SCARCITY_SCORE: Record<string, number> = { out_of_print: 2, scarce: 1, normal: 0 }
const POP_SCORE: Record<string, number> = { high: 1, mid: 0, unknown: 0 }

// 1枚を評価する。買い候補にならない（AIが上昇と見ていない/価格不明）場合は null。
export function scoreBuy(input: BuyInput): BuyCandidate | null {
  const { card, slug, forecast, history, extremes } = input
  if (!forecast) return null

  const pf = forecast.price_forecast
  const curMid = (pf.current_low + pf.current_high) / 2
  const m3Mid = (pf.m3_low + pf.m3_high) / 2
  if (!(curMid > 0)) return null

  const upsidePct = ((m3Mid - curMid) / curMid) * 100
  const netUp = forecast.overall.up_pct - forecast.overall.down_pct

  // 「買うべき」= AIが上昇方向 かつ 本線が現在より上（押し目でも上を見ている）
  if (netUp <= 0 || upsidePct <= 2) return null

  const today = history[0]
  const mid = today ? midOf(today) : curMid

  // 全期間レンジ内の位置（安いほど割安＝買い妙味）。記録が浅いと信頼できないので7日以上のみ。
  let pricePosition: number | null = null
  if (extremes && extremes.records >= 7 && extremes.high.value > extremes.low.value) {
    const raw = (mid - extremes.low.value) / (extremes.high.value - extremes.low.value)
    pricePosition = Math.max(0, Math.min(1, raw))
  }

  // 7日変化率（±35%超はノイズ扱いで無視）
  const weekAgo = history[7]
  let weekChange: number | null = null
  if (today && weekAgo) {
    const w = ((midOf(today) - midOf(weekAgo)) / midOf(weekAgo)) * 100
    weekChange = Math.abs(w) > 35 ? null : w
  }

  // 在庫トレンド（出品件数の前日比）。減少＝需要が捌けている＝買われている。
  const withSale = history.filter(r => r.on_sale != null)
  let supplyTightening = false
  if (withSale.length >= 2 && withSale[0].on_sale != null && withSale[1].on_sale != null) {
    supplyTightening = withSale[0].on_sale! < withSale[1].on_sale! * 0.95
  }

  const materialScore =
    (SCARCITY_SCORE[card.materials.common.scarcity] ?? 0) +
    (POP_SCORE[card.materials.collector.illustrator_popularity] ?? 0) +
    (POP_SCORE[card.materials.common.character_popularity] ?? 0)

  // 薄商いの割り引き（少数取引で決まった値は当てにならない）
  const thin = today?.source === 'snkrdunk' && (today.sample_count ?? 99) <= 2

  // 押し目ボーナス: 直近で少し下げている（-2〜-20%）＝安く拾えるタイミング
  const dipBonus = weekChange != null && weekChange < -2 && weekChange > -20 ? 8 : 0

  let score =
    upsidePct * 1.0 +
    netUp * 0.4 +
    (pricePosition != null ? (0.5 - pricePosition) * 40 : 0) +
    materialScore * 6 +
    (supplyTightening ? 10 : 0) +
    dipBonus
  if (thin) score -= 25

  // 表示用の短い根拠ラベル
  const factors: string[] = []
  factors.push(`AI上昇確率 ${forecast.overall.up_pct}%`)
  if (upsidePct >= 5) factors.push(`3ヶ月後 +${Math.round(upsidePct)}% 予想`)
  if (pricePosition != null && pricePosition <= 0.35) factors.push('相場レンジの下位（割安圏）')
  if (dipBonus > 0 && weekChange != null) factors.push(`直近 ${weekChange.toFixed(1)}% の押し目`)
  if (supplyTightening) factors.push('出品数が減少（在庫が捌けている）')
  if (card.materials.common.scarcity === 'out_of_print') factors.push('絶版（流通量が細い）')
  else if (card.materials.common.scarcity === 'scarce') factors.push('品薄')
  if (card.materials.collector.illustrator_popularity === 'high') factors.push('人気イラストレーター')
  if (card.materials.common.character_popularity === 'high') factors.push('キャラ人気が高い')

  return { card, slug, mid, score, upsidePct, netUp, pricePosition, weekChange, factors }
}

// 上位候補を選ぶ。1弾に偏らないよう弾あたり上限を設ける。
export function selectBuyCandidates(
  inputs: BuyInput[],
  limit = 6,
  maxPerBox = 2
): BuyCandidate[] {
  const scored = inputs
    .map(scoreBuy)
    .filter((c): c is BuyCandidate => c != null)
    .sort((a, b) => b.score - a.score)

  const picked: BuyCandidate[] = []
  const perBox: Record<string, number> = {}
  for (const c of scored) {
    if (picked.length >= limit) break
    const b = c.card.box_id
    if ((perBox[b] ?? 0) < maxPerBox) {
      picked.push(c)
      perBox[b] = (perBox[b] ?? 0) + 1
    }
  }
  // 弾上限で埋まらなければ上限無視で補完
  if (picked.length < limit) {
    for (const c of scored) {
      if (picked.length >= limit) break
      if (!picked.includes(c)) picked.push(c)
    }
  }
  return picked
}
