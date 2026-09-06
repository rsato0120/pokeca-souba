import type { OnePiecePrices, OnePieceProduct } from '@/types/onepiece'

export type OnePieceRankingRow = OnePieceProduct & {
  avg: number; date: string; sales7d: number; day: number | null; week: number | null
}

const dayMs = 86400000
export function buildOnePieceRanking(products: OnePieceProduct[], observations: Record<string, OnePiecePrices | null>) {
  const fetchedAt = Object.values(observations).map(p => p?.fetched_at ?? '').filter(d => Number.isFinite(Date.parse(d))).sort().at(-1) ?? null
  const fetchedDate = fetchedAt ? new Date(Date.parse(fetchedAt) + 9 * 3600000).toISOString().slice(0, 10) : null
  // 取得日にはまだ成約がない場合があるため、実際の最新価格日を共通基準にする。
  const baseDate = fetchedDate ? Object.values(observations).flatMap(p => p?.history ?? [])
    .map(r => r.date).filter(date => date <= fetchedDate && Date.parse(date) >= Date.parse(fetchedDate) - 30 * dayMs).sort().at(-1) ?? null : null
  if (!baseDate) return { baseDate, fetchedAt, rows: [] as OnePieceRankingRow[] }
  const offsetDate = (days: number) => new Date(Date.parse(baseDate) - days * dayMs).toISOString().slice(0, 10)
  const rows = products.flatMap(product => {
    const data = observations[product.id]
    const latest = data?.history.filter(r => r.date <= baseDate).sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!data || !latest || !Number.isFinite(latest.avg) || !(latest.avg! > 0)
      || Date.parse(latest.date) < Date.parse(fetchedDate!) - 30 * dayMs) return []
    const avg = latest.avg!
    const change = (days: number) => {
      // 隣り合う配列要素は必ずしも前日ではない。欠測日の前日比を作らない。
      const previous = data.history.find(r => r.date === offsetDate(days))
      return latest.date === baseDate && previous?.avg && Number.isFinite(previous.avg) && previous.avg > 0
        ? (avg / previous.avg - 1) * 100 : null
    }
    const sales7d = Object.entries(data.sales_by_day ?? {}).reduce((sum, [date, count]) =>
      date >= offsetDate(6) && date <= baseDate && Number.isFinite(count) && count > 0 ? sum + count : sum, 0)
    return [{ ...product, avg, date: latest.date, sales7d, day: change(1), week: change(7) }]
  })
  return { baseDate, fetchedAt, rows }
}
