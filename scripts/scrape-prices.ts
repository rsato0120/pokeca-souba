import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'
import type { PriceHistory } from '@/types/pokeca'

const SNKRDUNK_IDS_FILE = path.join(process.cwd(), 'data', 'snkrdunk-ids.json')

function loadSnkrdunkIds(): Record<string, number> {
  try { return JSON.parse(fs.readFileSync(SNKRDUNK_IDS_FILE, 'utf-8')) } catch { return {} }
}

function saveSnkrdunkIds(ids: Record<string, number>): void {
  fs.writeFileSync(SNKRDUNK_IDS_FILE, JSON.stringify(ids, null, 2), 'utf-8')
}

const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/, /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i]
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
  const searchUrl = `https://jp.mercari.com/search?keyword=${keyword}&status=sold_out&item_types=buy_now&sort=created_time&order=desc`

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

// スニーカーダンク: カード名+レアリティで apparel_id を検索
async function findSnkrdunkId(browser: Browser, cardName: string, rarity: string): Promise<number | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  try {
    const query = encodeURIComponent(`${cardName} ${rarity}`)
    await page.goto(`https://snkrdunk.com/search?keyword=${query}&category=card`, {
      waitUntil: 'domcontentloaded', timeout: 15000
    })
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .filter(a => (a as HTMLAnchorElement).href.includes('/apparels/'))
        .map(a => ({ text: (a as HTMLElement).innerText.trim(), href: (a as HTMLAnchorElement).href }))
    )
    const filtered = links.filter(l => l.text.includes(cardName) && l.text.includes(rarity))
    if (!filtered.length) return null
    const m = filtered[0].href.match(/\/apparels\/(\d+)/)
    return m ? parseInt(m[1]) : null
  } catch { return null }
  finally { await page.close() }
}

// メルカリ: 固定価格出品中件数を取得
async function getMercariOnSaleCount(browser: Browser, searchQuery: string): Promise<number | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  const keyword = encodeURIComponent(searchQuery)
  const url = `https://jp.mercari.com/search?keyword=${keyword}&status=on_sale&item_types=buy_now`
  try {
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 25000 }
    )
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null
    try { json = await (await responsePromise).json() } catch { return null }
    if (!json) return null
    const meta = json.meta ?? json.data?.meta ?? {}
    const rawTotal = meta.numFound ?? meta.total ?? json.numFound ?? json.totalCount
    const count = rawTotal != null ? Number(rawTotal) : null
    return count != null && !isNaN(count) && count > 0 ? count : null
  } catch { return null }
  finally { await page.close() }
}

// スニーカーダンク: PSA10 全取引の平均価格を取得
async function getSnkrdunkPsa10(browser: Browser, apparelId: number): Promise<number | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  try {
    await page.goto(`https://snkrdunk.com/apparels/${apparelId}/sales-histories`, {
      waitUntil: 'domcontentloaded', timeout: 15000
    })
    const histText = await page.evaluate(() => document.body.innerText)
    const psa10Start = histText.indexOf('状態PSA10の売買履歴')
    if (psa10Start < 0) return null
    const psa9Start = histText.indexOf('状態PSA9の売買履歴', psa10Start)
    const section = histText.slice(psa10Start, psa9Start > 0 ? psa9Start : psa10Start + 1500)
    if (section.includes('まだこの商品は取引がありません')) return null
    const matches = [...section.matchAll(/¥([\d,]+)/g)]
    const prices = matches.map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p > 0)
    if (!prices.length) return null
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  } catch { return null }
  finally { await page.close() }
}

function savePriceHistory(
  cardId: string,
  date: string,
  low: number,
  high: number,
  avg: number,
  onSale: number | null,
  psa10: number | null
): void {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  let data: PriceHistory = { card_id: cardId, history: [] }
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {}

  const record = {
    date, low, high, avg,
    ...(onSale != null ? { on_sale: onSale } : {}),
    ...(psa10 != null ? { psa10 } : { psa10: null }),
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
  stats: { succeeded: number; skipped: number; failed: number },
  snkrdunkIds: Record<string, number>,
  cardName?: string,
  rarity?: string
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
    const avg = Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length)

    // メルカリ出品数（固定価格のみ）
    const onSale = await getMercariOnSaleCount(browser, searchQuery)

    // スニーカーダンクからPSA10平均取得（カードのみ）
    let psa10: number | null = null
    if (cardName && rarity) {
      let apparelId: number | null = snkrdunkIds[id] ?? null
      if (!apparelId) {
        apparelId = await findSnkrdunkId(browser, cardName, rarity)
        if (apparelId) {
          snkrdunkIds[id] = apparelId
          saveSnkrdunkIds(snkrdunkIds)
        }
      }
      if (apparelId) {
        psa10 = await getSnkrdunkPsa10(browser, apparelId)
      }
    }

    const onSaleLog = onSale != null ? ` / 出品${onSale}件` : ''
    const psa10Log = psa10 != null ? ` / PSA10平均¥${psa10.toLocaleString()}` : ''

    savePriceHistory(id, date, low, high, avg, onSale, psa10)
    console.log(`完了 平均¥${avg.toLocaleString()}（売${filtered.length}件${onSaleLog}${psa10Log}）`)
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
  const boxCodeMap = new Map(getAllBoxes().map(b => [b.box_id, b.code]))
  const date = todayJST()
  console.log(`${cards.length}枚のカード＋${boxes.length}BOXの価格をスクレイピングします（${date} JST）\n`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const stats = { succeeded: 0, skipped: 0, failed: 0 }
  const snkrdunkIds = loadSnkrdunkIds()

  try {
    // ── カード価格 ──
    for (const card of cards) {
      const boxName = boxMap.get(card.box_id) ?? ''
      const boxCode = boxCodeMap.get(card.box_id) ?? ''
      // セットコード（M2, M4等）を加えることで標準TCGの同名ARカードが混入するのを防ぐ
      const query = `${card.card_name} ${card.rarity} ${boxCode} ${boxName}`.replace(/\s+/g, ' ').trim()
      await scrapeItem(
        browser,
        getCardSlug(card),
        query,
        `${card.card_name} ${card.rarity}`,
        date,
        stats,
        snkrdunkIds,
        card.card_name,
        card.rarity
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
          stats,
          snkrdunkIds
          // cardName/rarity 未指定 → スニーカーダンク不要
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
