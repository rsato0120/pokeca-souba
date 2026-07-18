import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'
import type { PriceHistory, PriceSource } from '@/types/pokeca'

const SNKRDUNK_IDS_FILE = path.join(process.cwd(), 'data', 'snkrdunk-ids.json')

function loadSnkrdunkIds(): Record<string, number> {
  try { return JSON.parse(fs.readFileSync(SNKRDUNK_IDS_FILE, 'utf-8')) } catch { return {} }
}

function saveSnkrdunkIds(ids: Record<string, number>): void {
  fs.writeFileSync(SNKRDUNK_IDS_FILE, JSON.stringify(ids, null, 2), 'utf-8')
}

// 安全網: 取りこぼした未処理Promiseリジェクトでバッチ全体を落とさない（1枚の失敗で中断しない）
process.on('unhandledRejection', (reason) => {
  console.error('  [unhandledRejection 無視]', reason instanceof Error ? reason.message : reason)
})

const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(pricesDir, { recursive: true })

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// メルカリ: 出品中（on_sale）の件数＋出品価格分布を取得
// 成約相場（sold_out）と分離することで、急騰（在庫減・出品価格上昇）と
// 急落（在庫増・投げ売り）を区別できるようにする。
interface OnSaleResult {
  count: number | null     // 出品中の総件数（供給圧）
  askLow: number | null    // 出品最安値帯（即購入できる床値・先行指標）
  askMid: number | null    // 出品中央値
}

async function getMercariOnSale(browser: Browser, searchQuery: string, minPrice = 0): Promise<OnSaleResult> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  const keyword = encodeURIComponent(searchQuery)
  // 価格昇順で取得 → meta.numFound で総件数、items で安値帯の出品相場を得る
  const url = `https://jp.mercari.com/search?keyword=${keyword}&status=on_sale&item_types=buy_now&sort=price&order=asc`
  try {
    // .catch を即付与しないと、goto待機中(最大30s)に25sタイムアウトで reject した際
    // 未処理Promiseリジェクトとなり try/catch を素通りしてプロセスごと落ちる
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 25000 }
    ).catch(() => null)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const response = await responsePromise
    if (!response) return { count: null, askLow: null, askMid: null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null
    try { json = await response.json() } catch { return { count: null, askLow: null, askMid: null } }
    if (!json) return { count: null, askLow: null, askMid: null }

    const meta = json.meta ?? json.data?.meta ?? {}
    const rawTotal = meta.numFound ?? meta.total ?? json.numFound ?? json.totalCount
    const count = rawTotal != null && !isNaN(Number(rawTotal)) && Number(rawTotal) > 0 ? Number(rawTotal) : null

    // 出品価格分布（傷あり・ジャンク等を除外し、外れ値を除いた安値帯）
    const rawItems: MercariItem[] = json.items ?? json.data?.items ?? json.result?.items ?? []
    // minPrice: BOXの出品検索が1パック/単品を拾い床値が¥数百に化けるのを防ぐ（カードは既定0で無影響）
    const prices = removeOutliers(
      rawItems.filter(i => !isExcluded(i.name) && Number(i.price) >= Math.max(1, minPrice)).map(i => Number(i.price))
    ).sort((a, b) => a - b)

    let askLow: number | null = null
    let askMid: number | null = null
    if (prices.length >= 3) {
      askLow = prices[Math.floor(prices.length * 0.1)]  // 10thパーセンタイル＝実質的な床値
      askMid = calcMedian(prices)
    }
    return { count, askLow, askMid }
  } catch { return { count: null, askLow: null, askMid: null } }
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
    // rarity は単独トークンとして照合する。includes だと "AR" が "SAR" に、"UR" が "MUR" に
    // 部分一致し別カード(例: 151ピカチュウAR→メガドリームのピカチュウex SAR)を誤取得するため、
    // 前後が英大文字でないことを確認する。
    const rarityRe = new RegExp(`(^|[^A-Z])${rarity}([^A-Z]|$)`)
    const filtered = links.filter(l => l.text.includes(cardName) && rarityRe.test(l.text))
    if (!filtered.length) return null
    const m = filtered[0].href.match(/\/apparels\/(\d+)/)
    return m ? parseInt(m[1]) : null
  } catch { return null }
  finally { await page.close() }
}

// スニーカーダンク: 素体平均価格 + PSA10平均価格を取得
async function getSnkrdunkPrices(browser: Browser, apparelId: number): Promise<{ regular: number | null; regularCount: number; psa10: number | null }> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  try {
    // スニダンはTLSリセット（ERR_CONNECTION_RESET）で間欠的に失敗するため最大4回リトライ
    let text = ''
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await page.goto(`https://snkrdunk.com/apparels/${apparelId}/sales-histories`, {
          waitUntil: 'load', timeout: 20000
        })
        await new Promise(r => setTimeout(r, 2500))  // 動的コンテンツのロード待ち
        text = await page.evaluate(() => document.body.innerText)
        if (text && text.length > 200) break
      } catch {
        if (attempt < 4) await new Promise(r => setTimeout(r, 2000))
      }
    }
    if (!text) return { regular: null, regularCount: 0, psa10: null }

    // PSAセクション開始位置（"状態PSA" か "PSAの売買履歴" のみ。"PSA10"単体は他の箇所に出現しうるため除外）
    const psaMarkers = ['状態PSA', 'PSAの売買履歴', '状態 PSA']
    const psaStart = psaMarkers
      .map(s => text.indexOf(s))
      .filter(i => i >= 0)
      .reduce((min, i) => Math.min(min, i), Infinity)

    // 素体（非PSA）: 状態A〜Dの「売買履歴」テーブル行(日付+状態+金額)だけを対象にする。
    // ページ上部の最安値表示・価格チャートの目盛り・関連商品価格などのノイズや、
    // 古い1件だけの取引でMercariの直近相場を上書きする事故を防ぐため、
    //  (1) 「YYYY/MM/DD 状態 金額」の行パターンに限定（チャートは MM/DD で状態が無いので除外）
    //  (2) 直近90日の取引のみ採用。該当が無ければ null を返し Mercari にフォールバックさせる
    const regularSection = isFinite(psaStart) ? text.slice(0, psaStart) : text
    const REGULAR_WINDOW_DAYS = 90
    const now = Date.now()
    const regularPrices = [...regularSection.matchAll(/(\d{4})\/(\d{2})\/(\d{2})\s+[A-D]\s+(\d{1,3}(?:,\d{3})*)/g)]
      .map(m => ({
        t: Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`),
        p: parseInt(m[4].replace(/,/g, ''), 10),
      }))
      .filter(r => r.p >= 100 && isFinite(r.t) && now - r.t <= REGULAR_WINDOW_DAYS * 86400000)
      .map(r => r.p)
    const regularCount = regularPrices.length
    const regular = regularCount > 0
      ? Math.round(regularPrices.reduce((a, b) => a + b, 0) / regularCount)
      : null

    // PSA10セクション開始位置（"PSA10の" を最低限のパターンとして使用）
    const psa10Patterns = ['状態PSA10の売買履歴', 'PSA10の売買履歴', 'PSA 10の売買履歴', 'PSA10の']
    const psa10Start = psa10Patterns.reduce((acc, s) => acc >= 0 ? acc : text.indexOf(s), -1)

    let psa10: number | null = null
    if (psa10Start >= 0) {
      const psa9Patterns = ['状態PSA9の売買履歴', 'PSA9の売買履歴', 'PSA 9の売買履歴', 'PSA9の']
      const psa9Start = psa9Patterns.reduce((acc, s) => {
        const i = text.indexOf(s, psa10Start + 4)
        return acc >= 0 ? acc : (i > psa10Start ? i : -1)
      }, -1)
      const psa10Section = text.slice(psa10Start, psa9Start > 0 ? psa9Start : psa10Start + 2000)
      const noHistory = ['まだこの商品は取引がありません', '取引がありません', '売買履歴はまだありません']
      if (!noHistory.some(s => psa10Section.includes(s))) {
        const psa10Prices = [...psa10Section.matchAll(/\b(\d{1,3}(?:,\d{3})+)\b/g)]
          .map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p >= 1000)
        psa10 = psa10Prices.length > 0
          ? Math.round(psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length)
          : null
      }
    }

    return { regular, regularCount, psa10 }
  } catch { return { regular: null, regularCount: 0, psa10: null } }
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
interface MercariPriceResult { avg: number; low: number; high: number }

async function scrapeMercariSoldAvg(
  browser: Browser,
  searchQuery: string,
  lowPct = 0.2,
  highPct = 0.8
): Promise<MercariPriceResult | null> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  const keyword = encodeURIComponent(searchQuery)
  const url = `https://jp.mercari.com/search?keyword=${keyword}&status=sold_out&item_types=buy_now&sort=created_time&order=desc`
  try {
    // 同上: 未処理リジェクトでプロセスが落ちるのを防ぐため即 .catch する
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/v2/entities:search') && r.status() === 200,
      { timeout: 20000 }
    ).catch(() => null)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const response = await responsePromise
    if (!response) return null
    const json = await response.json()
    const rawItems: MercariItem[] = json.items ?? json.data?.items ?? json.result?.items ?? []
    const prices = removeOutliers(
      rawItems.filter(i => !isExcluded(i.name) && Number(i.price) > 0).map(i => Number(i.price))
    )
    if (prices.length < 3) return null
    const sorted = [...prices].sort((a, b) => a - b)
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    // 代表的な取引幅（既定 20th〜80th percentile）。BOXは高値テールに引っ張られるので
    // 床値寄りの狭いバンド（例 20th〜35th）を渡して「実際に買える価格帯」を表示する。
    const low = sorted[Math.floor(sorted.length * lowPct)]
    const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * highPct))]
    return { avg, low, high }
  } catch { return null }
  finally { await page.close() }
}

function savePriceHistory(
  cardId: string,
  date: string,
  avg: number,
  low: number,
  high: number,
  onSale: OnSaleResult | null,
  psa10: number | null,
  priceSource?: PriceSource,
  sampleCount?: number
): void {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  let data: PriceHistory = { card_id: cardId, history: [] }
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch {}

  // on_sale品質チェック: 前日比40%未満はIPブロックによる誤値と判定して保存しない
  // （メルカリが同一IPからの大量リクエストをソフトブロックすると numFound が半減する）
  // ONSALE_NO_GATE=1: クエリ基準変更などで前日基準が信頼できない establishing run 用に一度だけゲート無効化
  let validatedOnSale = onSale
  if (onSale?.count != null && process.env.ONSALE_NO_GATE !== '1') {
    const prevRecord = data.history.find(r => r.date !== date)
    const prevOnSale = prevRecord?.on_sale
    if (prevOnSale != null && onSale.count < prevOnSale * 0.6) {
      process.stdout.write(`[on_sale疑わしい: ${onSale.count}件 ← 前回${prevOnSale}件の${Math.round(onSale.count/prevOnSale*100)}%] `)
      validatedOnSale = { count: null, askLow: null, askMid: null }
    }
  }

  const record = {
    date,
    low,
    high,
    avg,
    ...(priceSource ? { source: priceSource } : {}),
    ...(sampleCount != null ? { sample_count: sampleCount } : {}),
    ...(validatedOnSale?.count != null ? { on_sale: validatedOnSale.count } : {}),
    ...(validatedOnSale?.askLow != null ? { ask_low: validatedOnSale.askLow } : {}),
    ...(validatedOnSale?.askMid != null ? { ask_mid: validatedOnSale.askMid } : {}),
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
  rarity: string,
  boxName: string
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
    // ログ用の source とは別に、画面表示用の構造化した出所を保持する
    let priceSource: PriceSource | undefined
    let sampleCount: number | undefined

    // スニダン素体価格は「状態A=新品のみ」で実勢より高め。取引が少数だと新品1件が
    // そのまま相場化して高止まりするため、サンプル数が閾値を超えた時だけ信頼する。
    // 少数サンプル時はメルカリ成約相場（実勢）を優先する。
    const SNKRDUNK_MIN_SAMPLES = 3
    let snkrdunkRegular: number | null = null
    let snkrdunkCount = 0

    if (apparelId) {
      // スニーカーダンクから取得（PSA10は常にスニダン由来）
      const prices = await getSnkrdunkPrices(browser, apparelId)
      snkrdunkRegular = prices.regular
      snkrdunkCount = prices.regularCount
      psa10 = prices.psa10
    }

    let mercariLow = 0, mercariHigh = 0
    if (snkrdunkRegular != null && snkrdunkCount > SNKRDUNK_MIN_SAMPLES) {
      // 十分な取引数があるスニダン価格はそのまま採用
      avg = snkrdunkRegular
      source = 'スニダン'
      priceSource = 'snkrdunk'
      sampleCount = snkrdunkCount
    } else {
      // スニダン無し or 少数サンプル → Mercari sold_out（実勢）でフォールバック
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await scrapeMercariSoldAvg(browser, searchQuery)
        if (result != null) { avg = result.avg; mercariLow = result.low; mercariHigh = result.high; break }
        if (attempt < 3) { process.stdout.write(`(データ不足→リトライ${attempt}) `); await new Promise(r => setTimeout(r, 3000)) }
      }
      source = 'メルカリ'
      priceSource = 'mercari'
      // メルカリ成約も取れなければ、少数でもスニダン価格を使う（無いよりはマシ）
      if (avg == null && snkrdunkRegular != null) {
        avg = snkrdunkRegular
        source = `スニダン(${snkrdunkCount}件)`
        priceSource = 'snkrdunk'
        sampleCount = snkrdunkCount
      }
    }

    if (avg == null) {
      console.log('データ不足 — スキップ（既存価格を維持）')
      stats.skipped++
      await new Promise(r => setTimeout(r, 1000))
      return
    }

    // スニダン取得時は low/high を avg の ±10% で推定
    const low  = mercariLow  || Math.round(avg * 0.90)
    const high = mercariHigh || Math.round(avg * 1.10)

    // 出品中はBOX名込みで検索（BOXコードM2/M4等は除外、BOX名は含めて他弾の同名カードを除外）
    // プロモは一意なカード名のためBOX名不要。英字レアの代わりにカナ「プロモ」で件数を取る
    const onSaleRarity = rarity === 'PROMO' ? 'プロモ' : rarity
    const onSaleQuery = rarity === 'PROMO'
      ? `${cardName} プロモ`
      : `${cardName} ${onSaleRarity} ${boxName}`.replace(/\s+/g, ' ').trim()
    const onSale = await getMercariOnSale(browser, onSaleQuery)
    // Mercari on_saleリクエスト後の追加待機（連続リクエストによるIPブロック緩和）
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000))

    const onSaleLog = onSale.count != null
      ? ` / 出品${onSale.count}件${onSale.askLow != null ? `(最安¥${onSale.askLow.toLocaleString()})` : ''}`
      : ''
    const psa10Log = psa10 != null ? ` / PSA10¥${psa10.toLocaleString()}` : ''
    savePriceHistory(id, date, avg, low, high, onSale, psa10, priceSource, sampleCount)
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
    let boxLow = 0, boxHigh = 0
    for (let attempt = 1; attempt <= 3; attempt++) {
      // BOXは高額な状態良・付属品付き出品が右に長い裾を作るため、床値寄りの 20th〜35th を採用
      const result = await scrapeMercariSoldAvg(browser, searchQuery, 0.2, 0.35)
      if (result != null) { avg = result.avg; boxLow = result.low; boxHigh = result.high; break }
      if (attempt < 3) { process.stdout.write(`(データ不足 → リトライ${attempt}/2) `); await new Promise(r => setTimeout(r, 3000)) }
    }
    if (avg == null) { console.log('データ不足 — スキップ'); stats.skipped++; return }
    // BOXの代表値は「床値バンドの中央」に統一（チャートが描く avg と表示レンジ low〜high を一致させる）。
    // 平均値は高額出品の裾に引っ張られるため BOX相場としては使わない。
    avg = Math.round((boxLow + boxHigh) / 2)
    // 出品中（"1BOX"を外して広めに取得）。床値は成約avgの40%未満（＝1パック/単品）を除外
    const onSaleQuery = searchQuery.replace(' 1BOX', ' BOX')
    const onSale = await getMercariOnSale(browser, onSaleQuery, Math.round(avg * 0.4))
    // BOX相場は常にメルカリ成約の床値バンド由来
    savePriceHistory(id, date, avg, boxLow, boxHigh, onSale, null, 'mercari')
    const onSaleLog = onSale.count != null ? ` / 出品${onSale.count}件` : ''
    console.log(`完了 平均¥${avg.toLocaleString()}${onSaleLog}`)
    stats.succeeded++
  } catch (e) {
    console.log('失敗')
    console.error('  エラー:', e instanceof Error ? e.message : e)
    stats.failed++
  }
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
}

async function main() {
  // 任意の引数で特定BOXだけに絞り込める（例: npx tsx scripts/scrape-prices.ts mega_brave）
  const boxFilter = process.argv[2] || null
  const cards = getAllCards().filter(c => !boxFilter || c.box_id === boxFilter)
  const boxes = getAllBoxes().filter(
    b => b.certainty === 'released' && b.packs_per_box != null && (!boxFilter || b.box_id === boxFilter)
  )
  const boxMap = new Map(getAllBoxes().map(b => [b.box_id, b.box_name]))
  const date = todayJST()
  const scope = boxFilter ? `［${boxFilter}のみ］` : ''
  console.log(`${scope}${cards.length}枚のカード＋${boxes.length}BOXの価格をスクレイピングします（${date} JST）\n`)

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const stats = { succeeded: 0, skipped: 0, failed: 0 }
  const snkrdunkIds = loadSnkrdunkIds()

  try {
    for (const card of cards) {
      const boxName = boxMap.get(card.box_id) ?? ''
      // プロモは card_name（例「トウホクのピカチュウ」）が一意なので box_name/英字レアを付けず
      // カナ「プロモ」だけ添えてヒット件数を確保する（人工box名を付けると0件になる）
      // それ以外: BOXコード（M2/M4等）は出品タイトルに入らないため除外して一致件数を増やす
      const query = card.rarity === 'PROMO'
        ? `${card.card_name} プロモ`
        : `${card.card_name} ${card.rarity} ${boxName}`.replace(/\s+/g, ' ').trim()
      await scrapeCard(browser, getCardSlug(card), query, `${card.card_name} ${card.rarity}`, date, stats, snkrdunkIds, card.card_name, card.rarity, boxName)
    }

    if (boxes.length > 0) {
      console.log('\n── 未開封BOX ──')
      for (const box of boxes) {
        // "1BOX" を明示して複数BOXロットを排除
        await scrapeBox(browser, `box-${box.box_id}`, `${box.box_name} 未開封 1BOX`, `${box.box_name} 未開封BOX`, date, stats)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n完了: ${stats.succeeded}件更新, ${stats.skipped}件スキップ, ${stats.failed}件失敗`)
}

main()
