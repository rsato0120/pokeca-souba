import { priceChangePctForDays } from './price-change'
import type { PriceRecord } from '../types/pokeca'

/** Recent observations only; missing days and market switches must not create signals. */
export function buyMovement(history: PriceRecord[], asOf: string) {
  const latest = history[0]
  const age = latest ? (Date.parse(asOf) - Date.parse(latest.date)) / 86400000 : NaN
  const reasons: string[] = []
  let score = 0
  if (!Number.isFinite(age) || age < 0 || age > 2) return { score, reasons }

  const day = priceChangePctForDays(history, 1, 2, 20, 6)
  const week = priceChangePctForDays(history, 6, 8, 35, 6)
  if (day != null && day >= 2) {
    score += Math.min(day, 10)
    reasons.push(`直近の価格上昇 +${day.toFixed(1)}%`)
    if (week != null && week < 0) {
      score += 8
      reasons.push('週間下落から反発')
    }
  }
  if (week != null && week <= -2 && week > -20) {
    score += Math.min(-week, 10)
    reasons.push(`直近1週間の押し目 ${week.toFixed(1)}%`)
  }

  const previous = history.find((r, i) => {
    const days = (Date.parse(latest.date) - Date.parse(r.date)) / 86400000
    return i > 0 && days >= 1 && days <= 2
  })
  if (previous && latest.on_sale_source && latest.on_sale_source === previous.on_sale_source
    && !latest.on_sale_capped && !previous.on_sale_capped
    && latest.on_sale != null && latest.on_sale >= 0 && previous.on_sale != null && previous.on_sale > 0) {
    const decline = (1 - latest.on_sale / previous.on_sale) * 100
    if (decline >= 5) {
      score += Math.min(decline, 20)
      reasons.push(`直近の出品数減少 ${decline.toFixed(1)}%`)
    }
  }
  return { score, reasons }
}
