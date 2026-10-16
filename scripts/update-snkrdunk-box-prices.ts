import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'node:url'
import { forEachBounded } from './bounded-workers'
import { chromium, type Browser } from 'playwright'
import { getSnkrdunkBoxSales, type BoxSale } from './snkrdunk-sales'
import type { PriceHistory, PriceRecord } from '../src/types/pokeca'

import { getSnkrdunkBoxListingCount } from './snkrdunk-box-listings'
import { existingSnkrdunkBoxes, hasNewBoxSales, boxProductSeries } from './snkrdunk-box-price-policy'

const root = process.cwd()
const pricesDir = path.join(root, 'data', 'prices')
const ids = JSON.parse(fs.readFileSync(path.join(root, 'data', 'snkrdunk-ids.json'), 'utf-8')) as Record<string, number>
// Registered BOX products remain eligible regardless of the previous observation source.
const requested = process.argv.slice(2)
const boxIds = requested.length ? requested : existingSnkrdunkBoxes(fs.readdirSync(pricesDir)
  .filter(file => file.startsWith('box-') && file.endsWith('.json'))
  .map(file => ({ id: file.slice(0, -5), latest: JSON.parse(fs.readFileSync(path.join(pricesDir, file), 'utf-8')).history[0] })), ids)
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

export function save(seriesId: string, sales: BoxSale[], onSale: number | null): boolean {
  const selected = recentSales(sales)
  if (selected.length === 0) return false

  const prices = selected.map(s => s.unitPrice).filter(p => p > 0).sort((a, b) => a - b)
  if (prices.length === 0) return false
  const low = percentile(prices, 0.2)
  const high = percentile(prices, 0.8)
  const avg = percentile(prices, 0.5)
  const record: PriceRecord = { date: today, low, high, avg, source: 'snkrdunk', sample_count: prices.length, psa10: null }
  if (onSale != null) {
    record.on_sale = onSale
    record.on_sale_source = 'snkrdunk'
  } else console.warn(`${seriesId}: 出品数を取得できませんでした（欠測として保存）`)

  const filePath = path.join(pricesDir, `${seriesId}.json`)
  let data: PriceHistory = { card_id: seriesId, history: [] }
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PriceHistory } catch {}
  if (!seriesId.startsWith('box-') || !(ids[seriesId] || (ids[seriesId + '-shrink'] && ids[seriesId + '-noshrink']))) {
    console.log(`${seriesId}: 取得元固定のためスキップ（既存価格・取得日を維持）`)
    return false
  }
  if (!hasNewBoxSales(data.history[0], selected.map(s => s.date), today)) {
    console.log(`${seriesId}: 新しい成約なし — 最後の価格・観測日を維持`)
    return false
  }

  // Keep a complete original snapshot, including same-day observations, before migration.
  if (data.history[0]?.source === 'mercari') {
    const dir = path.join(root, 'data', 'price-source-archives', seriesId)
    fs.mkdirSync(dir, { recursive: true })
    const archive = path.join(dir, 'mercari-' + today + '.json')
    if (!fs.existsSync(archive)) fs.writeFileSync(archive, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
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

export async function updateBox(browser: Browser, boxId: string, fetchSales = getSnkrdunkBoxSales, fetchCount = getSnkrdunkBoxListingCount) {
  const products = boxProductSeries(boxId, ids)
  if (!products.length) throw new Error('スニダン商品IDがありません: ' + boxId)
  const acquired: Array<{ sales: BoxSale[]; count: number | null }> = []
  let failed = 0
  for (const seriesId of products) {
    try {
      const result = await fetchSales(browser, ids[seriesId], 45)
      if (!result.sales.length && !result.complete) throw new Error('成約APIの取得失敗')
      const count = await fetchCount(browser, ids[seriesId])
      if (!result.sales.length) console.log(seriesId + ': 直近45日の成約なし（API取得完了）')
      save(seriesId, result.sales, count)
      acquired.push({ sales: result.sales, count })
    } catch (error) { failed++; console.error(seriesId, error) }
  }
  // Only combine both registered variants when there is no direct product.
  if (!ids['box-' + boxId] && acquired.length === 2) {
    const count = acquired.every(v => v.count != null) ? acquired.reduce((sum, v) => sum + v.count!, 0) : null
    save('box-' + boxId, acquired.flatMap(v => v.sales), count)
  }
  if (failed) throw new Error(failed + ' product fetches failed')
}

async function main() {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] })
  let failed = 0
  try {
    await forEachBounded(boxIds, 3, async boxId => {
      try { await updateBox(browser, boxId) }
      catch (error) { failed++; console.error(boxId, error) }
    })
  } finally { await browser.close() }
  if (failed) throw new Error(`${failed} BOX updates failed; previous prices retained`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
