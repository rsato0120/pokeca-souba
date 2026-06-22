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

const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(pricesDir, { recursive: true })

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
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

// スニーカーダンク: apparel_id をカード名+レアリティで検索
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

// スニーカーダンク: 素体平均価格 + PSA10平均価格を取得
async function getSnkrdunkPrices(browser: Browser, apparelId: number): Promise<{ regular: number | null; psa10: number | null }> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  try {
    await page.goto(`https://snkrdunk.com/apparels/${apparelId}/sales-histories`, {
      waitUntil: 'domcontentloaded', timeout: 15000
    })
    const text = await page.evaluate(() => document.body.innerText)

    // 素体（非PSA）: PSAセクション開始前の全取引価格を平均
    const psaStart = text.indexOf('状態PSA')
    const regularSection = psaStart > 0 ? text.slice(0, psaStart) : text
    const regularPrices = [...regularSection.matchAll(/¥([\d,]+)/g)]
      .map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p > 0)
    const regular = regularPrices.length > 0
      ? Math.round(regularPrices.reduce((a, b) => a + b, 0) / regularPrices.length)
      : null

    // PSA10: 専用セクションの全取引価格を平均
    const psa10Start = text.indexOf('状態PSA10の売買履歴')
    let psa10: number | null = null
    if (psa10Start >= 0) {
      const psa9Start = text.indexOf('状態PSA9の売買履歴', psa10Start)
      const psa10Section = text.slice(psa10Start, psa9Start > 0 ? psa9Start : psa10Start + 1500)
      if (!psa10Section.includes('まだこの商品は取引がありません')) {
        const psa10Prices = [...psa10Section.matchAll(/¥([\d,]+)/g)]
          .map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p > 0)
        psa10 = psa10Prices.length > 0
          ? Math.round(psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length)
          : null
      }
    }

    return { regular, psa10 }
  } catch { return { regular: null, psa10: null } }
  finally { await page.close() }
}

// Mercari sold_out prices（BOX専用フォールバック）
const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/, /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i]

function isExcluded(title: string): boolean {
  return EXCLUDE_KEYWORDS.some(kw => title.includes(kw)) || EXCLUDE_PATTERNS.some(re => re.test(title))
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

interface MercariItem { id?: string; name: string; price: number; status?: string }

async function scrapeMercariSoldAvg(browser: Browser, searchQuery: string): Promise<number | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  const keyword = encodeURIComponent(searchQuery)
  const url = `https://jp.mercari.com/search?keyword=${keyword}&status=sold_out&item_types=buy_now&sort=created_time&order=desc`
  try {
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 20000 }
    )
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const json = await (await responsePromise).json()
    const rawItems: MercariItem[] = json.items ?? json.data?.items ?? json.result?.items ?? []
    const prices = removeOutliers(
      rawItems.filter(i => !isExcluded(i.name) && Number(i.price) > 0).map(i => Number(i.price))
    )
    if (prices.length < 3) return null
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  } catch { return null }
  finally { await page.close() }
}

function savePriceHistory(
  cardId: string,
  date: string,
  avg: number,
  onSale: number | null,
  psa10: number | null
): void {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  let data: PriceHistory = { card_id: cardId, history: [] }
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch {}

  const record = {
    date,
    low: avg,   // AI forecast 互換
    high: avg,  // AI forecast 互換
    avg,
    ...(onSale != null ? { on_sale: onSale } : {}),
    ...(psa10 != null ? { psa10 } : { psa10: null }),
  }

  const idx = data.history.findIndex(r => r.date === date)
  if (idx >= 0) data.history[idx] = record
  else data.history.push(record)

  data.history.sort((a, b) => b.date.localeCompare(a.date))
  data.history = data.history.slice(0, 30)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function scrapeCard(
  browser: Browser,
  id: string,
  searchQuery: string,
  label: string,
  date: string,
  stats: { succeeded: number; skipped: number; failed: number },
  snkrdunkIds: Record<string, number>,
  cardName: string,
  rarity: string
) {
  process.stdout.write(`  [${label}] スクレイピング中... `)
  try {
    // スニーカーダンクIDを検索
    let apparelId: number | null = snkrdunkIds[id] ?? null
    if (!apparelId) {
      apparelId = await findSnkrdunkId(browser, cardName, rarity)
      if (apparelId) { snkrdunkIds[id] = apparelId; saveSnkrdunkIds(snkrdunkIds) }
    }

    let avg: number | null = null
    let psa10: number | null = null
    let source = ''

    if (apparelId) {
      // スニーカーダンクから取得
      const prices = await getSnkrdunkPrices(browser, apparelId)
      avg = prices.regular
      psa10 = prices.psa10
      source = 'スニダン'
    }

    if (avg == null) {
      // Mercari sold_out でフォールバック
      for (let attempt = 1; attempt <= 3; attempt++) {
        avg = await scrapeMercariSoldAvg(browser, searchQuery)
        if (avg != null) break
        if (attempt < 3) { process.stdout.write(`(データ不足→リトライ${attempt}) `); await new Promise(r => setTimeout(r, 3000)) }
      }
      source = 'メルカリ'
    }

    if (avg == null) {
      console.log('データ不足 — スキップ（既存価格を維持）')
      stats.skipped++
      await new Promise(r => setTimeout(r, 1000))
      return
    }

    const onSale = await getMercariOnSaleCount(browser, searchQuery)

    const onSaleLog = onSale != null ? ` / 出品${onSale}件` : ''
    const psa10Log = psa10 != null ? ` / PSA10¥${psa10.toLocaleString()}` : ''
    savePriceHistory(id, date, avg, onSale, psa10)
    console.log(`完了 [${source}] 平均¥${avg.toLocaleString()}${onSaleLog}${psa10Log}`)
    stats.succeeded++
  } catch (e) {
    console.log('失敗（既存価格を維持）')
    console.error('  エラー:', e instanceof Error ? e.message : e)
    stats.failed++
  }
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
}

async function scrapeBox(
  browser: Browser,
  id: string,
  searchQuery: string,
  label: string,
  date: string,
  stats: { succeeded: number; skipped: number; failed: number }
) {
  process.stdout.write(`  [${label}] スクレイピング中... `)
  try {
    let avg: number | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      avg = await scrapeMercariSoldAvg(browser, searchQuery)
      if (avg != null) break
      if (attempt < 3) { process.stdout.write(`(データ不足 → リトライ${attempt}/2) `); await new Promise(r => setTimeout(r, 3000)) }
    }
    if (avg == null) { console.log('データ不足 — スキップ'); stats.skipped++; return }
    savePriceHistory(id, date, avg, null, null)
    console.log(`完了 平均¥${avg.toLocaleString()}`)
    stats.succeeded++
  } catch (e) {
    console.log('失敗')
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
    for (const card of cards) {
      const boxName = boxMap.get(card.box_id) ?? ''
      const boxCode = boxCodeMap.get(card.box_id) ?? ''
      const query = `${card.card_name} ${card.rarity} ${boxCode} ${boxName}`.replace(/\s+/g, ' ').trim()
      await scrapeCard(browser, getCardSlug(card), query, `${card.card_name} ${card.rarity}`, date, stats, snkrdunkIds, card.card_name, card.rarity)
    }

    if (boxes.length > 0) {
      console.log('\n── 未開封BOX ──')
      for (const box of boxes) {
        await scrapeBox(browser, `box-${box.box_id}`, `${box.box_name} 未開封 BOX`, `${box.box_name} 未開封BOX`, date, stats)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n完了: ${stats.succeeded}件更新, ${stats.skipped}件スキップ, ${stats.failed}件失敗`)
}

main()
