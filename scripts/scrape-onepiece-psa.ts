import fs from 'node:fs'
import { chromium } from 'playwright'
import { getOnePieceCatalog, getOnePiecePrices } from '../src/lib/onepiece'
import { computePsa10Extremes } from '../src/lib/psa10-extremes'
import { buildOnePieceHistory, parseOnePieceSale, type Sale } from './onepiece-price-utils'
import { PSA10_CONDITION_ID } from './snkrdunk-sales'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  let failed = 0
  try {
    const filters = process.argv.slice(2)
    for (const product of getOnePieceCatalog().products.filter(p => p.kind === 'card' && (!filters.length || filters.includes(p.id)))) {
      try {
        const previous = getOnePiecePrices(product.id)
        if (!previous) continue
        const now = Date.now()
        const cutoff = now - 120 * 86400000
        const sales: Sale[] = []
        let complete = false
        for (let index = 1; index <= 5; index++) {
          const url = `https://snkrdunk.com/v1/apparels/${product.snkrdunk_id}/sales-history?page=${index}&per_page=1000&condition_id=${PSA10_CONDITION_ID}`
          const response = await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' })
          if (!response?.ok()) throw Error(`HTTP ${response?.status()}`)
          const json = JSON.parse(await response.text())
          if (!Array.isArray(json.history)) throw Error('Invalid sales response')
          let old = false
          for (const row of json.history) {
            const sale = parseOnePieceSale(row, 'psa10', now)
            if (!sale) continue
            if (Date.parse(sale.date) < cutoff) { old = true; continue }
            sales.push(sale)
          }
          if (old || json.history.length < 1000) { complete = true; break }
        }
        const oldest = sales.map(s => s.date).sort()[0]
        const usable = complete ? sales : sales.filter(s => s.date > oldest)
        const records = buildOnePieceHistory(usable).filter(r => complete || Date.parse(r.date) >= Date.parse(oldest) + 30 * 86400000)
          .map(r => ({ ...r, psa10: r.avg }))
        const history = new Map((previous.psa10_history ?? []).map(r => [r.date, r]))
        for (const record of records) history.set(record.date, record)
        const sorted = [...history.values()].sort((a, b) => b.date.localeCompare(a.date))
        const counts = { ...previous.psa10_sales_by_day }
        for (const date of new Set(usable.map(s => s.date))) counts[date] = usable.filter(s => s.date === date).length
        const result = { ...previous, psa10_history: sorted.slice(0, 120), psa10_sales_by_day: counts,
          psa10_archived_extremes: computePsa10Extremes(sorted.slice(120), previous.psa10_archived_extremes),
          psa10_fetched_at: new Date(now).toISOString() }
        fs.writeFileSync(`data/onepiece/prices/${product.id}.json`, JSON.stringify(result, null, 2) + '\n')
        console.log(`${product.id}: PSA10 ${sales.length} sales / ${records.length} price records`)
      } catch (error) { failed++; console.error(`${product.id}: ${String(error)}`) }
      await new Promise(r => setTimeout(r, 400))
    }
  } finally { await browser.close() }
  if (failed) process.exitCode = 1
}
main()
