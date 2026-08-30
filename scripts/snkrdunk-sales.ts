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
 * ⚠ 当日・前日は相対表記のまま返ることがあり、暦日の集計は暫定値になる。
 *   絶対日付に変わってから確定する運用にする（mergeSalesByDay が日ごとに max を取るので、
 *   後から増えた分は自然に上書きされる）。
 */

/** 素体（状態A〜D）。ここだけを「素体の成約」として数える */
export const RAW_CONDITION_IDS = [18, 19, 20, 21] as const
/** PSA10 単独。鑑定品の中でも相場を見るのはここ */
export const PSA10_CONDITION_ID = 22

const PER_PAGE = 1000

interface SaleRow { price: number; date: string; condition: string }

/** "2026/08/25" → "2026-08-25"。相対表記（"1日前" 等）は絶対日付にできないので捨てる */
function toIsoDate(raw: string): string | null {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(raw.trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

async function fetchPage(
  browser: Browser,
  apparelId: number,
  conditionId: number,
  page: number,
): Promise<SaleRow[] | null> {
  const p = await browser.newPage()
  try {
    const url = `https://snkrdunk.com/v1/apparels/${apparelId}/sales-history`
      + `?page=${page}&per_page=${PER_PAGE}&condition_id=${conditionId}`
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
): Promise<{ date: string; price: number }[]> {
  const cutoff = Date.now() - sinceDays * 86400000

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
        const d = toIsoDate(r.date)
        if (d == null) continue     // 相対表記＝当日近辺。確定できないので採らない
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
  const [regularSales, psa10Sales] = await Promise.all([
    collectDates(browser, apparelId, RAW_CONDITION_IDS, sinceDays),
    collectDates(browser, apparelId, [PSA10_CONDITION_ID], sinceDays),
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
