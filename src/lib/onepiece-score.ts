import type { CardScore, ScoreFactor } from './score'
import type { Forecast, PriceRecord } from '@/types/pokeca'
import type { OnePiecePrices } from '@/types/onepiece'
import { onePieceRawExtremes } from './onepiece-market'

const DAY = 86400000
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const mid = (record: PriceRecord) => record.avg ?? (record.low + record.high) / 2

/** ONE PIECE向けAI投資スコア。取得できている実成約・PSA10・AI予想だけを使う。 */
export function computeOnePieceScore(prices: OnePiecePrices | null, forecast: Forecast | null): CardScore | null {
  const history = prices?.history ?? []
  const latest = history[0]
  if (!latest || !(mid(latest) > 0)) return null

  const factors: ScoreFactor[] = []
  const missing: string[] = []
  const current = mid(latest)

  const weekAgo = history.find(r => Date.parse(latest.date) - Date.parse(r.date) >= 7 * DAY)
  let trend = 50
  if (weekAgo && mid(weekAgo) > 0) {
    const change = (current / mid(weekAgo) - 1) * 100
    trend = clamp(50 + change * 3)
    factors.push({ key: 'trend', label: '価格トレンド', points: Math.round(change * 1.5), detail: `7日で ${change >= 0 ? '+' : ''}${change.toFixed(1)}%` })
  } else missing.push('価格トレンド（7日前の観測なし）')

  const psaLatest = prices?.psa10_history?.find(r => (r.psa10 ?? r.avg ?? 0) > 0)
  let psa = 50
  if (psaLatest) {
    const psaPrice = psaLatest.psa10 ?? psaLatest.avg ?? 0
    const ratio = psaPrice / current
    psa = clamp(35 + (ratio - 1) * 25)
    factors.push({ key: 'psa', label: 'PSA10需要', points: Math.round((ratio - 1.5) * 8), detail: `PSA10は素体の${ratio.toFixed(1)}倍` })
  } else missing.push('PSA10需要（鑑定品の価格なし）')

  const cutoff = Date.parse(latest.date) - 30 * DAY
  const observations = history.filter(r => Date.parse(r.date) >= cutoff).length
  const liquidity = clamp(observations / 30 * 100)
  factors.push({ key: 'liquidity', label: '流動性', points: observations >= 20 ? 6 : observations >= 10 ? 0 : -6, detail: `直近30日で${observations}日ぶんの相場を観測` })

  const extremes = onePieceRawExtremes(prices)
  let value = 50
  if (extremes && extremes.high.value > extremes.low.value) {
    const position = Math.max(0, Math.min(1, (current - extremes.low.value) / (extremes.high.value - extremes.low.value)))
    value = clamp((1 - position) * 100)
    factors.push({ key: 'position', label: '値幅の位置', points: Math.round((0.5 - position) * 20), detail: position <= .35 ? '全期間の安値圏' : position >= .75 ? '全期間の高値圏' : '値幅の中ほど' })
  } else missing.push('値幅の位置（履歴不足）')

  let outlook = 50
  if (forecast) {
    const net = forecast.overall.up_pct - forecast.overall.down_pct
    outlook = clamp(50 + net)
    factors.push({ key: 'ai', label: 'AIの見立て', points: Math.round(net * .3), detail: `上昇${forecast.overall.up_pct}% / 下落${forecast.overall.down_pct}%` })
  } else missing.push('AIの見立て（予想未生成）')

  const total = clamp(50 + factors.reduce((sum, factor) => sum + factor.points, 0))
  return {
    total,
    factors: factors.sort((a, b) => b.points - a.points),
    bars: [
      { label: '価格', value: trend, detail: '直近7日の値動き' },
      { label: 'PSA需要', value: psa, detail: 'PSA10と素体の価格差' },
      { label: '流動性', value: liquidity, detail: '直近30日の観測日数' },
      { label: '割安度', value, detail: '全期間の値幅の中での位置' },
      { label: 'AI見通し', value: outlook, detail: '上昇確率と下落確率の差' },
    ],
    missing,
  }
}
