import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'
import type { PriceHistory } from '@/types/pokeca'

const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[2-9][0-9]枚/, /[2-9０-９]\s*枚/]
const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(pricesDir, { recursive: true })

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function isExcluded(title: string): boolean {
  return EXCLUDE_KEYWORDS.some(kw => title.includes(kw)) ||
    EXCLUDE_PATTERNS.some(re => re.test(title))
}

function calcMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices
  const med = calcMedian(prices)
  return prices.filter(p => p >= med * 0.5 && p <= med * 1.5)
}

function calcPercentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.min(idx, sorted.length - 1)]
}

interface MercariItem {
  id?: string
  name: string
  price: number
  status?: string
}

// 売り切れ商品から価格を取得
async function scrapeMercari(browser: Browser, searchQuery: string, debug = false): Promise<number[]> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  const keyword = encodeURIComponent(searchQuery)
  const searchUrl = `https://jp.mercari.com/search?keyword=${keyword}&status=sold_out&sort=created_time&order=desc`

  try {
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 20000 }
    )

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    try {
      const searchResponse = await responsePromise
      const json = await searchResponse.json()
      const rawItems: MercariItem[] =
        json.items ?? json.data?.items ?? json.result?.items ?? []

      if (debug) console.log(`  [API sold] ${rawItems.length}件取得`)

      return rawItems
        .filter(item => !isExcluded(item.name) && Number(item.price) > 0)
        .map(item => Number(item.price))
    } catch {
      if (debug) console.log('\n  [DEBUG] APIタイムアウト → DOMスクレイピングにフォールバック')
      try {
        await page.waitForSelector('mer-price, [data-testid="item-price"]', { timeout: 8000 })
      } catch {}

      const domPrices = await page.evaluate((): number[] => {
        const prices: number[] = []
        const selectors = ['mer-price', '[data-testid="item-price"]', '[data-testid="price"]']
        for (const sel of selectors) {
          for (const el of document.querySelectorAll(sel)) {
            const text = el.textContent ?? el.getAttribute('value') ?? ''
            const num = parseInt(text.replace(/[^0-9]/g, ''))
            if (num > 100 && num < 10_000_000) prices.push(num)
          }
          if (prices.length > 0) break
        }
        return prices
      })
      if (debug) console.log(`\n  [DEBUG] DOMから${domPrices.length}件`)
      return domPrices
    }
  } finally {
    await page.close()
  }
}

// 出品中件数を取得（供給量の代替指標）
async function getMercariOnSaleCount(browser: Browser, searchQuery: string, debug = false): Promise<number | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  const keyword = encodeURIComponent(searchQuery)
  const url = `https://jp.mercari.com/search?keyword=${keyword}&status=on_sale`

  try {
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 25000 }
    )
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null
    try {
      const res = await responsePromise
      json = await res.json()
    } catch (e) {
      if (debug) process.stdout.write(`[on_sale API失敗: ${e instanceof Error ? e.message : e}] `)
      return null
    }

    if (!json) return null

    // APIレスポンスから件数を取得（numFound は文字列で返ることがある）
    const items: MercariItem[] = json.items ?? json.data?.items ?? json.result?.items ?? []
    const meta = json.meta ?? json.data?.meta ?? {}
    const rawTotal = meta.numFound ?? meta.total ?? json.numFound ?? json.totalCount
    const count = rawTotal != null ? Number(rawTotal) : items.length

    if (debug) process.stdout.write(`[on_sale: numFound=${rawTotal} count=${count} items=${items.length}] `)
    return !isNaN(count) && count >= 0 ? count : null
  } catch (e) {
    if (debug) process.stdout.write(`[on_sale例外: ${e instanceof Error ? e.message : e}] `)
    return null
  } finally {
    await page.close()
  }
}

function savePriceHistory(
  cardId: string,
  date: string,
  low: number,
  high: number,
  onSale: number | null
): void {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  let data: PriceHistory = { card_id: cardId, history: [] }
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {}

  const record = {
    date, low, high,
    ...(onSale != null ? { on_sale: onSale } : {}),
  }

  const idx = data.history.findIndex(r => r.date === date)
  if (idx >= 0) {
    data.history[idx] = record
  } else {
    data.history.push(record)
  }

  data.history.sort((a, b) => b.date.localeCompare(a.date))
  data.history = data.history.slice(0, 30)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function scrapeItem(
  browser: Browser,
  id: string,
  searchQuery: string,
  label: string,
  date: string,
  stats: { succeeded: number; skipped: number; failed: number }
) {
  process.stdout.write(`  [${label}] スクレイピング中... `)
  try {
    let filtered: number[] = []
    const MAX_RETRY = 3
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      const prices = await scrapeMercari(browser, searchQuery)
      filtered = removeOutliers(prices)
      if (filtered.length >= 5) break
      if (attempt < MAX_RETRY) {
        process.stdout.write(`(${filtered.length}件 → リトライ${attempt}/${MAX_RETRY - 1}回目) `)
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    if (filtered.length < 5) {
      console.log(`データ不足（${filtered.length}件）— スキップ（既存価格を維持）`)
      stats.skipped++
      await new Promise(r => setTimeout(r, 1000))
      return
    }

    const low = calcPercentile(filtered, 25)
    const high = calcPercentile(filtered, 75)
    const onSale = await getMercariOnSaleCount(browser, searchQuery)
    const supplyLog = onSale != null ? ` / 出品中${onSale}件` : ''

    savePriceHistory(id, date, low, high, onSale)
    console.log(`完了 ¥${low.toLocaleString()}〜¥${high.toLocaleString()}（売${filtered.length}件${supplyLog}）`)
    stats.succeeded++
  } catch (e) {
    console.log('失敗（既存価格を維持）')
    console.error('  エラー:', e instanceof Error ? e.message : e)
    stats.failed++
  }
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
}

async function main() {
  const cards = getAllCards()
  const boxes = getAllBoxes().filter(b => b.certainty === 'released' && b.packs_per_box != null)
  const boxMap = new Map(getAllBoxes().map(b => [b.box_id, b.box_name]))
  const date = todayJST()
  console.log(`${cards.length}枚のカード＋${boxes.length}BOXの価格をスクレイピングします（${date} JST）\n`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const stats = { succeeded: 0, skipped: 0, failed: 0 }

  try {
    // ── カード価格 ──
    for (const card of cards) {
      const boxName = boxMap.get(card.box_id) ?? ''
      const query = `${card.card_name} ${card.rarity} ${boxName}`
      await scrapeItem(
        browser,
        getCardSlug(card),
        query,
        `${card.card_name} ${card.rarity}`,
        date,
        stats
      )
    }

    // ── 未開封BOX価格 ──
    if (boxes.length > 0) {
      console.log('\n── 未開封BOX ──')
      for (const box of boxes) {
        await scrapeItem(
          browser,
          `box-${box.box_id}`,
          `${box.box_name} 未開封 BOX`,
          `${box.box_name} 未開封BOX`,
          date,
          stats
        )
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n完了: ${stats.succeeded}件更新, ${stats.skipped}件スキップ, ${stats.failed}件失敗`)
  if (stats.failed > 0) process.exit(1)
}

main()
