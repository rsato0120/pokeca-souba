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

/**
 * 暦日で指定した範囲にある観測だけを比較する値動き。
 *
 * 履歴配列の「ひとつ前」は前日とは限らない。取得が止まったカードを何日も前の価格と
 * 比較すると、古い成約を今日の急騰・急落としてランキングに混ぜてしまう。
 * スニダン由来は少数成約だけの価格も弾けるよう、必要件数を呼び出し側で指定できる。
 */
export function priceChangePctForDays(
  records: PriceRecord[],
  minDays: number,
  maxDays: number,
  limit: number,
  minSnkrdunkSamples = 0,
): number | null {
  const latest = records[0]
  if (!latest || !/^\d{4}-\d{2}-\d{2}$/.test(latest.date)) return null
  const latestMs = Date.parse(`${latest.date}T00:00:00Z`)
  const index = records.findIndex((record, i) => {
    if (i === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return false
    const days = Math.round((latestMs - Date.parse(`${record.date}T00:00:00Z`)) / 86400000)
    return days >= minDays && days <= maxDays
  })
  if (index < 0) return null

  const compared = records.slice(0, index + 1)
  // 長期間にわたる成約を平均した値は、取得日が今日でも「今日の相場」ではない。
  // その値を直近の値動きに混ぜると、古い成約の混入だけで急騰・急落に見えてしまう。
  if (compared.some(record => (record.oldest_sale_days ?? 0) > 30)) return null
  if (minSnkrdunkSamples > 0 && compared.some(record =>
    record.source === 'snkrdunk' && (record.sample_count ?? 0) < minSnkrdunkSamples,
  )) return null

  return priceChangePct(records, index, limit)
}
