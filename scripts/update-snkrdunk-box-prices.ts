import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'
import { getSnkrdunkBoxSales, type BoxSale } from './snkrdunk-sales'
import type { PriceHistory, PriceRecord } from '../src/types/pokeca'
import { canUsePriceSource } from '../src/lib/price-source'

const root = process.cwd()
const pricesDir = path.join(root, 'data', 'prices')
const ids = JSON.parse(fs.readFileSync(path.join(root, 'data', 'snkrdunk-ids.json'), 'utf-8')) as Record<string, number>
const boxId = process.argv[2] ?? '30th_celebration'
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

function percentile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
}

// 新しい日から20件以上になるまで採る。同じ日の取引は途中で切らない。
function recentSales(sales: BoxSale[], target = 20): BoxSale[] {
  const byDay = new Map<string, BoxSale[]>()
  for (const sale of sales) {
    const rows = byDay.get(sale.date)
    if (rows) rows.push(sale)
    else byDay.set(sale.date, [sale])
  }
  const selected: BoxSale[] = []
  for (const date of [...byDay.keys()].sort().reverse()) {
    selected.push(...byDay.get(date)!)
    if (selected.length >= target) break
  }
  return selected
}

function save(seriesId: string, sales: BoxSale[]): boolean {
  const selected = recentSales(sales)
  if (selected.length === 0) return false

  const prices = selected.map(s => s.unitPrice).filter(p => p > 0).sort((a, b) => a - b)
  if (prices.length === 0) return false
  const low = percentile(prices, 0.2)
  const high = percentile(prices, 0.8)
  const avg = percentile(prices, 0.5)
  const record: PriceRecord = { date: today, low, high, avg, source: 'snkrdunk', sample_count: prices.length, psa10: null }

  const filePath = path.join(pricesDir, `${seriesId}.json`)
  let data: PriceHistory = { card_id: seriesId, history: [] }
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PriceHistory } catch {}
  if (!canUsePriceSource(data.history[0]?.source, 'snkrdunk')) {
    console.log(`${seriesId}: 取得元固定のためスキップ（既存価格・取得日を維持）`)
    return false
  }

  const index = data.history.findIndex(r => r.date === today)
  if (index >= 0) data.history[index] = record
  else data.history.push(record)
  data.history.sort((a, b) => b.date.localeCompare(a.date))
  data.history = data.history.slice(0, 90)

  const daily = { ...(data.sales_by_day ?? {}) }
  const observed: Record<string, number> = {}
  for (const sale of sales) observed[sale.date] = (observed[sale.date] ?? 0) + sale.lot
  // 相対日付が後日の取得で絶対日付に確定するため、再取得値は加算せず日別の大きい方を残す。
  for (const [date, count] of Object.entries(observed)) daily[date] = Math.max(daily[date] ?? 0, count)
  data.sales_by_day = daily
  data.sales_fetched_at = today
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`${seriesId}: ¥${low.toLocaleString()}〜¥${high.toLocaleString()}（中央値¥${avg.toLocaleString()}・${prices.length}件）`)
  return true
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const directSeriesId = `box-${boxId}`
    const directApparelId = ids[directSeriesId]
    if (directApparelId) {
      const result = await getSnkrdunkBoxSales(browser, directApparelId, 45)
      if (!save(directSeriesId, result.sales)) {
        throw new Error(`${boxId}: スニダンの成約価格を取得できませんでした`)
      }
      return
    }

    const variants = await Promise.all((['shrink', 'noshrink'] as const).map(async variant => {
      const seriesId = `box-${boxId}-${variant}`
      const apparelId = ids[seriesId]
      if (!apparelId) throw new Error(`スニダン商品IDがありません: ${seriesId}`)
      const result = await getSnkrdunkBoxSales(browser, apparelId, 45)
      return { seriesId, sales: result.sales }
    }))

    let updated = 0
    for (const variant of variants) if (save(variant.seriesId, variant.sales)) updated++
    if (save(`box-${boxId}`, variants.flatMap(v => v.sales))) updated++
    if (updated === 0) throw new Error(`${boxId}: スニダンの成約価格を取得できませんでした`)
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
