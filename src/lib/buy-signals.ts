import type { Card, Forecast, PriceRecord, PriceExtremes } from '@/types/pokeca'
import { isDeckUtilityCard } from '@/lib/card-kind'

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
  pricePosition: number | null  // 全期間の値幅の中の位置(0=最安,1=最高)。不明は null
  weekChange: number | null     // 7日変化率(%)
  factors: string[]             // 表示用の短い根拠ラベル（厚い論拠が無い時のフォールバック）
  /** 0〜100 の「AI高騰気配」。買い候補全体の中の順位（makeHeatScale で後から入れる） */
  heat: number
  /** 候補全体で上位何%か。画面に「候補◯枚中 上位◯%」と添えるのに使う */
  heatPercentile: number
  /** ✓ で並べる兆候。**実データで確認できたものだけ**を入れる */
  omens: string[]
  /** ⚠ で並べる注意点 */
  cautions: string[]
}

/**
 * 「AI高騰気配」を **買い候補全体の中の順位（パーセンタイル）** で出す関数を作る。
 *
 * ⚠ 以前は `40 + (score - 10) * 0.55` という一次変換だった（2026-08-29 に置換）。
 *   score 自体が「上昇率 + 確率 + 割安度 + 材料点」の重み付き和で単位を持たないため、
 *   それを線形に伸ばした 66 や 83 という数字に解釈が無かった。
 *   さらに看板（まだ上がっていないカード）は値動きの小さい銘柄に絞ってから採るので、
 *   モメンタム由来の点が乗らず常に60前後に固まり、看板だけ低く見えていた。
 *
 *   パーセンタイルなら「候補61枚中の上位◯%」と読める。分布（2026-08-29 実測）は
 *   最小-9.0 / 中央29.5 / p90 50.4 / 最大88.9 で、線形変換では中央が55前後に化けていた。
 *
 * 40〜99 に寝かせるのは据え置き。0点や100点は出さない（満点はモデルの確信を過大に見せる）。
 */
export function makeHeatScale(allScores: number[]): (score: number) => number {
  const sorted = [...allScores].sort((a, b) => a - b)
  return (score: number) => {
    if (sorted.length === 0) return 40
    // 自分以下の件数 / 全体 = パーセンタイル
    let below = 0
    while (below < sorted.length && sorted[below] < score) below++
    const pct = (below / sorted.length) * 100
    return Math.max(40, Math.min(99, Math.round(40 + pct * 0.59)))
  }
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
  if (isDeckUtilityCard(card)) return null

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

  // 全期間の値幅の中の位置（安いほど割安＝買い妙味）。記録が浅いと信頼できないので7日以上のみ。
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
  if (pricePosition != null && pricePosition <= 0.35) factors.push('値幅の下のほう（割安圏）')
  if (dipBonus > 0 && weekChange != null) factors.push(`直近 ${weekChange.toFixed(1)}% の押し目`)
  if (supplyTightening) factors.push('出品数が減少（在庫が捌けている）')
  if (card.materials.common.scarcity === 'out_of_print') factors.push('絶版（流通量が細い）')
  else if (card.materials.common.scarcity === 'scarce') factors.push('品薄')
  if (card.materials.collector.illustrator_popularity === 'high') factors.push('人気イラストレーター')
  if (card.materials.common.character_popularity === 'high') factors.push('キャラ人気が高い')

  // ── 兆候（✓）と注意（⚠） ──
  // ⚠ 実データで確認できたものだけを入れる。「海外需要上昇」「検索量増加」は
  //   このサイトに取得経路が無いので出さない（無い数字を兆候として並べない）。
  const omens: string[] = []
  if (supplyTightening) omens.push('出品数減少')
  // PSA10との価格差が開いている＝鑑定品が先に買われている
  const withPsa = history.filter(r => r.psa10 != null && midOf(r) > 0)
  if (withPsa.length >= 2) {
    const nowR = Number(withPsa[0].psa10) / midOf(withPsa[0])
    const oldR = Number(withPsa[withPsa.length - 1].psa10) / midOf(withPsa[withPsa.length - 1])
    if (oldR > 0 && nowR / oldR >= 1.12) omens.push('PSA10価格差拡大')
  }
  if (pricePosition != null && pricePosition <= 0.35) omens.push('値幅の下限圏')
  if (card.materials.common.scarcity === 'out_of_print') omens.push('絶版で流通が細い')
  if (dipBonus > 0) omens.push('直近の押し目')

  const cautions: string[] = []
  if (thin) cautions.push('取引が薄く価格が振れやすい')
  if (card.materials.common.reprint_status !== 'none') cautions.push('再販リスクあり')
  if (pricePosition != null && pricePosition >= 0.85) cautions.push('値幅の上限圏')

  return {
    card, slug, mid, score, upsidePct, netUp, pricePosition, weekChange, factors,
    // heat は候補全体が揃ってからでないと決まらない。ここでは仮値を入れ、
    // selectBuyCandidates で全候補のスコア分布から入れ直す。
    heat: 40, heatPercentile: 0, omens, cautions,
  }
}

// 上位候補を選ぶ。1弾に偏らないよう弾あたり上限を設ける。
export function selectBuyCandidates(
  inputs: BuyInput[],
  limit = 6,
  maxPerBox = 2,
  // ⚠ 「AI高騰気配」の物差し。**呼び出し側が全候補から作って渡す**こと。
  //   ここで inputs から作ると、絞り込んだ集合ごとに物差しが変わり、
  //   同じ 66 という数字が画面によって違う意味になる（看板は値動きの小さい銘柄だけを
  //   渡すので、その中の順位で出すと常に上位＝高い数字に化ける）。
  //   渡さなければ inputs 内の順位になる（単独で使う呼び出し向けのフォールバック）。
  heatScale?: (score: number) => number,
): BuyCandidate[] {
  const raw = inputs.map(scoreBuy).filter((c): c is BuyCandidate => c != null)
  const scale = heatScale ?? makeHeatScale(raw.map(c => c.score))
  const allSorted = [...raw].map(c => c.score).sort((a, b) => a - b)

  const scored = raw
    .map(c => {
      let below = 0
      while (below < allSorted.length && allSorted[below] < c.score) below++
      return {
        ...c,
        heat: scale(c.score),
        heatPercentile: allSorted.length ? Math.round((below / allSorted.length) * 100) : 0,
      }
    })
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
