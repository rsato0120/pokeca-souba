import type { PriceRecord } from '../types/pokeca'

export interface DisplayPriceRecord {
  date: string
  observedDate: string
  record: PriceRecord
}

/** Display only: carry the last observed price across missing days, never backfill sales. */
export function priceDisplayHistory(records: PriceRecord[], endDate: string, days = 90): DisplayPriceRecord[] {
  const end = Date.parse(endDate)
  if (!Number.isFinite(end)) return []
  const ordered = [...records].filter(r => Number.isFinite(Date.parse(r.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!ordered.length) return []
  const start = Math.max(Date.parse(ordered[0].date), end - days * 86400000)
  const result: DisplayPriceRecord[] = []
  let index = -1
  for (let time = start; time <= end; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10)
    while (index + 1 < ordered.length && ordered[index + 1].date <= date) index++
    if (index >= 0) result.push({ date, observedDate: ordered[index].date, record: ordered[index] })
  }
  return result
}
