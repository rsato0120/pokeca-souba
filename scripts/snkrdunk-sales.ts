import type { Browser } from 'playwright'

/**
 * スニダンの**公式売買履歴API**から、日別の成約件数を取る。
 *
 * 【なぜHTMLをやめたか】
 * これまでは /apparels/{id}/sales-histories の描画テキストを正規表現で読んでいたが、
 * ページに載るのは直近の十数件だけで、しかも当日・前日は「3時間前」「1日前」の相対表示。
 * そのため sales_by_day は歯抜けで、**直近7日に成約日を持つカードは556枚中213枚(38%)**、
 * 未開封BOXに至っては61系列すべてゼロだった。出来高グラフが成立しない原因がこれ。
 *
 * APIは1リクエストで最大1000件、`date` が "2026/08/25" の絶対表記で返る。
 *   GET /v1/apparels/{id}/sales-history?page=1&per_page=1000&condition_id=22
 *   → { history: [{ price, date, condition, label }] }
 * 実測(2026-08-30・ブラッキーex SAR 455596 / 2026-08-25):
 *   A 3件(¥57,000/57,000/66,000) + D 1件(¥44,000) + PSA10 9件(¥95,500〜98,000) = 13件
 *
 * ⚠ 取れるのは**取引成立件数**であって枚数ではない。`size` が空でセット取引を判別できないため、
 *   「13件売れた」とは言えても「13枚売れた」とは断定できない。
 * ⚠ 当日・前日は相対表記のまま返ることがある。以前はその行を捨てていたため、
 *   今日・昨日の成約数が常に欠落していた。現在は取得時刻からJSTの暦日に直して暫定集計し、
 *   APIが絶対日付を返すようになった後の観測で確定させる。
 */

/** 素体（状態A〜D）。ここだけを「素体の成約」として数える */
export const RAW_CONDITION_IDS = [18, 19, 20, 21] as const
/** PSA10 単独。鑑定品の中でも相場を見るのはここ */
export const PSA10_CONDITION_ID = 22

const PER_PAGE = 1000

interface SaleRow { price: number; date: string; condition: string; size?: string }

/** "2026/08/25" / "8時間前" / "1日前" をJSTの暦日に直す。 */
export function parseSnkrdunkSaleDate(raw: string, nowMs = Date.now()): string | null {
  const value = raw.trim()
  const absolute = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value)
  if (absolute) return `${absolute[1]}-${absolute[2]}-${absolute[3]}`

  const relative = /^(\d+)(分|時間|日)前$/.exec(value)
  if (!relative) return null
  const amount = Number(relative[1])
  const unitMs = relative[2] === '日'
    ? 86400000
    : relative[2] === '時間'
      ? 3600000
      : 60000
  // Date#toISOString はUTC表記なので、9時間足してJSTの暦日部分を得る。
  return new Date(nowMs - amount * unitMs + 9 * 3600000).toISOString().slice(0, 10)
}

async function fetchPage(
  browser: Browser,
  apparelId: number,
  conditionId: number | null,
  page: number,
): Promise<SaleRow[] | null> {
  const p = await browser.newPage()
  try {
    // conditionId が null の時は付けない（未開封BOXは状態の概念が無く、
    //  付けても無視されるうえ、状態ごとに引くと同じ取引を重複して数えてしまう）
    const url = `https://snkrdunk.com/v1/apparels/${apparelId}/sales-history`
      + `?page=${page}&per_page=${PER_PAGE}`
      + (conditionId == null ? '' : `&condition_id=${conditionId}`)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
        if (!res) continue
        const json = JSON.parse(await res.text()) as { history?: SaleRow[] }
        return json.history ?? []
      } catch {
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000))
      }
    }
    return null
  } finally { await p.close() }
}

/**
 * 指定した状態群の成約日を集める。`sinceDays` より古い日に到達したら打ち切る。
 * 返すのは「1取引1要素」の日付配列（既存の mergeSalesByDay がそのまま受け取れる形）。
 */
async function collectDates(
  browser: Browser,
  apparelId: number,
  conditionIds: readonly number[],
  sinceDays: number,
  nowMs: number,
): Promise<{ date: string; price: number }[]> {
  const cutoff = nowMs - sinceDays * 86400000

  // ⚠ 状態ごとに**並列**で取る（2026-08-30）。直列にすると1枚あたり5リクエスト×待機で
  //   10秒近くかかり、メルカリを省いて浮いた時間をここで食い潰していた。
  //   同時に開くのは1枚あたり最大5ページで、カード間は従来どおり間隔を空けている。
  const perCondition = await Promise.all(conditionIds.map(async cid => {
    const rows: { date: string; price: number }[] = []
    for (let page = 1; page <= 5; page++) {
      const got = await fetchPage(browser, apparelId, cid, page)
      if (got == null) break        // 取得失敗。その状態は諦める（0件と区別できないので足さない）
      let reachedOld = false
      for (const r of got) {
        const d = parseSnkrdunkSaleDate(r.date, nowMs)
        if (d == null) continue
        if (Date.parse(d) < cutoff) { reachedOld = true; continue }
        rows.push({ date: d, price: Number(r.price) })
      }
      // 1ページ目で古い日に届いた or 1000件未満＝続きが無い
      if (reachedOld || got.length < PER_PAGE) break
      await new Promise(r => setTimeout(r, 300))
    }
    return rows
  }))

  return perCondition.flat()
}
export interface SnkrdunkSales {
  /** 素体（A〜D）の成約日。1取引1要素 */
  regular: string[]
  /** PSA10 の成約日。1取引1要素 */
  psa10: string[]
  /** 素体の成約（日付＋価格）。価格の算出に使う。新しい順ではなくAPIの返り順 */
  regularSales: { date: string; price: number }[]
  /** PSA10 の成約（日付＋価格） */
  psa10Sales: { date: string; price: number }[]
}

/** 指定日数以内の成約価格だけを取り出す（価格算出の窓） */
export function salesWithin(
  sales: { date: string; price: number }[],
  days: number,
  today = new Date().toISOString().slice(0, 10),
): number[] {
  const cutoff = Date.parse(today) - days * 86400000
  return sales
    .filter(s => Date.parse(s.date) >= cutoff && s.price > 0)
    .map(s => s.price)
}

/**
 * ⚠ リクエスト数に注意。素体4状態 + PSA10 = 5リクエスト/枚が最低ライン。
 *   471枚に毎日かけると約2,400リクエストになるので、日次では sinceDays を短くして
 *   1ページで済ませる（1000件/ページなので通常は1ページで足りる）。
 */
export async function getSnkrdunkSales(
  browser: Browser,
  apparelId: number,
  sinceDays = 120,
): Promise<SnkrdunkSales> {
  // 5状態の並列リクエストが日付境界をまたいでも、全行を同じ基準時刻で集計する。
  const nowMs = Date.now()
  const [regularSales, psa10Sales] = await Promise.all([
    collectDates(browser, apparelId, RAW_CONDITION_IDS, sinceDays, nowMs),
    collectDates(browser, apparelId, [PSA10_CONDITION_ID], sinceDays, nowMs),
  ])
  return {
    regular: regularSales.map(s => s.date),
    psa10: psa10Sales.map(s => s.date),
    regularSales,
    psa10Sales,
  }
}

/**
 * 価格を作る窓を「必要な件数が集まる**最短**の期間」にする。
 *
 * 【なぜ固定窓ではだめか】
 * HTMLから読んでいた頃のスニダン価格は仕様上は45日窓だったが、ページに載るのは直近の
 * 数十件だけなので、流動性の高いカードでは実質「直近数日の平均」として働いていた。
 * APIに替えて素直に45日を平均したところ、スタートデッキ100 ピカチュウex SAR が
 * ¥135,196(n=56) → ¥177,428(n=262) と **+31%** ずれた。値が下がっている最中のカードで、
 * 45日前の高い約定を等しく混ぜてしまうため。相場として出す数字がこれでは遅すぎる。
 *
 * そこで新しい順に取り、`targetCount` に届いた時点で打ち切る（`maxDays` が上限）。
 *  - 流動的なカード … 窓が数日に縮み、現在の水準を追える
 *  - 薄商いのカード … 窓が maxDays いっぱいに伸び、件数を確保できる（HTML経路と同じ）
 *
 * ⚠ 打ち切りは**日単位**で行う。件数ちょうどで切ると、同じ日の約定を安い方から数件だけ
 *   拾って高い方を捨てる（APIの返り順に依存する）といった偏りが入る。
 */
export function recentSalesWindow(
  sales: { date: string; price: number }[],
  maxDays: number,
  targetCount: number,
  today = new Date().toISOString().slice(0, 10),
): { prices: number[]; days: number } {
  const cutoff = Date.parse(today) - maxDays * 86400000
  const usable = sales.filter(s => s.price > 0 && Date.parse(s.date) >= cutoff)
  if (usable.length === 0) return { prices: [], days: 0 }

  // 日ごとにまとめて、新しい日から足していく
  const byDay = new Map<string, number[]>()
  for (const s of usable) {
    const arr = byDay.get(s.date)
    if (arr) arr.push(s.price)
    else byDay.set(s.date, [s.price])
  }
  const days = [...byDay.keys()].sort().reverse()

  const prices: number[] = []
  let oldest = days[0]
  for (const d of days) {
    prices.push(...byDay.get(d)!)
    oldest = d
    if (prices.length >= targetCount) break
  }
  const span = Math.round((Date.parse(today) - Date.parse(oldest)) / 86400000) + 1
  return { prices, days: span }
}

// ─────────────────────────────────────────────────────────────
// 未開封BOX用
// ─────────────────────────────────────────────────────────────
//
// BOXはシングルカードと**APIの振る舞いが違う**。実測(2026-08-30・アビスアイBOX 806644):
//
//  1. `condition_id` が**無視される**。18/19/22/2/3 のどれを渡しても同じ履歴が返り、
//     各行の `condition` は空文字。未開封BOXに状態の概念が無いため。
//     ⚠ カードと同じく4状態＋PSA10を足すと **同じ取引を5回数える**ことになる。必ず1回だけ引く。
//  2. `per_page` が効かず **1ページ20件固定**。1000を渡しても20件。
//     45日分を集めるには page を送る必要がある（実測: page=10 で8日前に到達）。
//  3. 直近3日ほどが「4時間前」「1日前」の**相対表記**で返る。
//     シングルでは相対表記を捨てているが、BOXは1ページが浅いので捨てると直近が丸ごと欠ける。
//     ここでは暦日に落として採る（HTML経路の parseSnkrdunkSaleDate と同じ扱い）。
//     ⚠ 「1日前」は24〜48時間前を指し2つの暦日にまたがるので、当日近辺の件数は暫定値。
//        mergeSalesByDay が日ごとに max を取るので、翌日以降に絶対日付で確定する。

const BOX_PER_PAGE = 20
/** 何ページまで遡るか。20件/ページなので、よく売れるBOXでも2〜3週間分は入る */
const BOX_MAX_PAGES = 40

/** "4時間前" / "1日前" / "2026/08/25" を JST の暦日に落とす */
function toIsoDateLoose(raw: string, nowMs: number): string | null {
  const s = raw.trim()
  const abs = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s)
  if (abs) return `${abs[1]}-${abs[2]}-${abs[3]}`
  const rel = /^(\d{1,2})(分|時間|日)前$/.exec(s)
  if (!rel) return null
  const n = parseInt(rel[1], 10)
  const ms = rel[2] === '日' ? n * 86400000 : rel[2] === '時間' ? n * 3600000 : n * 60000
  return new Date(nowMs - ms + 9 * 3600000).toISOString().slice(0, 10)
}

export interface BoxSale {
  date: string
  /** **1箱あたり**の価格（ロット取引は price / lot に割ってある） */
  unitPrice: number
  /** その取引で動いた箱数。size '4個' なら 4 */
  lot: number
}

export interface BoxSales {
  /** 成約。1取引1要素。新しい順 */
  sales: BoxSale[]
  /** 取得しきったか（false＝ページ上限で打ち切った＝もっと古い取引がある） */
  complete: boolean
}

/**
 * BOXの `size` は**ロット数**で、`price` はそのロットの**合計額**。
 * 実測(アビスアイ通常BOX 806644・2026-08-30): 1個 ¥8,000〜8,900 ／ 2個 ¥17,500 ／
 * 4個 ¥36,480 ／ 5個 ¥45,000。1個あたりに直すと全部 ¥8,700〜9,200 に揃う。
 * 割らずに平均すると ¥30,345 になり、実勢 ¥8,884 の3.4倍という別物になる。
 * ⚠ シングルカードは size が常に空文字なのでこの処理は要らない（カード側は素通し）。
 */
function parseLot(size: string | undefined): number {
  const m = /^(\d+)個$/.exec((size ?? '').trim())
  const n = m ? parseInt(m[1], 10) : 1
  return n >= 1 && n <= 100 ? n : 1
}

/**
 * 未開封BOXの成約履歴を取る。**condition_id は渡さない**（上のコメント1参照）。
 */
export async function getSnkrdunkBoxSales(
  browser: Browser,
  apparelId: number,
  sinceDays = 45,
): Promise<BoxSales> {
  const nowMs = Date.now()
  const cutoff = nowMs - sinceDays * 86400000
  const sales: BoxSale[] = []
  let complete = false

  for (let page = 1; page <= BOX_MAX_PAGES; page++) {
    const rows = await fetchPage(browser, apparelId, null, page)
    if (rows == null) break            // 取得失敗。そこまでで打ち切る（0件と区別できない）
    if (rows.length === 0) { complete = true; break }
    let reachedOld = false
    for (const r of rows) {
      const d = toIsoDateLoose(r.date, nowMs)
      if (d == null) continue
      if (Date.parse(`${d}T00:00:00+09:00`) < cutoff) { reachedOld = true; continue }
      const lot = parseLot(r.size)
      const total = Number(r.price)
      if (!(total > 0)) continue
      sales.push({ date: d, unitPrice: Math.round(total / lot), lot })
    }
    if (reachedOld || rows.length < BOX_PER_PAGE) { complete = true; break }
    await new Promise(r => setTimeout(r, 300))
  }
  return { sales, complete }
}
