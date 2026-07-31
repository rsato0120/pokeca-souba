import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'
import { SET_BOXES } from '@/lib/set-boxes'
import { updateExtremes } from '@/lib/extremes'
import type { PriceExtremes, PriceHistory, PriceRecord, PriceSource } from '@/types/pokeca'

const SNKRDUNK_IDS_FILE = path.join(process.cwd(), 'data', 'snkrdunk-ids.json')
const EXTREMES_FILE = path.join(process.cwd(), 'data', 'price-extremes.json')

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

async function getMercariOnSale(browser: Browser, searchQuery: string, minPrice = 0, cardNo: CardNo | null = null): Promise<OnSaleResult> {
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
    const prices = rawItems
      .filter(i => !isExcluded(i.name) && matchesCardNo(i.name, cardNo) && Number(i.price) >= Math.max(1, minPrice))
      .map(i => Number(i.price))
      .sort((a, b) => a - b)

    let askLow: number | null = null
    let askMid: number | null = null
    if (prices.length >= 3) {
      // 成約側と同じ理由でデータ依存のカットオフは使わない。ここは価格昇順で取っているので
      // 上位25%を機械的に落とせば混入（束売り・鑑定品）を外せる。
      // 旧実装（中央値±50%）はカイリューV SA で ask_low が ¥29,300 ⇔ ¥52,222 を日替わりで
      // 往復させ、下の「メルカリ不整合」ガードを誤爆させていた。
      const core = prices.slice(0, Math.max(3, Math.ceil(prices.length * 0.75)))
      askLow = percentileAt(core, 0.1)  // 10thパーセンタイル＝実質的な床値
      askMid = calcMedian(core)
    }
    return { count, askLow, askMid }
  } catch { return { count: null, askLow: null, askMid: null } }
  finally { await page.close() }
}

// スニーカーダンク: apparel_id をカード名+レアリティで検索
async function findSnkrdunkId(browser: Browser, cardName: string, rarity: string, cardNo: CardNo | null): Promise<number | null> {
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
    // ⚠ さらにカード番号でも照合する。スニダンは**SA版のタイトルを「リーフィアV SR: SA」と
    // 表記する**ため、レアリティのトークン照合だけでは "SR" 検索が SA版に一致してしまう。
    // 実例: リーフィアV SR(070) に SA(071) の apparel 91170 が登録され、SRがSAの価格
    // (¥19,514)を表示していた。タイトルには "[S6a 071/069]" と番号が入るのでこれで切り分ける。
    const filtered = links.filter(l =>
      l.text.includes(cardName) && rarityRe.test(l.text) && matchesCardNo(l.text, cardNo)
    )
    if (!filtered.length) return null
    const m = filtered[0].href.match(/\/apparels\/(\d+)/)
    return m ? parseInt(m[1]) : null
  } catch { return null }
  finally { await page.close() }
}

// スニーカーダンク: 素体平均価格 + PSA10平均価格を取得
// fetched: ページ本文を取得できたか。false は「取引が無い」ではなく**通信/レート制限で見えなかった**
// を意味する。この2つを混同すると、取得失敗のたびにメルカリへ乗り換えて系列が方形波になる。
async function getSnkrdunkPrices(browser: Browser, apparelId: number): Promise<{ fetched: boolean; regular: number | null; regularCount: number; psa10: number | null; staleDays: number | null; staleRegular: number | null }> {
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
    if (!text) return { fetched: false, regular: null, regularCount: 0, psa10: null, staleDays: null, staleRegular: null }

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
    // 窓は45日。90日だと相場が動いた銘柄で「1〜2ヶ月前の高値」が平均に残り続ける。
    const REGULAR_WINDOW_DAYS = 45
    // さらに**最新の取引が25日以内**であることを要求する。スニダンは取引が数週間〜数ヶ月
    // 止まる銘柄が普通にあり、止まったまま件数だけ足りているとメルカリの直近実勢を
    // 古い高値で上書きし続ける（レックウザV SR: 最新6/18の¥23,000〜30,000を7/28まで表示。
    // メルカリ直近実勢は¥11,500〜15,555だった）。止まっている系列は相場として使わない。
    const REGULAR_FRESH_DAYS = 25
    const now = Date.now()
    const regularRows = [...regularSection.matchAll(/(\d{4})\/(\d{2})\/(\d{2})\s+[A-D]\s+(\d{1,3}(?:,\d{3})*)/g)]
      .map(m => ({
        t: Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`),
        p: parseInt(m[4].replace(/,/g, ''), 10),
      }))
      .filter(r => r.p >= 100 && isFinite(r.t))
    const newestT = regularRows.length ? Math.max(...regularRows.map(r => r.t)) : null
    const stale = newestT == null || now - newestT > REGULAR_FRESH_DAYS * 86400000
    const regularPrices = stale
      ? []
      : regularRows.filter(r => now - r.t <= REGULAR_WINDOW_DAYS * 86400000).map(r => r.p)
    const regularCount = regularPrices.length
    const regular = regularCount > 0
      ? Math.round(regularPrices.reduce((a, b) => a + b, 0) / regularCount)
      : null
    const regularStaleDays = newestT != null ? Math.floor((now - newestT) / 86400000) : null
    // 止まっている系列でも「直近5件の平均」は最後の手段として持っておく。取引が年に数回しか
    // 無い超高額カード（レックウザVMAX SA 等）はメルカリ側も番号付き成約が薄く、
    // 何も出せないと前日の誤った値が残り続けるため。採用は他が全滅した時だけ。
    const newestFive = [...regularRows].sort((a, b) => b.t - a.t).slice(0, 5).map(r => r.p)
    const staleRegular = newestFive.length
      ? Math.round(newestFive.reduce((a, b) => a + b, 0) / newestFive.length)
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
        // 素体と同じく「YYYY/MM/DD + 金額」の売買履歴行だけを対象にし、直近90日に限る。
        // カンマ区切りの数字を無差別に平均していた頃は、価格チャートの目盛りや関連商品価格も
        // 混ざり、しかも古い取引が永久に平均へ残った（132銘柄中15銘柄でPSA10が1ヶ月以上
        // 1〜2種類の値に張り付いていた）。素体より窓を長く取るのは、鑑定品は取引頻度が
        // 低く45日だと該当ゼロになる銘柄が多いため。
        const PSA10_WINDOW_DAYS = 90
        const psa10Rows = [...psa10Section.matchAll(/(\d{4})\/(\d{2})\/(\d{2})[^\n]*?(\d{1,3}(?:,\d{3})+)/g)]
          .map(m => ({
            t: Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`),
            p: parseInt(m[4].replace(/,/g, ''), 10),
          }))
          .filter(r => r.p >= 1000 && isFinite(r.t) && now - r.t <= PSA10_WINDOW_DAYS * 86400000)
          .map(r => r.p)
        // 行として1件も読めない時だけ従来の「セクション内の数字を平均」に戻す。
        // スニダンのDOMが変わっても PSA10 が一斉に null になって消えることは避ける。
        const psa10Prices = psa10Rows.length > 0
          ? psa10Rows
          : [...psa10Section.matchAll(/\b(\d{1,3}(?:,\d{3})+)\b/g)]
              .map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p >= 1000)
        psa10 = psa10Prices.length > 0
          ? Math.round(psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length)
          : null
      }
    }

    return { fetched: true, regular, regularCount, psa10, staleDays: regularStaleDays, staleRegular }
  } catch { return { fetched: false, regular: null, regularCount: 0, psa10: null, staleDays: null, staleRegular: null } }
  finally { await page.close() }
}

// Mercari sold_out prices（BOX専用フォールバック）
const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/, /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i]

// レアリティ表記をトークンとして数える（"MEGA" の中の "MA" 等に部分一致しないよう境界を見る）
const RARITY_TOKEN_RE = /(?:^|[^A-Za-z])(SAR|SR|AR|UR|RR|MA|HR|MUR)(?![A-Za-z])/g

// 「まとめ売り」を名乗らない複数枚出品を落とす。
//
// 除外キーワード（まとめ/セット/N枚）は "まとめ" と書いてくれる出品しか捕まえられない。実際の
// 汚染はカード名を並べただけのタイトルで入ってくる:
//   ¥999   「シロナのミカルゲ ダーテング トゲデマル ミカルゲ ロケット団のヘルガー」
//   ¥1,560 「なかよしポフィンSR ハイパーボール SR 夜のタンカ SR」
//   ¥24,500「ポケカ 引退品」
//   ¥3,400 「に*@様 ポケモンカードメガドリーム　メガユキメノコex SAR他」
// これらが1枚の相場に混ざると、中央値が実勢の数倍まで押し上げられる。
function looksLikeBundle(title: string): boolean {
  // 引退品＝コレクション一括。単品出品でこの語は使われない
  if (/引退/.test(title)) return true
  // 「○○様専用」＝取り置き。中身が確認できず束の取り置きも多いので相場には使わない
  if (/専用/.test(title)) return true
  // 「…SAR他」「…ex他」＝ and others。末尾の「他」も同じ
  if (/(?:[A-Za-z]|ex|EX|GX|V|VMAX|VSTAR)\s*他/.test(title) || /他\s*$/.test(title)) return true
  // レアリティ表記が3つ以上＝複数カードの列挙
  if ((title.match(RARITY_TOKEN_RE) || []).length >= 3) return true
  // 同じ分母のカード番号が2種類以上＝複数カードの列挙（"1/2の確率"等を拾わないよう分母一致で見る）
  const byTotal = new Map<number, Set<number>>()
  for (const p of extractNoPairs(title)) {
    if (!byTotal.has(p.total)) byTotal.set(p.total, new Set())
    byTotal.get(p.total)!.add(p.no)
  }
  return [...byTotal.values()].some(s => s.size >= 2)
}

function isExcluded(title: string): boolean {
  // 英字キーワード（PSA/BGS/CGC/BOX）は出品タイトルで小文字表記も多い（"psa10 073/067" 等）。
  // 大文字固定で照合していた頃は鑑定品が素体の成約に混入していたため、必ず大文字化して比較する。
  const upper = title.toUpperCase()
  return EXCLUDE_KEYWORDS.some(kw => upper.includes(kw.toUpperCase()))
    || EXCLUDE_PATTERNS.some(re => re.test(title))
    || looksLikeBundle(title)
}

// 出品タイトルに書かれた "073/067" 形式の数字ペアを全て拾う（全角スラッシュ・空白を吸収）。
function extractNoPairs(title: string): Array<{ no: number; total: number }> {
  const out: Array<{ no: number; total: number }> = []
  for (const m of title.matchAll(/(\d{1,3})\s*[/／]\s*(\d{1,3})/g)) {
    out.push({ no: parseInt(m[1], 10), total: parseInt(m[2], 10) })
  }
  return out
}

// 同名カードの別バージョン（SR 073 ⇔ SA 074 など）を番号で切り分ける。
//
// メルカリの出品者は SA(スペシャルアート) にも「SR」と書くことが多く、キーワード検索だけでは
// 分離できない。実例: カイリューV SR(073/067・実勢¥3,000) の検索結果に SA(074/067・¥50,000超) が
// 大量に混ざり、**多数派がSAだったため removeOutliers が本物のSRを外れ値として捨て**、
// SR の相場が ¥44,345（＝SAの値段）になっていた。
//
// 判定は保守的に2段構え:
//   1. 番号が書かれていないタイトルは判別不能として通す（除外しすぎると件数が足りずスキップになる）
//   2. **分母が同じペアだけを「カード番号」とみなす**。分母を見ないと "9/30まで値下げ" のような
//      日付や "1/2" を番号と誤認して正当な出品を落としてしまう。同名別バージョンは必ず同じ弾＝
//      同じ分母なので（SR 073/067 ⇔ SA 074/067）、分母一致だけを対象にすれば取りこぼさない。
//
// ⚠ 例外 = strict モード（同名別番号のカードが同じ弾に存在する時）。
//   上の(1)「番号なしは通す」は**安い同名カードが高額カードを汚染する逆方向**を止められない。
//   実例: レックウザVMAX SA(083/067・素体¥900,000前後) の成約検索に、番号を書いていない
//   HR(082/067・¥24,000〜33,000) の出品が混ざり、平均が ¥343,633 まで引き下げられていた
//   （出品最安 ¥499,999 より安い成約平均＝ありえない状態）。
//   同名の兄弟カードが居るなら「番号が書いてあるタイトルだけ」を採用する。件数が足りなければ
//   スキップ（既存価格を維持）する方が、別カードの値段を出すよりましという判断。
function matchesCardNo(title: string, card: CardNo | null): boolean {
  if (card == null) return true
  const sameSet = extractNoPairs(title).filter(p => p.total === card.total)
  if (sameSet.length === 0) return !card.strict
  return sameSet.some(p => p.no === card.no)
}

interface CardNo { no: number; total: number; strict?: boolean }

// "073/067" → {no:73,total:67}。PROMO の "260/SV-P" など数字/数字でないものは null（照合しない）
function parseCardNo(cardNo: string | undefined): CardNo | null {
  if (!cardNo) return null
  const m = cardNo.match(/^(\d{1,3})\s*[/／]\s*(\d{1,3})$/)
  return m ? { no: parseInt(m[1], 10), total: parseInt(m[2], 10) } : null
}

function calcMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// ⚠ 旧 removeOutliers（中央値の0.5〜1.5倍だけ採用）は使わない。グラフのノコギリ波の真因だった。
//
// 成約検索には必ず高値側の混入（束売り・別バージョン・鑑定品）が残る。混入があると中央値が
// 実勢より上に持ち上がり、その中央値から引いた**下限（中央値×0.5）が実勢の価格帯そのものに
// 刺さる**。するとサンプルが1〜2件入れ替わっただけで中央値がずれ、下限が動き、床値クラスタが
// 丸ごと採用/不採用に切り替わって平均が飛ぶ。
//   実測（ミカルゲAR・実勢¥350前後）: 21件中9件が¥999〜¥7,150の混入。中央値¥599 → 下限¥300 が
//   ¥300の成約6件の上に乗り、2件入れ替えただけで代表値が最大 **78%** 変動した。
//   これが「¥520→¥588→¥492→¥396」と数日おきに同じ値を往復する階段グラフの正体。
//
// 対策＝カットオフをデータ依存にしない。ソート済み配列の**固定パーセンタイル区間**だけを見る。
// 区間の位置は件数にしか依存しないので「崖」が無く、1件の増減では区間が1つずれるだけで済む。
// 混入は常に高値側なので、下寄りの区間を取れば混入の割合が多少変わっても値が動かない。
function percentileAt(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
}

// lo〜hi パーセンタイル区間の平均（実測7銘柄で最悪変動 28.3% → 16.6%）
function sliceMean(prices: number[], loPct: number, hiPct: number): number {
  const sorted = [...prices].sort((a, b) => a - b)
  const i = Math.floor(sorted.length * loPct)
  const j = Math.max(i + 1, Math.min(sorted.length, Math.floor(sorted.length * hiPct) + 1))
  const core = sorted.slice(i, j)
  return Math.round(core.reduce((a, b) => a + b, 0) / core.length)
}

interface MercariItem { id?: string; name: string; price: number; status?: string }
// soldTotal = 成約済みの総件数（meta.numFound）。日々の差分が「1日に何枚売れたか」＝回転率になる。
// 追加リクエストは発生しない（成約相場を取る同じレスポンスの meta を読むだけ）。
interface MercariPriceResult { avg: number; low: number; high: number; soldTotal: number | null; sampleCount: number }

// trimTopPct: low/high を出す前に高値側から機械的に落とす割合。成約検索に残る混入は必ず
// 高値側なので、これが無いと表示レンジの上端が束売り/鑑定品の値になる（ミカルゲAR: 実勢¥362
// なのに上端¥722）。カードは 0.25、BOX は 0（BOXは呼び出し側が中位バンドを指定するため）。
async function scrapeMercariSoldAvg(
  browser: Browser,
  searchQuery: string,
  lowPct = 0.2,
  highPct = 0.6,
    cardNo: CardNo | null = null,
  trimTopPct = 0.25
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
    const meta = json.meta ?? json.data?.meta ?? {}
    const rawSoldTotal = meta.numFound ?? meta.total ?? json.numFound ?? json.totalCount
    const soldTotal = rawSoldTotal != null && !isNaN(Number(rawSoldTotal)) && Number(rawSoldTotal) > 0
      ? Number(rawSoldTotal)
      : null
    const prices = rawItems
      .filter(i => !isExcluded(i.name) && matchesCardNo(i.name, cardNo) && Number(i.price) > 0)
      .map(i => Number(i.price))
    if (prices.length < 3) return null
    const sorted = [...prices].sort((a, b) => a - b)
    // 代表的な取引幅。高値側の混入を機械的に落としてから percentile を取る（データ依存の
    // カットオフではないので「崖」は生まれない）。BOXは呼び出し側が中位バンドを指定する。
    const core = trimTopPct > 0
      ? sorted.slice(0, Math.max(3, Math.ceil(sorted.length * (1 - trimTopPct))))
      : sorted
    // 代表値は 20th〜50th の区間平均。単純平均は高値側の混入をそのまま拾ううえ、
    // 事前の外れ値除去にデータ依存のカットオフを使うと採用集合が日替わりで総入れ替えになる
    // （sliceMean のコメント参照）。BOX はこの avg を (low+high)/2 で上書きするので影響しない。
    const avg = sliceMean(sorted, 0.2, 0.5)
    const low = Math.min(percentileAt(core, lowPct), avg)
    const high = Math.max(percentileAt(core, highPct), avg)
    return { avg, low, high, soldTotal, sampleCount: prices.length }
  } catch { return null }
  finally { await page.close() }
}

// 当日より前の最新レコード。出所のヒステリシス判定に使う
function readLatestRecord(cardId: string, date: string): PriceRecord | null {
  try {
    const data: PriceHistory = JSON.parse(fs.readFileSync(path.join(pricesDir, `${cardId}.json`), 'utf-8'))
    return data.history.find(r => r.date !== date) ?? null
  } catch { return null }
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
  sampleCount?: number,
  soldTotal?: number | null
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
    ...(soldTotal != null ? { sold_total: soldTotal } : {}),
    ...(validatedOnSale?.count != null ? { on_sale: validatedOnSale.count } : {}),
    ...(validatedOnSale?.askLow != null ? { ask_low: validatedOnSale.askLow } : {}),
    ...(validatedOnSale?.askMid != null ? { ask_mid: validatedOnSale.askMid } : {}),
    ...(psa10 != null ? { psa10 } : { psa10: null }),
  }

  // 極値は履歴から落ちる前に別ファイルへ退避する（更新前の1つ前のレコードをノイズ判定に使う）
  const prevRecord = data.history.find(r => r.date !== date) ?? null

  const idx = data.history.findIndex(r => r.date === date)
  if (idx >= 0) data.history[idx] = record
  else data.history.push(record)

  data.history.sort((a, b) => b.date.localeCompare(a.date))
  // 90日ローリング。チャートの「90日」タブが実データで埋まる長さに合わせている
  data.history = data.history.slice(0, 90)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')

  saveExtremes(cardId, record, prevRecord)
}

// 全期間の高値・安値（data/price-extremes.json）。1件ずつ read-modify-write するが
// 数十KBのファイルなので実行時間には影響しない。カード毎に確定させることで
// スクレイプが途中で落ちても取得済み分が残る。
function saveExtremes(cardId: string, record: PriceRecord, prevRecord: PriceRecord | null): void {
  let all: Record<string, PriceExtremes> = {}
  try { all = JSON.parse(fs.readFileSync(EXTREMES_FILE, 'utf-8')) } catch {}

  const next = updateExtremes(all[cardId] ?? null, record, prevRecord)
  if (!next) return

  all[cardId] = next
  fs.writeFileSync(EXTREMES_FILE, JSON.stringify(all, null, 2) + '\n', 'utf-8')
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
  boxName: string,
    cardNo: CardNo | null
) {
  process.stdout.write(`  [${label}] スクレイピング中... `)
  try {
    // スニーカーダンクIDを検索
    let apparelId: number | null = snkrdunkIds[id] ?? null
    if (!apparelId) {
      apparelId = await findSnkrdunkId(browser, cardName, rarity, cardNo)
      // 同じ apparel_id が既に別カードに使われていたら採用しない。1つのIDが2枚に
      // 割り当たると必ず片方が別カードの価格を表示する（リーフィアV SR/SA の事故）。
      const owner = apparelId != null
        ? Object.entries(snkrdunkIds).find(([otherId, v]) => v === apparelId && otherId !== id)?.[0]
        : undefined
      if (owner) {
        process.stdout.write(`[スニダンID${apparelId}は${owner}が使用中→不採用] `)
        apparelId = null
      } else if (apparelId) {
        snkrdunkIds[id] = apparelId
        saveSnkrdunkIds(snkrdunkIds)
      }
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
    //
    // 閾値はヒステリシスを持たせる。単一閾値だと90日窓の取引件数が境界を跨ぐたびに
    // 出典がスニダン⇔メルカリで入れ替わり、両者の水準差(安価帯で2〜3倍)がそのまま
    // 価格の段差・1日だけのヒゲとしてグラフに出る。新規採用は厳しく、維持は緩く。
    const SNKRDUNK_ADOPT_SAMPLES = 6   // メルカリ→スニダンに乗り換えるのに必要な件数
    const SNKRDUNK_KEEP_SAMPLES = 4    // すでにスニダン採用中の時に維持できる件数
    // スニダンは手数料込み表示かつ最低取引価格の影響で、安価帯の素体が ¥1,000 前後に
    // 張り付く（メルカリ実勢 ¥350〜700 の2〜3倍）。この価格帯の素体は相場として使わない。
    const SNKRDUNK_MIN_PRICE = 1500
    let snkrdunkRegular: number | null = null
    let snkrdunkCount = 0
    // 鮮度切れのスニダン値。メルカリも取れなかった時の最後の手段としてだけ使う
    let snkrdunkStale: number | null = null
    let snkrdunkStaleDays: number | null = null
    let snkrdunkFetched = false

    if (apparelId) {
      // スニーカーダンクから取得（PSA10は常にスニダン由来）
      const prices = await getSnkrdunkPrices(browser, apparelId)
      snkrdunkFetched = prices.fetched
      snkrdunkRegular = prices.regular
      snkrdunkCount = prices.regularCount
      psa10 = prices.psa10
      snkrdunkStale = prices.staleRegular
      snkrdunkStaleDays = prices.staleDays

      // 取引が止まっている系列は getSnkrdunkPrices が regular=null を返す。何日止まって
      // いたかをログに出す（メルカリに落ちた理由が「取引無し」か「件数不足」か判別するため）
      if (prices.regular == null && prices.staleDays != null) {
        process.stdout.write(`[スニダン最新取引${prices.staleDays}日前→不採用] `)
      }

      if (snkrdunkRegular != null && snkrdunkRegular < SNKRDUNK_MIN_PRICE) {
        process.stdout.write(`[スニダン床値¥${snkrdunkRegular}→不採用] `)
        snkrdunkRegular = null
        snkrdunkCount = 0
      }
    }

    // 前回の出所。ヒステリシスの基準に使う（2026-07-18 以前のレコードには source が無い）
    const prevRecordForSource = readLatestRecord(id, date)
    const prevSource = prevRecordForSource?.source
    const snkrdunkNeeded = prevSource === 'snkrdunk' ? SNKRDUNK_KEEP_SAMPLES : SNKRDUNK_ADOPT_SAMPLES

    // スニダンの**取得自体が失敗**した時は、メルカリに乗り換えずその日を見送る。
    // 件数ヒステリシス（ADOPT/KEEP）は「取引件数が減った時」しか守っておらず、TLSリセットや
    // レート制限でページが空になると regular=null → 無条件でメルカリへ落ちていた。スニダン基準と
    // メルカリ基準は水準が違うため、これが数日おきの出所フリップ＝方形波になっていた
    // （トウコSR: ¥2,617 ⇔ ¥2,430 を7日で3往復、Nの筋書きSAR: 8日で3往復）。
    // ただし恒久的に取得できなくなった場合に値が凍り付かないよう、直近レコードが3日以内の時だけ見送る。
    // 「取得できなかった」は2通りある。ページ本文が空(fetched=false)と、**ページは返ったのに
    // 売買履歴の行が1つも読めない**(regularCount=0 かつ staleDays=null＝日付行ゼロ)。後者は
    // ソフトなレート制限で起きる。昨日まで36〜46件あった銘柄の履歴が突然0件になるのは実態では
    // ありえないので、前日がスニダン由来ならこれも取得失敗として扱う
    // （リーリエの決心SAR: n=36 → 翌日0件でメルカリへ落ち ¥26,141→¥21,533 の偽の下落が出た）。
    const snkrdunkBlocked = !snkrdunkFetched || (snkrdunkCount === 0 && snkrdunkStaleDays == null && snkrdunkRegular == null)
    if (apparelId && snkrdunkBlocked && prevSource === 'snkrdunk') {
      const prevDate = prevRecordForSource?.date
      const ageDays = prevDate ? Math.round((Date.parse(date) - Date.parse(prevDate)) / 86400000) : 99
      if (ageDays <= 3) {
        console.log(`スニダン取得失敗 — スキップ（既存価格を維持・出所フリップ回避）`)
        stats.skipped++
        return
      }
    }

    let mercariLow = 0, mercariHigh = 0
    // スニダン採用時はメルカリ成約検索を行わないので soldTotal は取れない（追加リクエストは避ける）
    let soldTotal: number | null = null
    if (snkrdunkRegular != null && snkrdunkCount >= snkrdunkNeeded) {
      // 十分な取引数があるスニダン価格はそのまま採用
      avg = snkrdunkRegular
      source = 'スニダン'
      priceSource = 'snkrdunk'
      sampleCount = snkrdunkCount
    } else {
      // スニダン無し or 少数サンプル → Mercari sold_out（実勢）でフォールバック
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await scrapeMercariSoldAvg(browser, searchQuery, 0.2, 0.6, cardNo)
        if (result != null) {
          avg = result.avg; mercariLow = result.low; mercariHigh = result.high; soldTotal = result.soldTotal
          // メルカリ由来でも件数を残す。これが無いと「何件の成約で出した値か」が後から検証できず、
          // 監査で薄いサンプルの跳ねと本物の相場変動を切り分けられなかった。
          sampleCount = result.sampleCount
          break
        }
        if (attempt < 3) { process.stdout.write(`(データ不足→リトライ${attempt}) `); await new Promise(r => setTimeout(r, 3000)) }
      }
      source = 'メルカリ'
      priceSource = 'mercari'
      // メルカリ成約も取れなければ、少数でもスニダン価格を使う（無いよりはマシ）
      // フォールバックは「前日の2倍を超える値」を出さない。番号必須化でメルカリ件数が
      // 足りないと、安価カードがスニダンの手数料込み床値(¥1,500〜1,700)に跳ね上がる
      // （メガズルズキンex MA: 実勢¥549 → スニダン¥1,640＝+199%）。フォールバック元より
      // 桁が変わる値を採るくらいなら、既存価格を維持してスキップする方がまし。
      // ⚠ 上下**両方向**を見る。以前は上振れ（>2倍）しか止めておらず、フォールバックで
      // 半値以下に落ちる方は素通りしていた。出所が変わって水準が変わっただけの値を
      // 「暴落」としてグラフに刻んでしまうため、桁が変わる時は既存価格を維持する。
      const prevAvg = readLatestRecord(id, date)?.avg ?? null
      const tooFarForFallback = (v: number) => prevAvg != null && (v > prevAvg * 2 || v < prevAvg * 0.5)
      if (avg == null && snkrdunkRegular != null && !tooFarForFallback(snkrdunkRegular)) {
        avg = snkrdunkRegular
        source = `スニダン(${snkrdunkCount}件)`
        priceSource = 'snkrdunk'
        sampleCount = snkrdunkCount
      }
      // 最後の手段: 鮮度切れのスニダン直近5件平均。年に数回しか動かない超高額カードは
      // メルカリ側も番号付き成約が薄く、ここが無いと前日の誤った値が居座り続ける
      if (avg == null && snkrdunkStale != null && snkrdunkStale >= SNKRDUNK_MIN_PRICE && !tooFarForFallback(snkrdunkStale)) {
        avg = snkrdunkStale
        source = `スニダン(鮮度切れ${snkrdunkStaleDays}日前)`
        priceSource = 'snkrdunk'
        sampleCount = undefined
      }
    }

    if (avg == null) {
      console.log('データ不足 — スキップ（既存価格を維持）')
      stats.skipped++
      await new Promise(r => setTimeout(r, 1000))
      return
    }

    // 出品中はBOX名込みで検索（BOXコードM2/M4等は除外、BOX名は含めて他弾の同名カードを除外）
    // プロモは一意なカード名のためBOX名不要。英字レアの代わりにカナ「プロモ」で件数を取る
    const onSaleRarity = rarity === 'PROMO' ? 'プロモ' : rarity
    const onSaleQuery = rarity === 'PROMO'
      ? `${cardName} プロモ`
      : `${cardName} ${onSaleRarity} ${boxName}`.replace(/\s+/g, ' ').trim()
    const onSale = await getMercariOnSale(browser, onSaleQuery, 0, cardNo)
    // Mercari on_saleリクエスト後の追加待機（連続リクエストによるIPブロック緩和）
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000))

    // メルカリ成約検索は同名の別バージョン（通常版⇔SR⇔SA）を拾うことがあり、実勢から
    // 桁違いにずれる。出品価格帯と突き合わせて明らかに整合しない成約平均は採用しない。
    // 出品最安を恒常的に上回る成約も、その半値以下で売れ続けることも市場論理として無いため。
    // 基準は**出品中央値(askMid)**を優先する。askLow は10thパーセンタイル＝1件の投げ売りで
    // 動くため、正常なカードを何日も連続でスキップさせていた（ブースターV SR: 成約¥5,083 vs
    // 出品最安¥1,999＝2.54倍で誤爆、カイリューV SR は3日連続スキップ＋削除で8日の欠測に）。
    // 別バージョン混入そのものは matchesCardNo で塞いだので、ここは桁違いだけを止める最後の網。
    const askRef = onSale.askMid ?? onSale.askLow
    const askRefLabel = onSale.askMid != null ? '出品中央値' : '出品最安'
    const [ratioLo, ratioHi] = onSale.askMid != null ? [0.4, 2.2] : [0.5, 2.5]
    if (priceSource === 'mercari' && askRef != null && avg != null) {
      const askRatio = avg / askRef
      if (askRatio > ratioHi || askRatio < ratioLo) {
        const detail = `成約¥${avg.toLocaleString()} vs ${askRefLabel}¥${askRef.toLocaleString()}`
        if (snkrdunkRegular != null) {
          process.stdout.write(`[メルカリ不整合(${detail})→スニダン${snkrdunkCount}件] `)
          avg = snkrdunkRegular
          mercariLow = 0; mercariHigh = 0
          source = `スニダン(${snkrdunkCount}件)`
          priceSource = 'snkrdunk'
          sampleCount = snkrdunkCount
        } else {
          console.log(`メルカリ不整合(${detail}) — スキップ（既存価格を維持）`)
          stats.skipped++
          return
        }
      }
    }

    // スニダン取得時は low/high を avg の ±10% で推定
    const low  = mercariLow  || Math.round(avg * 0.90)
    const high = mercariHigh || Math.round(avg * 1.10)

    const onSaleLog = onSale.count != null
      ? ` / 出品${onSale.count}件${onSale.askLow != null ? `(最安¥${onSale.askLow.toLocaleString()})` : ''}`
      : ''
    const psa10Log = psa10 != null ? ` / PSA10¥${psa10.toLocaleString()}` : ''
    savePriceHistory(id, date, avg, low, high, onSale, psa10, priceSource, sampleCount, soldTotal)
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
    let soldTotal: number | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      // BOXの代表値は成約分布の中位バンド 35th〜65th（＝中央値まわり）を採用する。
      // 以前は床値寄りの 20th〜35th だったが、これは「高額な状態良・付属品付き出品の裾」を
      // 避ける目的に対して行き過ぎで、古い高額弾を系統的に安く表示していた
      // （例 タッグボルト: 実勢中央値¥380,000に対し表示¥231,000＝-34%）。
      // 高値テールは removeOutliers（中央値の0.5〜1.5倍のみ採用）が既に落としているので、
      // 中位バンドでも「高すぎ」側には戻らない。
      // trimTopPct=0: BOXは中位バンド(35-65th)を明示的に取るので、追加の高値カットはしない
      // （2026-07-27 に床値バンドから中位バンドへ戻した経緯があり、二重に下げてはいけない）
      const result = await scrapeMercariSoldAvg(browser, searchQuery, 0.35, 0.65, null, 0)
      if (result != null) {
        avg = result.avg; boxLow = result.low; boxHigh = result.high; soldTotal = result.soldTotal
        break
      }
      if (attempt < 3) { process.stdout.write(`(データ不足 → リトライ${attempt}/2) `); await new Promise(r => setTimeout(r, 3000)) }
    }
    if (avg == null) { console.log('データ不足 — スキップ'); stats.skipped++; return }
    // BOXの代表値は「中位バンドの中央」に統一（チャートが描く avg と表示レンジ low〜high を一致させる）。
    // 単純平均は高額出品の裾に引っ張られるため BOX相場としては使わない。
    avg = Math.round((boxLow + boxHigh) / 2)
    // 出品中（"1BOX"を外して広めに取得）。床値は成約avgの40%未満（＝1パック/単品）を除外
    const onSaleQuery = searchQuery.replace(' 1BOX', ' BOX')
    const onSale = await getMercariOnSale(browser, onSaleQuery, Math.round(avg * 0.4))
    // BOX相場は常にメルカリ成約の中位バンド由来
    savePriceHistory(id, date, avg, boxLow, boxHigh, onSale, null, 'mercari', undefined, soldTotal)
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
  // 任意の引数で特定BOXだけに絞り込める（例: npx tsx scripts/scrape-prices.ts mega_brave）。
  // scrape-psa-only.ts と同じく cardId / card接頭辞も受け付ける
  // （例: 新弾で数枚だけ「データ不足」になった時のリトライ）。BOXは box_id 一致の時だけ対象。
  const boxFilter = process.argv[2] || null
  // BOX_ONLY=1 でカードを飛ばし未開封BOX系列だけ取得する（代表値の算出方式を変えた直後など、
  // BOXだけ establishing run を回したい時に使う。カード257枚の再取得を避けられる）
  const boxOnly = process.env.BOX_ONLY === '1'
  const cards = boxOnly
    ? []
    : getAllCards().filter(c => !boxFilter || c.box_id === boxFilter || c.id === boxFilter || c.id.startsWith(boxFilter))
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

  // 同じ弾に同名カードが複数ある(SR/SA/HR等)なら、そのカード群は番号必須で照合する。
  // 番号なしタイトルを通すと、安い方が高い方を（またはその逆で）汚染するため。
  const siblingCount = new Map<string, number>()
  for (const card of getAllCards()) {
    const key = `${card.box_id}|${card.card_name}`
    siblingCount.set(key, (siblingCount.get(key) ?? 0) + 1)
  }
  const cardNoFor = (card: { box_id: string; card_name: string; card_no?: string }): CardNo | null => {
    const no = parseCardNo(card.card_no)
    if (!no) return null
    return { ...no, strict: (siblingCount.get(`${card.box_id}|${card.card_name}`) ?? 0) > 1 }
  }

  try {
    for (const card of cards) {
      const boxName = boxMap.get(card.box_id) ?? ''
      // プロモは card_name（例「トウホクのピカチュウ」）が一意なので box_name/英字レアを付けず
      // カナ「プロモ」だけ添えてヒット件数を確保する（人工box名を付けると0件になる）
      // それ以外: BOXコード（M2/M4等）は出品タイトルに入らないため除外して一致件数を増やす
      const query = card.rarity === 'PROMO'
        ? `${card.card_name} プロモ`
        : `${card.card_name} ${card.rarity} ${boxName}`.replace(/\s+/g, ' ').trim()
      await scrapeCard(browser, getCardSlug(card), query, `${card.card_name} ${card.rarity}`, date, stats, snkrdunkIds, card.card_name, card.rarity, boxName, cardNoFor(card))
    }

    if (boxes.length > 0) {
      console.log('\n── 未開封BOX ──')
      for (const box of boxes) {
        // 混在系列（後方互換・予想の入力・変異ファイルが無い間のフォールバック表示に使う）
        // "1BOX" を明示して複数BOXロットを排除
        await scrapeBox(browser, `box-${box.box_id}`, `${box.box_name} 未開封 1BOX`, `${box.box_name} 未開封BOX`, date, stats)
        // シュリンクあり/なしを分けて取得（相場が別物なので混ぜると実勢とズレる）。
        // Mercari はキーワードをトークンAND照合するので「シュリンク付き」/「シュリンクなし」で分離できる。
        await scrapeBox(browser, `box-${box.box_id}-shrink`, `${box.box_name} 未開封 シュリンク付き 1BOX`, `${box.box_name} シュリンクあり`, date, stats)
        await scrapeBox(browser, `box-${box.box_id}-noshrink`, `${box.box_name} 未開封 シュリンクなし 1BOX`, `${box.box_name} シュリンクなし`, date, stats)
      }
    }

    // ── セット商品（ポケセン等）: パックBOXではなく“セット”の相場を地域ごとに取得 ──
    const setBoxEntries = Object.entries(SET_BOXES).filter(([boxId]) => !boxFilter || boxId === boxFilter)
    if (setBoxEntries.length > 0) {
      console.log('\n── セット商品（スペシャルBOX等） ──')
      for (const [boxId, products] of setBoxEntries) {
        for (const p of products) {
          await scrapeBox(browser, `box-${boxId}-${p.setId}`, p.query, `${boxMap.get(boxId) ?? boxId} ${p.label}セット`, date, stats)
        }
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n完了: ${stats.succeeded}件更新, ${stats.skipped}件スキップ, ${stats.failed}件失敗`)
}

main()
