import type { PriceRecord, PriceSource } from '../types/pokeca'

/** Once a market has been selected, an outage must not switch the price basis. */
export function canUsePriceSource(previous: PriceSource | undefined, next: PriceSource): boolean {
  return previous == null || previous === next
}

/** Mercari is allowed only when the product is absent from Snkrdunk. */
export function canFetchMercariPrice(apparelId: number | null, previous?: PriceSource, snkrdunkOnly = false): boolean {
  return apparelId == null && !snkrdunkOnly && canUsePriceSource(previous, 'mercari')
}

/** Keep every observation visible; separate changes in market or sampling basis. */
export function priceHistorySegments(records: PriceRecord[]): PriceRecord[][] {
  const segments: PriceRecord[][] = []
  for (const record of [...records].reverse()) {
    const segment = segments.at(-1)
    const previous = segment?.at(-1)
    if (!previous || previous.source !== record.source
      || isComparablePriceRecord(previous) !== isComparablePriceRecord(record)) {
      segments.push([record])
    } else {
      segment!.push(record)
    }
  }
  return segments
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
