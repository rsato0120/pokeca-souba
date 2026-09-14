import { midOf } from './extremes'
import type { PriceRecord } from '../types/pokeca'

/** 新しい順の履歴。同じ市場が連続する期間だけ値動きとして比較する。 */
export function priceChangePct(records: PriceRecord[], offset: number, limit: number): number | null {
  const latest = records[0]
  const previous = records[offset]
  if (!latest?.source || !previous || offset < 1) return null
  // 両端が同じでも、途中で市場が切り替わった週は比較しない。
  // 出所不明の旧データも同じ市場とはみなさない。
  if (records.slice(0, offset + 1).some((r) => r.source !== latest.source)) return null
  const current = midOf(latest)
  const baseline = midOf(previous)
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || current <= 0 || baseline <= 0) return null
  const change = ((current - baseline) / baseline) * 100
  return Math.abs(change) <= limit ? change : null
}
