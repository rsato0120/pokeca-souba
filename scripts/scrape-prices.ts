import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getCardSlug } from '@/lib/data'
import type { PriceHistory } from '@/types/pokeca'

const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[2-9][0-9]枚/]
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
async function getMercariOnSaleCount(browser: Browser, searchQuery: string): Promise<number | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  const keyword = encodeURIComponent(searchQuery)
  const url = `https://jp.mercari.com/search?keyword=${keyword}&status=on_sale`

  try {
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 15000 }
    )
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })

    const json = await responsePromise.then(r => r.json()).catch(() => null)
    if (!json) return null

    // APIレスポンスから件数を取得
    const items: MercariItem[] = json.items ?? json.data?.items ?? json.result?.items ?? []
    const total: number | undefined =
      json.meta?.numFound ?? json.meta?.total ?? json.numFound ?? json.totalCount

    // totalがあればそれ、なければ取得できたアイテム数
    const count = total ?? items.length
    return typeof count === 'number' && count >= 0 ? count : null
  } catch {
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

async function main() {
  const cards = getAllCards()
  const date = todayJST()
  console.log(`${cards.length}枚の価格をスクレイピングします（${date} JST）\n`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  let succeeded = 0
  let skipped = 0
  let failed = 0

  try {
    for (const card of cards) {
      const cardId = getCardSlug(card)
      const searchQuery = `${card.card_name} ${card.rarity}`
      process.stdout.write(`  [${searchQuery}] スクレイピング中... `)

      try {
        // 1. 売り切れ価格（需要・実勢価格）
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
          skipped++
          await new Promise(r => setTimeout(r, 1000))
          continue
        }

        const low = calcPercentile(filtered, 25)
        const high = calcPercentile(filtered, 75)

        // 2. 出品中件数（供給量）
        const onSale = await getMercariOnSaleCount(browser, searchQuery)
        const supplyLog = onSale != null ? ` / 出品中${onSale}件` : ''

        savePriceHistory(cardId, date, low, high, onSale)
        console.log(`完了 ¥${low.toLocaleString()}〜¥${high.toLocaleString()}（売${filtered.length}件${supplyLog}）`)
        succeeded++
      } catch (e) {
        console.log('失敗（既存価格を維持）')
        console.error('  エラー:', e instanceof Error ? e.message : e)
        failed++
      }

      // リクエスト間隔（2〜4秒のランダム遅延）
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
    }
  } finally {
    await browser.close()
  }

  console.log(`\n完了: ${succeeded}枚更新, ${skipped}枚スキップ, ${failed}枚失敗`)
  if (failed > 0) process.exit(1)
}

main()
