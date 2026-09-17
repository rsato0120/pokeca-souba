import type { PriceRecord, PriceSource } from '../types/pokeca'

/** Once a market has been selected, an outage must not switch the price basis. */
export function canUsePriceSource(previous: PriceSource | undefined, next: PriceSource): boolean {
  return previous == null || previous === next
}

/** Newest-first records from the current uninterrupted, known market only. */
export function currentPriceSeries(records: PriceRecord[]): PriceRecord[] {
  const source = records[0]?.source
  if (!source) return records.slice(0, 1)
  const end = records.findIndex(r => r.source !== source)
  return end < 0 ? records : records.slice(0, end)
}

export function priceSeriesKey(records: PriceRecord[]): string | undefined {
  const series = currentPriceSeries(records)
  // A rolling history dropping its oldest same-market day is not a new series.
  const boundary = series.length < records.length ? series[series.length - 1]?.date : 'continuous'
  return series[0]?.source ? `${series[0].source}:${boundary}` : undefined
}
