import fs from 'node:fs'
import path from 'node:path'
import type { Browser } from 'playwright'
import type { PriceHistory, PriceRecord } from '../src/types/pokeca'
import { getSnkrdunkSales, type SnkrdunkSales } from './snkrdunk-sales'

type Sale = { date: string; price: number }

function dailyRecords(sales: Sale[], today: string, psa = false): PriceRecord[] {
  const grouped = new Map<string, number[]>()
  for (const sale of sales) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sale.date) || sale.date > today || !Number.isFinite(Date.parse(sale.date)) || !Number.isFinite(sale.price) || sale.price <= 0) continue
    const prices = grouped.get(sale.date) ?? []
    prices.push(sale.price)
    grouped.set(sale.date, prices)
  }
  return [...grouped].map(([date, prices]) => {
    prices.sort((a, b) => a - b)
    const avg = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
    return psa
      ? { date, low: 0, high: 0, psa10: avg, psa10_as_of: date, source: 'snkrdunk' as const, sample_count: prices.length, price_basis: 'transaction_day' as const }
      : { date, low: prices[0], high: prices.at(-1)!, avg, source: 'snkrdunk' as const, sample_count: prices.length, oldest_sale_days: 0, price_basis: 'transaction_day' as const }
  }).sort((a, b) => b.date.localeCompare(a.date))
}

export function mergeVintageSales(previous: PriceHistory, api: SnkrdunkSales, today: string): PriceHistory {
  if (api.regularComplete === false || api.psa10Complete === false) throw new Error('成約APIの取得が未完了です。既存履歴を維持します')
  const merge = (old: PriceRecord[], next: PriceRecord[]) => {
    const records = new Map(old.map(r => [r.date, r]))
    for (const r of next) records.set(r.date, r)
    return [...records.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90)
  }
  const raw = dailyRecords(api.regularSales, today)
  const psa = dailyRecords(api.psa10Sales, today, true)
  const counts = (old: Record<string, number> = {}, records: PriceRecord[]) => {
    const result = { ...old }
    for (const r of records) result[r.date] = Math.max(result[r.date] ?? 0, r.sample_count ?? 0)
    return result
  }
  return { ...previous, history: merge(previous.history, raw),
    psa10_history: merge(previous.psa10_history ?? previous.history.filter(r => r.psa10 != null), psa),
    sales_by_day: counts(previous.sales_by_day, raw),
    psa10_sales_by_day: counts(previous.psa10_sales_by_day, psa), sales_fetched_at: today }
}

export async function scrapeVintageCard(browser: Browser, id: string, apparelId: number, today: string): Promise<boolean> {
  if (!/^(pcg[6-9]-|pmcg1-|30th-card-set-)/.test(id) || !apparelId) throw new Error('登録済み旧裏・PCG・御三家プロモだけが対象です')
  const file = path.join(process.cwd(), 'data/prices', `${id}.json`)
  let previous: PriceHistory = { card_id: id, history: [] }
  if (fs.existsSync(file)) previous = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (previous.history.some(r => r.source && r.source !== 'snkrdunk')) throw new Error(`${id}: 取得元の異なる履歴は移行しません`)
  // Older collectibles may only trade a few times a year. Store actual trade dates,
  // and keep PSA10 independent instead of dropping it when raw samples are sparse.
  const api = await getSnkrdunkSales(browser, apparelId, 3650)
  if (api.regularComplete === false || api.psa10Complete === false) throw new Error(`${id}: 成約APIの取得失敗（既存履歴を維持）`)
  if (!api.regularSales.length && !api.psa10Sales.length) {
    console.log(`${id}: 該当商品APIに成約データなし（既存履歴を維持）`)
    return false
  }
  const next = mergeVintageSales(previous, api, today)
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
  console.log(`${id}: 素体 ${next.history[0]?.date ?? '未取得'} ¥${next.history[0]?.avg ?? '—'} / PSA10 ${next.psa10_history?.[0]?.date ?? '未取得'} ¥${next.psa10_history?.[0]?.psa10 ?? '—'}`)
  return true
}
