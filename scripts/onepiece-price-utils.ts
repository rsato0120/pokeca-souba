import type { PriceRecord } from '../src/types/pokeca'
import { parseSnkrdunkSaleDate } from './snkrdunk-sales'

export interface Sale { date: string; price: number }

/**
 * APIで今回取り直せた期間は、保存済みの件数を日付ごと置き換える。
 * 相対日付（「1日前」など）は後日絶対日付に確定するため、足し込み・部分更新だと
 * 仮の日付に付いた件数が残る。取引が0件の日も含めて範囲を消してから再集計する。
 */
export function replaceOnePieceSalesCounts(
  previous: Record<string, number> | undefined,
  sales: Sale[],
  replaceFrom: string,
  through: string,
): Record<string, number> {
  const counts = Object.fromEntries(Object.entries(previous ?? {})
    .filter(([date]) => date < replaceFrom || date > through))
  for (const sale of sales) {
    if (sale.date < replaceFrom || sale.date > through) continue
    counts[sale.date] = (counts[sale.date] ?? 0) + 1
  }
  return counts
}

export function parseOnePieceSale(
  row: { date: string; price: number; condition?: string; size?: string },
  kind: 'card' | 'box' | 'psa10', now: number,
): Sale | null {
  const date = parseSnkrdunkSaleDate(row.date, now)
  if (!date || !Number.isFinite(row.price) || row.price <= 0) return null
  if (Date.parse(date) > now + 9 * 3600000) return null
  if (kind === 'psa10') {
    if (row.condition?.replace(/\s/g, '') !== 'PSA10' || row.size) return null
    return { date, price: row.price }
  }
  if (kind === 'card') {
    // Exact product ID separates parallels; condition A separates damaged/graded cards.
    if (row.condition !== 'A' || row.size) return null
    return { date, price: row.price }
  }
  // BOX totals must be divided by the actual lot size. Unknown labels are not one box.
  const match = /^(\d+)個$/.exec(row.size ?? '')
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 100) return null
  return { date, price: Math.round(row.price / Number(match[1])) }
}

export function buildOnePieceHistory(sales: Sale[]): PriceRecord[] {
  const days = [...new Set(sales.map(s => s.date))].sort().reverse()
  return days.flatMap(date => {
    const cutoff = Date.parse(date) - 29 * 86400000
    const grouped = new Map<string, number[]>()
    for (const sale of sales) {
      if (sale.date > date || Date.parse(sale.date) < cutoff) continue
      grouped.set(sale.date, [...(grouped.get(sale.date) ?? []), sale.price])
    }
    const prices: number[] = []
    for (const day of [...grouped.keys()].sort().reverse()) {
      prices.push(...grouped.get(day)!)
      if (prices.length >= 20) break
    }
    if (prices.length < 3) return []
    const sorted = prices.sort((a, b) => a - b)
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    return [{ date, avg, low: Math.min(avg, sorted[Math.floor((sorted.length - 1) * .2)]),
      high: Math.max(avg, sorted[Math.ceil((sorted.length - 1) * .8)]), source: 'snkrdunk' as const,
      sample_count: prices.length }]
  })
}
