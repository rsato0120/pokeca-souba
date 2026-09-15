import type { PriceExtremes, PriceRecord } from '../types/pokeca'

/** PSA10平均相場の極値。素体の価格・出所・取引件数は使わない。 */
export function computeObservedExtremes(
  history: PriceRecord[],
  archived: PriceExtremes | null = null,
  valueOf: (record: PriceRecord) => number | null | undefined = r => r.psa10,
): PriceExtremes | null {
  let result = archived
  const dates = new Set<string>()
  for (const record of [...history].sort((a, b) => a.date.localeCompare(b.date))) {
    const value = valueOf(record)
    if (value == null || !Number.isFinite(value) || value <= 0 || dates.has(record.date)) continue
    // archived は保存窓から外れた日だけ。重複取り込みを防ぐ。
    if (archived && record.date <= archived.updated_at) continue
    dates.add(record.date)
    const point = { value, date: record.date, source: 'snkrdunk' as const }
    result = result ? {
      high: value > result.high.value ? point : result.high,
      low: value < result.low.value ? point : result.low,
      since: result.since,
      records: result.records + 1,
      updated_at: record.date,
    } : { high: point, low: point, since: record.date, records: 1, updated_at: record.date }
  }
  return result
}

export function computePsa10Extremes(history: PriceRecord[], archived: PriceExtremes | null = null): PriceExtremes | null {
  return computeObservedExtremes(history, archived, r => r.psa10)
}
