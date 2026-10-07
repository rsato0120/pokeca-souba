import type { PriceRecord, PriceSource } from '../types/pokeca'

/** Once a market has been selected, an outage must not switch the price basis. */
export function canUsePriceSource(previous: PriceSource | undefined, next: PriceSource): boolean {
  return previous == null || previous === next
}

/** Do not compare broad historical Mercari samples with current trades. */
export function isComparablePriceRecord(record: PriceRecord): boolean {
  return (record.oldest_sale_days ?? 0) <= 30
}

/** Newest-first records from the current uninterrupted market and sampling basis. */
export function currentPriceSeries(records: PriceRecord[]): PriceRecord[] {
  const source = records[0]?.source
  if (!source || !isComparablePriceRecord(records[0])) return records.slice(0, 1)
  const end = records.findIndex(r => r.source !== source || !isComparablePriceRecord(r))
  return end < 0 ? records : records.slice(0, end)
}

export function priceSeriesKey(records: PriceRecord[]): string | undefined {
  const series = currentPriceSeries(records)
  // A rolling history dropping its oldest same-market day is not a new series.
  const boundary = series.length < records.length ? series[series.length - 1]?.date : 'continuous'
  const basis = series[0] && !isComparablePriceRecord(series[0]) ? 'historical' : 'recent'
  return series[0]?.source ? `${series[0].source}:${basis}:${boundary}` : undefined
}
