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
): Promise<string[]> {
  const cutoff = Date.now() - sinceDays * 86400000
  const out: string[] = []

  for (const cid of conditionIds) {
    for (let page = 1; page <= 5; page++) {
      const rows = await fetchPage(browser, apparelId, cid, page)
      if (rows == null) break          // 取得失敗。その状態は諦める（0件と区別できないので足さない）
      let reachedOld = false
      for (const r of rows) {
        const d = toIsoDate(r.date)
        if (d == null) continue        // 相対表記＝当日近辺。確定できないので採らない
        if (Date.parse(d) < cutoff) { reachedOld = true; continue }
        out.push(d)
      }
      // 1ページ目で古い日に届いた or 1000件未満＝続きが無い
      if (reachedOld || rows.length < PER_PAGE) break
      await new Promise(r => setTimeout(r, 800))
    }
    await new Promise(r => setTimeout(r, 800))
  }
  return out
}

export interface SnkrdunkSales {
  /** 素体（A〜D）の成約日。1取引1要素 */
  regular: string[]
  /** PSA10 の成約日。1取引1要素 */
  psa10: string[]
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
  const regular = await collectDates(browser, apparelId, RAW_CONDITION_IDS, sinceDays)
  const psa10 = await collectDates(browser, apparelId, [PSA10_CONDITION_ID], sinceDays)
  return { regular, psa10 }
}
