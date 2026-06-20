import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getCardSlug } from '@/lib/data'
import type { PriceHistory } from '@/types/pokeca'

const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ']
// 「セット」は「各1枚セット」などで誤除外されるため枚数付きのみ対象
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

async function scrapeMercari(browser: Browser, searchQuery: string, debug = false): Promise<number[]> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  const keyword = encodeURIComponent(searchQuery)
  const searchUrl = `https://jp.mercari.com/search?keyword=${keyword}&status=sold_out&sort=created_time&order=desc`

  try {
    // 検索APIのレスポンスを明示的に待つ
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

      if (debug) console.log(`  [API] ${rawItems.length}件取得`)

      return rawItems
        .filter(item => !isExcluded(item.name) && Number(item.price) > 0)
        .map(item => Number(item.price))
    } catch {
      // タイムアウト時は DOMフォールバック
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

function savePriceHistory(cardId: string, date: string, low: number, high: number): void {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  let data: PriceHistory = { card_id: cardId, history: [] }
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {}

  const idx = data.history.findIndex(r => r.date === date)
  if (idx >= 0) {
    data.history[idx] = { date, low, high }
  } else {
    data.history.push({ date, low, high })
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
        savePriceHistory(cardId, date, low, high)
        console.log(`完了 ¥${low.toLocaleString()}〜¥${high.toLocaleString()}（${filtered.length}件）`)
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
