import type { Card, Forecast, PriceRecord, PriceExtremes } from '@/types/pokeca'

// AI投資スコアと、予想の「根拠の内訳」。
//
// ⚠ **実データで裏が取れる項目だけ**を並べる。仕様に挙がっていた「海外需要」「検索量」は
//   このサイトに取得経路が無いので項目ごと作らない。無い数字に +14 と書くと、
//   根拠を見せるという機能そのものが嘘になる。取得経路を足した時にここへ1項目足せばよい。
//
// 材料の出どころ:
//   価格トレンド … 7日変化率（価格履歴）
//   在庫の減り   … on_sale の7日変化（打ち切り値は使わない）
//   PSA10需要    … psa10 / 素体 の倍率とその変化
//   希少性       … materials.common.scarcity
//   人気         … イラストレーター人気 + キャラ人気
//   流動性       … 直近の観測が詰まっているか（欠測が多い＝売買が薄い）
//   再販リスク   … materials.common.reprint_status（マイナス要因）

export interface ScoreFactor {
  key: string
  label: string
  /** 寄与点。プラス＝上昇要因、マイナス＝下落要因 */
  points: number
  /** 何を見たか（画面に出す） */
  detail: string
}

export interface CardScore {
  /** 0〜100 のAI投資スコア */
  total: number
  factors: ScoreFactor[]
  /** 横棒で出す内訳（0〜100） */
  bars: { label: string; value: number; detail: string }[]
  /** 評価できなかった項目 */
  missing: string[]
}

const DAY = 24 * 60 * 60 * 1000

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

/** 0〜100 に丸める */
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

export function computeCardScore(input: {
  card: Card
  forecast: Forecast | null
  /** 新しい順 */
  history: PriceRecord[]
  extremes: PriceExtremes | null
}): CardScore | null {
  const { card, forecast, history, extremes } = input
  if (history.length === 0) return null
  const today = history[0]
  const mid = midOf(today)
  if (!(mid > 0)) return null

  const factors: ScoreFactor[] = []
  const missing: string[] = []

  // ── 価格トレンド（7日） ──
  const weekAgo = history.find(r => Date.parse(today.date) - Date.parse(r.date) >= 7 * DAY)
  let trendScore = 50
  if (weekAgo && midOf(weekAgo) > 0) {
    const pct = ((mid - midOf(weekAgo)) / midOf(weekAgo)) * 100
    trendScore = clamp(50 + pct * 3)
    factors.push({
      key: 'trend', label: '価格トレンド',
      points: Math.round(pct * 1.5),
      detail: `7日で ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    })
  } else {
    missing.push('価格トレンド（7日前の観測なし）')
  }

  // ── 在庫（出品数の減り） ──
  const sale = history.filter(r => r.on_sale != null && r.on_sale_capped !== true)
  let supplyScore = 50
  if (sale.length >= 2) {
    const now = Number(sale[0].on_sale)
    const base = sale.find(r => Date.parse(sale[0].date) - Date.parse(r.date) >= 7 * DAY) ?? sale[sale.length - 1]
    const was = Number(base.on_sale)
    if (was > 0 && base.date !== sale[0].date) {
      const drop = ((was - now) / was) * 100   // 減少を正
      supplyScore = clamp(50 + drop * 1.2)
      factors.push({
        key: 'supply', label: '在庫の増減',
        points: Math.round(drop * 0.35),
        detail: `出品 ${was}件 → ${now}件`,
      })
    }
  } else {
    missing.push('在庫（出品数の観測が足りない）')
  }

  // ── PSA10需要 ──
  const psa = history.filter(r => r.psa10 != null && midOf(r) > 0)
  let psaScore = 50
  if (psa.length >= 1) {
    const ratio = Number(psa[0].psa10) / midOf(psa[0])
    // 倍率5倍前後が中庸。高いほど鑑定需要が強い
    psaScore = clamp(30 + (ratio - 2) * 8)
    let pts = Math.round((ratio - 5) * 2)
    let detail = `PSA10は素体の${ratio.toFixed(1)}倍`
    const old = psa[psa.length - 1]
    if (psa.length >= 2 && midOf(old) > 0) {
      const oldRatio = Number(old.psa10) / midOf(old)
      if (oldRatio > 0) {
        const chg = (ratio / oldRatio - 1) * 100
        pts += Math.round(chg * 0.2)
        detail += `（${chg >= 0 ? '+' : ''}${chg.toFixed(0)}%）`
      }
    }
    factors.push({ key: 'psa', label: 'PSA10需要', points: pts, detail })
  } else {
    missing.push('PSA10需要（鑑定品の価格なし）')
  }

  // ── 希少性 ──
  const scarcity = card.materials.common.scarcity
  const scarcityScore = scarcity === 'out_of_print' ? 90 : scarcity === 'scarce' ? 70 : 40
  factors.push({
    key: 'scarcity', label: '希少性',
    points: scarcity === 'out_of_print' ? 12 : scarcity === 'scarce' ? 6 : 0,
    detail: scarcity === 'out_of_print' ? '絶版' : scarcity === 'scarce' ? '品薄' : '通常流通',
  })

  // ── 人気（絵師 + キャラ） ──
  const pop = (v: string) => (v === 'high' ? 1 : v === 'mid' ? 0.5 : 0)
  const popRaw = pop(card.materials.collector.illustrator_popularity) + pop(card.materials.common.character_popularity)
  const popScore = clamp(30 + popRaw * 35)
  factors.push({
    key: 'pop', label: '人気',
    points: Math.round(popRaw * 7),
    detail: `絵師${card.materials.collector.illustrator_popularity === 'high' ? '高' : card.materials.collector.illustrator_popularity === 'mid' ? '中' : '—'} / キャラ${card.materials.common.character_popularity === 'high' ? '高' : card.materials.common.character_popularity === 'mid' ? '中' : '—'}`,
  })

  // ── 流動性（観測の詰まり具合）──
  // 直近30日で何日ぶんの観測があるか。欠測が多い＝成約が薄く売り買いしにくい
  const cutoff = Date.parse(today.date) - 30 * DAY
  const obs = history.filter(r => Date.parse(r.date) >= cutoff).length
  const liquidityScore = clamp((obs / 30) * 100)
  factors.push({
    key: 'liquidity', label: '流動性',
    points: obs >= 24 ? 5 : obs >= 15 ? 0 : -7,
    detail: `直近30日で${obs}日ぶんの取引を観測`,
  })

  // ── 再販リスク（マイナス要因）──
  const reprint = card.materials.common.reprint_status
  if (reprint !== 'none') {
    factors.push({
      key: 'reprint', label: '再販リスク',
      points: reprint === 'reprint_planned' ? -12 : -6,
      detail: reprint === 'reprint_planned' ? '再録の予定あり' : '再録済み',
    })
  }

  // ── 値幅の中の位置（高値掴みの警戒）──
  let positionScore = 50
  if (extremes && extremes.records >= 7 && extremes.high.value > extremes.low.value) {
    const p = (mid - extremes.low.value) / (extremes.high.value - extremes.low.value)
    positionScore = clamp((1 - p) * 100)
    factors.push({
      key: 'position', label: '値幅の位置',
      points: Math.round((0.5 - p) * 20),
      detail: p <= 0.35 ? '全期間の安値圏' : p >= 0.75 ? '全期間の高値圏' : '値幅の中ほど',
    })
  }

  // AIの見立ても点として乗せる（予想が無ければ乗せない）
  if (forecast) {
    const net = forecast.overall.up_pct - forecast.overall.down_pct
    factors.push({
      key: 'ai', label: 'AIの見立て',
      points: Math.round(net * 0.3),
      detail: `上昇${forecast.overall.up_pct}% / 下落${forecast.overall.down_pct}%`,
    })
  }

  // 合計は 50 を起点に寄与を足し込む
  const total = clamp(50 + factors.reduce((a, f) => a + f.points, 0))

  const bars = [
    { label: '価格', value: trendScore, detail: '直近7日の値動き' },
    { label: '人気', value: popScore, detail: '絵師人気とキャラ人気' },
    { label: '希少性', value: scarcityScore, detail: '絶版・品薄の度合い' },
    { label: 'PSA需要', value: psaScore, detail: '鑑定品と素体の価格差' },
    { label: '在庫', value: supplyScore, detail: '出品数の増減' },
    { label: '流動性', value: liquidityScore, detail: '取引を観測できた日数' },
  ]

  return { total, factors: factors.sort((a, b) => b.points - a.points), bars, missing }
}
