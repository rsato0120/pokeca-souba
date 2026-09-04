import fs from 'node:fs'
import { chromium } from 'playwright'
import { getOnePieceCatalog, getOnePiecePrices } from '../src/lib/onepiece'
import { buildOnePieceHistory, parseOnePieceSale, type Sale } from './onepiece-price-utils'
import type { OnePiecePrices } from '../src/types/onepiece'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const filters = process.argv.slice(2)
  const products = getOnePieceCatalog().products.filter(p => !filters.length || filters.includes(p.id) || filters.includes(p.set_id))
  fs.mkdirSync('data/onepiece/prices', { recursive: true })
  let failed = 0
  try {
    for (const product of products) {
      try {
        const now = Date.now()
        const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10)
        const cutoff = Date.parse(today) - 119 * 86400000
        const sales: Sale[] = []
        let complete = false
        for (let index = 1; index <= (product.kind === 'box' ? 12 : 5); index++) {
          const url = `${product.source_url.replace('/apparels/', '/v1/apparels/')}/sales-history?page=${index}&per_page=1000`
            + (product.kind === 'card' ? '&condition_id=18' : '')
          let rows: Array<{ date: string; price: number; condition?: string; size?: string }> | null = null
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
              if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`)
              const json = JSON.parse(await response.text())
              if (!Array.isArray(json.history)) throw new Error('Invalid sales response')
              rows = json.history
              break
            } catch (error) {
              if (attempt === 2) throw error
              await new Promise(r => setTimeout(r, 2000))
            }
          }
          if (!rows) throw new Error('No sales response')
          let reachedOld = false
          for (const row of rows) {
            const sale = parseOnePieceSale(row, product.kind, now)
            if (!sale) continue
            if (Date.parse(sale.date) < cutoff) { reachedOld = true; continue }
            sales.push(sale)
          }
          if (reachedOld || rows.length < (product.kind === 'box' ? 20 : 1000)) { complete = true; break }
          await new Promise(r => setTimeout(r, 300))
        }
        if (!sales.length) throw new Error('No usable sales; previous data retained')
        const previous = getOnePiecePrices(product.id)
        // A page cap can cut the oldest day in half. Discard that day, preserving older observations.
        const oldest = sales.map(s => s.date).sort()[0]
        const usable = complete ? sales : sales.filter(s => s.date > oldest)
        if (!usable.length) throw new Error('Incomplete first day; previous data retained')
        const counts: Record<string, number> = { ...previous?.sales_by_day }
        for (const date of new Set(usable.map(s => s.date))) counts[date] = usable.filter(s => s.date === date).length
        // Only publish windows for which all preceding 30 days were fetched, unless the full history ends here.
        const records = buildOnePieceHistory(usable).filter(r => complete || Date.parse(r.date) >= Date.parse(oldest) + 30 * 86400000)
        // For a capped, liquid BOX, the newest window is still complete once 20 trades fit after the cutoff.
        if (!complete) {
          for (const record of buildOnePieceHistory(usable)) {
            if ((record.sample_count ?? 0) >= 20 && !records.some(r => r.date === record.date)) records.push(record)
          }
        }
        const history = new Map((previous?.history ?? []).map(r => [r.date, r]))
        for (const record of records) history.set(record.date, record)
        const result: OnePiecePrices = { product_id: product.id, fetched_at: new Date(now).toISOString(),
          history: [...history.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120),
          sales_by_day: counts, coverage_start: usable.map(s => s.date).sort()[0], complete }
        fs.writeFileSync(`data/onepiece/prices/${product.id}.json`, JSON.stringify(result, null, 2) + '\n')
        console.log(`${product.id}: ${sales.length} sales, ¥${result.history[0]?.avg ?? 'insufficient'} (${result.history[0]?.date ?? '-'})`)
      } catch (error) {
        failed++
        console.error(`${product.id}: ${String(error)}`)
      }
      await new Promise(r => setTimeout(r, 700))
    }
  } finally { await browser.close() }
  if (failed) process.exitCode = 1
}
main()
