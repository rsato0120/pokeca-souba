import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'
import { SET_BOXES } from '@/lib/set-boxes'
import { updateExtremes, MIN_SAMPLE_COUNT } from '@/lib/extremes'
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
  count: number | null     // 出品中の件数（供給圧）＝除外・番号照合を通した実数
  askLow: number | null    // 出品最安値帯（即購入できる床値・先行指標）
  askMid: number | null    // 出品中央値
  /** ページ上限で打ち切ったため count が下限値（「N件以上」）であることを示す */
  capped?: boolean
}

// 件数のためにめくるページ数の上限。1ページ ≒ 100〜120件なので3ページで約300件まで実数で数えられる。
// これを超える銘柄（現行弾のチェイス等）は打ち切って採用率で外挿する（下の getMercariOnSale 参照）。
const ON_SALE_MAX_PAGES = 3

// ⚠ meta.numFound を出品件数として保存してはいけない（2026-08-03 修正）
//
// numFound は**キーワードの曖昧一致でヒットした総数**であり、価格側で使っている除外
// （まとめ売り・鑑定品・傷あり）も、同名別バージョンの番号照合も一切通っていない。
// メルカリのキーワード検索はレアリティ表記を絞り込み条件として扱わないため、
// 「カード名 + レアリティ + 弾名」で引くと**別レアリティの出品がそのまま総数に乗る**。
//   実測（2026-08-03）:
//     メガユキメノコex SAR(233/193) … 保存値158件 ⇔ 実数9件（¥300のRR出品が大量に混入）
//     メガユキメノコex MA (224/193) … 保存値308件 ⇔ 実数32件
//     メガリザードンXex MA(223/193) … 保存値936件 ⇔ 実数163件
// カード詳細の「メルカリ出品中」がひと桁違う値を出すだけでなく、トップの
// 「今買われている/売られているカード」も buy-signals も、この件数の前日比で並べている。
//
// 対策は2つで一組:
//   (1) 検索キーワードを**カード番号**にする（呼び出し側 buildOnSaleQuery）。レアリティ表記は
//       検索の絞り込みにならないが、"233/193" は出品タイトルにほぼ必ず書かれていて効く。
//   (2) 返ってきた出品を価格側と**同じ関門**（isExcluded / matchesCardNo）に通し、
//       残った数を数える。ページをめくって実数で数え、上限を超えた分だけ採用率で外挿する。
async function getMercariOnSale(
  browser: Browser,
  searchQuery: string,
  minPrice = 0,
  cardNo: CardNo | null = null,
  // タイトルに対する追加条件。BOXはカード番号が無く番号照合が使えないので、
  // 「弾名が書かれていること」「BOX表記があること」をここで担保する。
  titleMust: ((title: string) => boolean) | null = null,
  // カード名。**そもそもこのカードか**を見る最後の砦。価格側(scrapeMercariSoldAvg)には
  // 前からあったが件数側には無く、検索が緩んで別カードが返った時に件数だけ水増しされていた
  // （例「ナンジャモ SAR」で別セットのナンジャモSARやナンジャモのハラバリーexが混ざる）。
  // BOX/セットはカード名を持たないので null。
  cardName: string | null = null,
): Promise<OnSaleResult> {
  const keyword = encodeURIComponent(searchQuery)
  const baseUrl = `https://jp.mercari.com/search?keyword=${keyword}&status=on_sale&item_types=buy_now&sort=price&order=asc`

  // 1ページ取得。ページ送りは meta.nextPageToken（空文字＝最終ページ）
  async function fetchPage(token: string | null): Promise<{ items: MercariItem[]; total: number | null; next: string } | null> {
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
    try {
      // .catch を即付与しないと、goto待機中(最大30s)に25sタイムアウトで reject した際
      // 未処理Promiseリジェクトとなり try/catch を素通りしてプロセスごと落ちる
      const responsePromise = page.waitForResponse(
        r => r.url().includes('/v2/entities:search') && r.status() === 200,
        { timeout: 25000 }
      ).catch(() => null)
      const url = token ? `${baseUrl}&page_token=${encodeURIComponent(token)}` : baseUrl
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const response = await responsePromise
      if (!response) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any = null
      try { json = await response.json() } catch { return null }
      if (!json) return null
      const meta = json.meta ?? json.data?.meta ?? {}
      const rawTotal = meta.numFound ?? meta.total ?? json.numFound ?? json.totalCount
      return {
        items: json.items ?? json.data?.items ?? json.result?.items ?? [],
        total: rawTotal != null && !isNaN(Number(rawTotal)) ? Number(rawTotal) : null,
        next: typeof meta.nextPageToken === 'string' ? meta.nextPageToken : '',
      }
    } catch { return null }
    finally { await page.close() }
  }

  try {
    const first = await fetchPage(null)
    if (!first) return { count: null, askLow: null, askMid: null }

    // minPrice: BOXの出品検索が1パック/単品を拾い床値が¥数百に化けるのを防ぐ（カードは既定0で無影響）
    const keep = (i: MercariItem) =>
      !isExcluded(i.name) && matchesCardName(i.name, cardName) && matchesCardNo(i.name, cardNo)
      && Number(i.price) >= Math.max(1, minPrice)
      && (titleMust == null || titleMust(i.name))

    let seen = first.items.length
    let kept = first.items.filter(keep).length
    let token = first.next
    let pages = 1
    while (token && pages < ON_SALE_MAX_PAGES) {
      await new Promise(r => setTimeout(r, 2500 + Math.random() * 1500))
      const next = await fetchPage(token)
      if (!next) break
      seen += next.items.length
      kept += next.items.filter(keep).length
      token = next.next
      pages++
    }

    // ⚠ 外挿（numFound × 採用率）は**やめた**（2026-08-28）。
    //
    // 【なぜ】打ち切りに達した系列だけが外挿値に化けるため、**同じ画面に並ぶ数字の
    // 数え方が系列ごとに違う**状態になっていた。on_sale は絶対値ではなく系列間・前日比で
    // 比較して使うもの（トップの「今買われている/売られているカード」、buy-signals の
    // supplyTightening、AI予想プロンプト）なので、基準が混在すると比較そのものが壊れる。
    //   実測(2026-08-28) ストームエメラルダ:
    //     統合 54件（打ち切り無し＝実数） / シュリンクあり 738件（外挿） / なし 89件
    //     → **部分(827) が全体(54) の13.7倍**。BOXの3系列だけで矛盾していた。
    //   同じ矛盾がアビスアイ(139 vs 2)・メガブレイブ(68 vs 1)・MEGAドリームex(120 vs 54)にも出ていた。
    //
    // numFound はメルカリのあいまい一致の総数で、価格側の除外も番号照合も通っていない。
    // 採用率を掛けても「的外れな母数 × 読めた範囲の採用率」でしかなく、母数が膨らむ銘柄では
    // 何倍にも化ける（ポケセン福岡のスペシャルBOXは numFound=911 → 外挿760件。keepRate>=0.5 の
    // ガードを足しても止まらなかった＝この推定量自体が信用できない）。
    //
    // 打ち切った時は**読めた実数をそのまま入れ、capped で「下限値」と印を付ける**。
    // 全544系列のうち on_sale>300（＝確実に外挿）は6件だけなので、失う情報より
    // 基準が揃うことの方が大きい。
    const keepRate = seen > 0 ? kept / seen : 0
    // 件数がおかしい時の切り分け用。ONSALE_DEBUG=1 で母数と採用率、通過したタイトルを出す
    if (process.env.ONSALE_DEBUG === '1') {
      console.log(`\n    [debug] q="${searchQuery}" numFound=${first.total} seen=${seen} kept=${kept} keepRate=${(keepRate * 100).toFixed(0)}% pages=${pages} tokenLeft=${!!token}`)
      for (const i of first.items.filter(keep).slice(0, 10)) console.log(`      ¥${i.price} ${String(i.name).slice(0, 56)}`)
    }
    let count: number | null = kept
    // 打ち切った＝まだ続きがある。数字は下限値なので印を付ける（画面は「N件以上」と出す）
    const capped = !!token && kept > 0
    if (count != null && count <= 0) count = null

    // 出品価格分布（傷あり・ジャンク等を除外し、外れ値を除いた安値帯）。
    // ⚠ ここは**1ページ目だけ**で計算する。ページを足すと高値側が入って ask_mid が上がり、
    // 成約と突き合わせる価格ガードの基準が静かにずれるため、件数の修正と混ぜない。
    const prices = first.items.filter(keep).map(i => Number(i.price)).sort((a, b) => a - b)

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
    return { count, askLow, askMid, capped }
  } catch { return { count: null, askLow: null, askMid: null } }
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
// スニダンの売買履歴は**直近3日ぶんだけ日時を相対表記で出す**（「2時間前」「1日前」「3日前」。
// それ以前は YYYY/MM/DD）。絶対日付しか読まないと**いちばん新しい取引がまるごと落ちる**。
// 実測（2026-08-24・4銘柄）: 全105/112/70/71行のうち 7/9/13/7 行＝6〜19%が相対表記だった。
// 価格の平均が古い側に偏るだけでなく、出来高は今日・昨日の棒が永久に立たなくなる。
function parseSnkrdunkSaleDate(token: string, nowMs: number): { d: string; t: number } | null {
  const abs = token.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (abs) {
    const d = `${abs[1]}-${abs[2]}-${abs[3]}`
    return { d, t: Date.parse(`${d}T00:00:00+09:00`) }
  }
  const rel = token.match(/^(\d{1,2})(分|時間|日)前$/)
  if (!rel) return null
  const n = parseInt(rel[1], 10)
  const ms = rel[2] === '日' ? n * 86400000 : rel[2] === '時間' ? n * 3600000 : n * 60000
  // JSTの暦日に落とす（+9時間してからUTCの日付を読む）
  const d = new Date(nowMs - ms + 9 * 3600000).toISOString().slice(0, 10)
  return { d, t: Date.parse(`${d}T00:00:00+09:00`) }
}

// regularSaleDates / psa10SaleDates = ページに載っていた**個別の取引**の日付（1取引1要素）。
// メルカリの numFound 差分と違って実件数なので、日別に数えれば減ったり歯抜けになったりしない。
async function getSnkrdunkPrices(browser: Browser, apparelId: number): Promise<{ fetched: boolean; regular: number | null; regularCount: number; psa10: number | null; staleDays: number | null; staleRegular: number | null; regularSaleDates: string[]; psa10SaleDates: string[] }> {
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
    if (!text) return { fetched: false, regular: null, regularCount: 0, psa10: null, staleDays: null, staleRegular: null, regularSaleDates: [], psa10SaleDates: [] }

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
    const regularRows = [...regularSection.matchAll(/(\d{4}\/\d{2}\/\d{2}|\d{1,2}(?:分|時間|日)前)\s+[A-D]\s+(\d{1,3}(?:,\d{3})*)/g)]
      .map(m => {
        const when = parseSnkrdunkSaleDate(m[1], now)
        return when ? { d: when.d, t: when.t, p: parseInt(m[2].replace(/,/g, ''), 10) } : null
      })
      .filter((r): r is { d: string; t: number; p: number } => r != null && r.p >= 100 && isFinite(r.t))
    // 素体の成約日。価格の窓（45日）とは切り離し、ページに見えた取引は全部返す。
    // 相場に採用しない銘柄（メルカリ採用・鮮度切れ）でも出来高だけは出せるようにするため
    const regularSaleDates = regularRows.map(r => r.d)
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
    // PSA10 の成約日。1取引=1要素（同じ日が複数入る）。呼び出し側で日別に数える
    let psa10SaleDates: string[] = []
    if (psa10Start >= 0) {
      const psa9Patterns = ['状態PSA9の売買履歴', 'PSA9の売買履歴', 'PSA 9の売買履歴', 'PSA9の']
      const psa9Start = psa9Patterns.reduce((acc, s) => {
        const i = text.indexOf(s, psa10Start + 4)
        return acc >= 0 ? acc : (i > psa10Start ? i : -1)
      }, -1)
      // ⚠ 履歴テーブルの後ろには価格チャートが続き、そのY軸の目盛り（0/50,000/100,000/150,000）も
      //   本文テキストに出る。セクションを「の売買相場」（＝チャートの見出し）の手前で切らないと、
      //   目盛りが取引価格として平均に混ざる。実測（ポケモン151 フシギバナex SAR・2026-08-24）:
      //   母数23件のうち3件が目盛りで、平均 ¥45,659 と出ていた。実取引だけなら ¥39,558（+15%の過大）。
      const psa10Raw = text.slice(psa10Start, psa9Start > 0 ? psa9Start : psa10Start + 2000)
      const chartAt = psa10Raw.indexOf('の売買相場')
      const psa10Section = chartAt > 0 ? psa10Raw.slice(0, chartAt) : psa10Raw
      const noHistory = ['まだこの商品は取引がありません', '取引がありません', '売買履歴はまだありません']
      if (!noHistory.some(s => psa10Section.includes(s))) {
        // 「日時・状態・金額」は**セルごとに改行される**（2026/08/12 ⏎ PSA10 ⏎ 38,000）。
        // 以前は [^\n]*? で繋いでいたため1件もマッチせず、PSA10 は常に下のフォールバック
        // （セクション内の数字を全部平均）に落ちていた。素体側が \s+ で動いていたのと同じ形に揃える。
        // 素体より窓を長く取るのは、鑑定品は取引頻度が低く45日だと該当ゼロになる銘柄が多いため。
        const PSA10_WINDOW_DAYS = 90
        const psa10AllRows = [...psa10Section.matchAll(/(\d{4}\/\d{2}\/\d{2}|\d{1,2}(?:分|時間|日)前)\s+PSA\s?10\s+(\d{1,3}(?:,\d{3})*)/g)]
          .map(m => {
            const when = parseSnkrdunkSaleDate(m[1], now)
            return when ? { d: when.d, t: when.t, p: parseInt(m[2].replace(/,/g, ''), 10) } : null
          })
          .filter((r): r is { d: string; t: number; p: number } => r != null && r.p >= 1000 && isFinite(r.t))
        // 出来高は窓で切らない（何日ぶん見えたかは銘柄ごとに違うので、見えた分は全部返して
        // 呼び出し側で日別に積む）。価格の平均だけ90日窓に絞る。
        psa10SaleDates = psa10AllRows.map(r => r.d)
        const psa10Rows = psa10AllRows.filter(r => now - r.t <= PSA10_WINDOW_DAYS * 86400000).map(r => r.p)
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

    return { fetched: true, regular, regularCount, psa10, staleDays: regularStaleDays, staleRegular, regularSaleDates, psa10SaleDates }
  } catch { return { fetched: false, regular: null, regularCount: 0, psa10: null, staleDays: null, staleRegular: null, regularSaleDates: [], psa10SaleDates: [] } }
  finally { await page.close() }
}

// Mercari sold_out prices（BOX専用フォールバック）
// 「サプライのみ」「プロモカードなし」はスペシャルBOXから目当てのカードを抜いた**別商品**で、
// 実勢が1/5以下になる（ポケセン福岡: 本体¥17,654 に対し ¥1,300〜4,000 で並ぶ）。
// 相場にも件数にも混ぜてはいけない。
const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン', 'サプライのみ', 'プロモなし', 'プロモ無し', 'プロモカードなし']
const EXCLUDE_PATTERNS = [
  /[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/,
  /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i,
  // 抜き取り品の言い回しは無限に増えるので、キーワード完全一致ではなくパターンで受ける。
  // 「プロモカード無し」は EXCLUDE_KEYWORDS の 'プロモ無し' に部分一致しないため素通りしていた
  // （ポケセン福岡の出品件数が膨らんだ一因）。
  /プロモ.{0,4}(なし|無し|無|抜き|抜け|欠品)/,
  /(カード|中身|本体).{0,3}(なし|無し|抜き)/,
  /サプライ(のみ|だけ)/,
  /空箱/,
]

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
// 出品者が混同しやすいレアリティの組。この組が同じ弾に同居しているカードは、
// タイトルのレアリティ表記を版の根拠にしてはいけない（SA版に「SR」と書く出品が多い）。
// AR⊂SAR・UR⊂MUR は単独トークン照合で防げるが、SR⇔SA は**書き間違いそのもの**なので
// 文字列の工夫では防げず、番号を必須にするしかない。
const CONFUSABLE_RARITY_PAIRS = [['SR', 'SA'], ['SR', 'SAR'], ['HR', 'SA']]

function isConfusable(a: string, b: string): boolean {
  return CONFUSABLE_RARITY_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

/** レアリティが単独トークンとして書かれているか（"MA" が "MEGA" に部分一致しないように） */
function hasRarityToken(title: string, rarity: string): boolean {
  return new RegExp(`(^|[^A-Za-z])${rarity}([^A-Za-z]|$)`).test(title.toUpperCase())
}

function matchesCardNo(title: string, card: CardNo | null): boolean {
  if (card == null) return true
  const sameSet = extractNoPairs(title).filter(p => p.total === card.total)
  if (sameSet.length > 0) return sameSet.some(p => p.no === card.no)
  if (!card.strict) return true

  // ── strict の救済（2026-08-04）──
  // 番号が書いていなくても、**このカードのレアリティだけ**が明記されていれば版は確定する。
  // これが無いと「メガユキメノコex MA」のように番号を書かない出品が全部落ち、
  // 46件中44件が消えてサンプル下限割れ＝価格スキップになっていた（出品件数も道連れで欠測）。
  // 救済の条件は厳しくする:
  //   ・自分のレアリティが単独トークンで書かれている
  //   ・兄弟のレアリティが1つも書かれていない（両方書いてある曖昧な出品は採らない）
  //   ・兄弟に「混同されやすい組」が居ない（SR⇔SA など。ここは従来どおり番号必須のまま）
  if (!card.rarity || card.siblingRarities == null) return false
  if (card.siblingRarities.some(r => isConfusable(card.rarity!, r))) return false
  if (!hasRarityToken(title, card.rarity)) return false
  if (card.siblingRarities.some(r => hasRarityToken(title, r))) return false
  return true
}

/**
 * タイトルが**そもそもこのカードなのか**を見る。
 *
 * 【なぜ番号照合だけでは足りないか】
 * メルカリのキーワード検索は完全一致が少ないと**勝手に条件を緩めて別商品を返す**。
 * 薄商いの銘柄では返ってきた大半が無関係なカードになるが、番号照合は
 * 「番号が書かれていないタイトルは通す」ので全部素通りしていた。
 *   実例(2026-08-06 ユーザー報告): オーロットVMAX HR(080/067) の成約検索
 *   「オーロットVMAX HR 蒼空ストリーム」が返した4件の内訳は
 *     ¥333  オーロットVMAX HR S7R 蒼空ストリーム 080/067  ← 本物
 *     ¥5,900 マリィのオーロンゲex
 *     ¥5,888 メガリザードンex SR インフェルノX
 *     ¥5,733 メガリザードンex SR インフェルノX
 *   本物1件が20thパーセンタイルの下端に落ち、**別カード3件の値がこのカードの相場**として
 *   6月末から1か月以上表示され続けていた（実勢¥333〜¥800 に対し ¥5,811）。
 *   出品が1件しか無く askLow/askMid が付かない（3件必要）ため、ask整合(R1)も働かなかった。
 *
 * 【判定】カード名が書かれていないタイトルは採らない。フィルタを足すだけなので、
 * 落ちるのは「名前が書かれていない出品」だけ＝件数不足でスキップに倒れる（安全側）。
 * 「の」「&」で区切った各片が全て含まれることを求める（"ヒガナ 決意" のような分かち書きや
 * TAG TEAM 名の順序違いを落とさないため）。
 */
function normalizeForMatch(s: string): string {
  return s.normalize('NFKC').toUpperCase().replace(/[\s・･,，、。'’"”\-−ー]/g, '')
}

export function matchesCardName(title: string, cardName: string | null): boolean {
  if (!cardName) return true
  const t = normalizeForMatch(title)
  return cardName.split(/[の&]/).map(normalizeForMatch).filter(p => p.length > 0).every(p => t.includes(p))
}

interface CardNo {
  no: number
  total: number
  strict?: boolean
  /** このカードのレアリティ（strict の救済判定に使う） */
  rarity?: string
  /** 同じ弾の同名カードのレアリティ一覧（自分を除く） */
  siblingRarities?: string[]
}

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

// updated = 最終更新時刻（epoch秒・文字列で返る）。成約検索では実質「売れた時刻」になる。
interface MercariItem { id?: string; name: string; price: number; status?: string; updated?: number | string }
// soldTotal = 成約済みの総件数（meta.numFound）。日々の差分が「1日に何枚売れたか」＝回転率になる。
// 追加リクエストは発生しない（成約相場を取る同じレスポンスの meta を読むだけ）。
interface MercariPriceResult {
  avg: number; low: number; high: number; soldTotal: number | null; sampleCount: number
  oldestSaleDays: number | null  // 採用した成約のうち最も古いものが何日前か（鮮度の可視化）
  windowDays: number | null      // 実際に適用した鮮度の窓（null = 全期間まで広げた）
}

// 成約サンプルの鮮度。メルカリの成約検索は**売れた時期を問わず全期間**を返すため、年に数回しか
// 動かない銘柄では1年前の成約がそのまま「現在相場」として採用されてしまう。
//   実例: レックウザVMAX SA(083/067) は成約11件が 2025-08〜2026-07 に散らばっており、
//   20th〜50th の区間が **353日前の ¥250,000 / ¥294,600** に刺さって現在相場が
//   ¥294,600〜¥666,666 と表示された。直近3ヶ月の成約は ¥666,666〜¥1,154,400、出品最安は
//   ¥670,000 で、実勢の半値以下。このカードは1年で3〜4倍に上がっており、下寄りの区間を取る
//   sliceMean は「値上がりした薄商い銘柄では必然的に1年前の安値を拾う」という性質を持つ。
// 対策＝**直近の窓から順に試し、件数が足りない時だけ広げる**。薄商い銘柄をスキップにしない
// （スキップは前日値の凍結を生み、それはそれで古い値が居座る）。
// 鮮度不明（updated 欠落）のサンプルは有限の窓には入れない。仮にAPIが updated を返さなく
// なっても最後の「全期間」に落ちるだけで、従来と同じ挙動に自動で戻る。
const SOLD_WINDOWS: Array<{ days: number | null; min: number }> = [
  { days: 90, min: 5 },
  { days: 180, min: 5 },
  { days: 365, min: 5 },
  { days: null, min: 3 },
]

// trimTopPct: low/high を出す前に高値側から機械的に落とす割合。成約検索に残る混入は必ず
// 高値側なので、これが無いと表示レンジの上端が束売り/鑑定品の値になる（ミカルゲAR: 実勢¥362
// なのに上端¥722）。カードは 0.25、BOX は 0（BOXは呼び出し側が中位バンドを指定するため）。
async function scrapeMercariSoldAvg(
  browser: Browser,
  searchQuery: string,
  lowPct = 0.2,
  highPct = 0.6,
    cardNo: CardNo | null = null,
  trimTopPct = 0.25,
  // カード名（BOX/セットは null）。検索が緩んで別カードが返ってきた時の最後の砦（matchesCardName）
  cardName: string | null = null,
  // タイトルに対する追加条件（BOX用）。getMercariOnSale の titleMust と同じものを渡す。
  // ⚠️ メルカリの成約検索はキーワードをトークンANDで**絞ってくれない**。実測（2026-08-13）:
  //   "インフェルノX 未開封 シュリンクなし 1BOX" の結果114件のうち、タイトルに「シュリンクなし」
  //   と書いてあるのは11件だけで、70件は逆の「シュリンク付き」だった。シュリンクあり側の検索と
  //   58件が同一出品。つまり分離できておらず、あり/なしがほぼ同じ値になっていた
  //   （インフェルノX: なし¥19,750 vs あり¥19,936。タイトルで絞ると なし は¥14,750 が実勢）。
  //   件数(getMercariOnSale)側にだけ条件が掛かっていて、価格側は素通りだったのが原因。
  titleMust: ((title: string) => boolean) | null = null,
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
    const nowSec = Date.now() / 1000
    const candidates = rawItems
      .filter(i => !isExcluded(i.name) && matchesCardName(i.name, cardName) && matchesCardNo(i.name, cardNo)
        && (titleMust == null || titleMust(i.name)) && Number(i.price) > 0)
      .map(i => {
        const soldAt = Number(i.updated)
        return {
          price: Number(i.price),
          ageDays: Number.isFinite(soldAt) && soldAt > 0 ? (nowSec - soldAt) / 86400 : null,
        }
      })
    // 鮮度の窓を直近から順に試す（SOLD_WINDOWS のコメント参照）
    let picked: typeof candidates = []
    let windowDays: number | null = null
    for (const w of SOLD_WINDOWS) {
      const maxAge = w.days
      const inWindow = maxAge == null
        ? candidates
        : candidates.filter(c => c.ageDays != null && c.ageDays <= maxAge)
      if (inWindow.length >= w.min) { picked = inWindow; windowDays = w.days; break }
    }
    if (picked.length < 3) return null
    const prices = picked.map(c => c.price)
    const ages = picked.map(c => c.ageDays).filter((a): a is number => a != null)
    const oldestSaleDays = ages.length > 0 ? Math.round(Math.max(...ages)) : null
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
    return { avg, low, high, soldTotal, sampleCount: prices.length, oldestSaleDays, windowDays }
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

/**
 * ★価格を保存する直前の単一関門（choke point）。
 *
 * ⚠️ この関数を迂回して savePriceHistory を呼んではいけない。健全性の判定は必ずここに足すこと。
 *
 * 【なぜ関門を1本にまとめたか】
 * 価格の書き込み経路は5本ある:
 *   (1) スニダン主経路  (2) メルカリ成約  (3) スニダンフォールバック
 *   (4) スニダン鮮度切れ (5) BOX(scrapeBox)
 * これまで健全性チェックは経路ごとにバラバラに付いていた。ask整合は(2)だけ、前日比の
 * 急変チェックは(3)(4)だけ、(1)と(5)は**素通り**。そのため1本を塞ぐたびに、同じ種類の
 * 事故が「まだ塞いでいない経路」から入り直すことを繰り返していた。
 *   実例A: メガルチャブルex MA — メルカリ実勢¥561 に対しスニダンの手数料込み床値¥1,517 が
 *          経路(1)から流入(+170%)。同じ事故は2026-07-29に経路(3)で修正済みだったが、
 *          取引件数が採用閾値(6件)に届いた途端に(1)へ回り込んで再発した。
 *          絶対額の下限 SNKRDUNK_MIN_PRICE=1500 も ¥1,517 では17円差で素通りする。
 *   実例B: 蒼空ストリームBOX(シュリンクあり) — 成約が薄く検索窓が90日超へ拡張された結果、
 *          古い高値が混ざり ¥160,573→¥258,334(+61%)。経路(5)は無防備だった。
 *
 * 【判定】ask（出品価格）と前日値による裏付けを要求し、通らなければ**採用しない**
 * （＝既存価格を維持してスキップ。値の捏造はしない、という既存方針を踏襲）。
 */
export function guardPrice(opts: {
  id: string
  date: string
  avg: number
  /** 画面に出る価格帯。avg だけ正しくても帯が壊れていると表示は破綻する */
  low?: number
  high?: number
  priceSource: PriceSource
  onSale: OnSaleResult | null
  prev: PriceRecord | null
  /** 採用した成約の件数。取れなかった経路（スニダン鮮度切れ）では undefined */
  sampleCount?: number
}): { ok: true } | { ok: false; reason: string } {
  const { id, date, avg, low, high, priceSource, onSale, prev, sampleCount } = opts

  // --- R5: 採用サンプルが薄すぎないか【R0より前に判定する】 ---
  // 極値(src/lib/extremes.ts)は sample_count < MIN_SAMPLE_COUNT のレコードを「実勢から
  // 外れやすい」として最初から候補にしていない。にもかかわらず書き込み側には件数の下限が
  // 無く、同じ値がグラフと現在価格には出ていた。**極値が信用しない値を表示はする**という
  // 食い違いが、そのまま「サイトの最高値より高い点がグラフにある」状態を作っていた。
  //
  // スニダン主経路は ADOPT=6 / KEEP=4 の件数ヒステリシスを自前で持っているのでここは素通りする。
  // 実際に効くのは **メルカリ成約が取れなかった時のスニダン・フォールバック経路**で、
  // ここだけ件数を一切見ていなかった。
  //   実際に起きた事故: ラティアス&ラティオスGX SA — n=2 の ¥515,000 が3日分入り
  //   （同じ日の出品最安は¥91,000〜93,000）、次にメルカリが取れた日に -61% の崖になった。
  if (sampleCount != null && sampleCount < MIN_SAMPLE_COUNT) {
    return { ok: false, reason: `採用サンプルが薄い（${sampleCount}件・${MIN_SAMPLE_COUNT}件未満は極値にも採らない水準）` }
  }

  // --- R4: 価格帯(low〜high)が広がりすぎていないか【R0より前に判定する】 ---
  // 画面の「現在相場 ¥low〜¥high」は avg ではなくこの帯を出す。avg が妥当でも、成約が薄い日に
  // 20thパーセンタイルが1件の安値に張り付くと帯だけが破綻する。
  //   ニンフィアVMAX SA: n=15→5 に減った日に 低¥90,000 → **¥30,000** へ落ち、
  //   出品最安¥149,999 のカードが「¥30,000〜¥142,000」と表示された。
  //   オーロットVMAX HR: n=4 で ¥333〜¥5,733（17.2倍）。
  // 全4,846レコードの high/low は 99パーセンタイルで 2.01倍。3.0倍は十分な余裕がある。
  //
  // ⚠️ **R0（凍り付き防止）より前に置くこと**。R0 は ask や前日値という「外部の文脈」が
  // 使えない銘柄を救うための逃げ道であって、レコード単体で完結する整合性まで免除するもの
  // ではない。17倍の帯は何日更新できていなかろうと表示として成立しない。
  //   実際に起きた事故(2026-08-04): オーロットVMAX HR は 08-01〜08-03 の汚染レコードを
  //   データ掃除で削除した結果 prev が 07-31（4日前）になり、**R0 が先に true を返して
  //   R4 を飛ばし、同じ ¥333〜¥5,733 が入り直した**。掃除で空いた穴が、そのまま同じ値を
  //   通す抜け道になっていた。表示は「現在相場 ¥333〜¥5,733」、mid が¥3,985に沈んだ結果
  //   「3ヶ月後 +70%」の割安カードとしてトップの『AIが買うべきカード』1位に出た。
  if (low != null && high != null && low > 0 && high / low > 3) {
    return { ok: false, reason: `価格帯が異常に広い ¥${low.toLocaleString()}〜¥${high.toLocaleString()}（${(high / low).toFixed(1)}倍・通常は2倍以内）` }
  }

  // --- R3: BOX シュリンクあり ⇔ なし の関係【R0より前に判定する】 ---
  // シュリンク付きのプレミアムは現行弾の実測で 1.05〜1.3倍。1.6倍を超えるのは
  // カートン/複数BOX/セット出品の混入か、検索窓拡張による古い高値の混入である。
  //
  // ⚠️ ただし上限1.6倍が効くのは「その比が突然発生した」時だけにする。
  //
  // 【なぜ】この 1.6 は、成約側にタイトル条件が無くシュリンクあり/なしが**分離できて
  // いなかった頃**（＝なし≒ありで比が常に1.0付近だった頃）に決めた値だった。2026-08-13 に
  // 分離を直したところ、絶版弾の本当のプレミアムが表に出て一斉に上限を超えた:
  //   イーブイヒーローズ  あり¥137,500 / なし¥52,000  = 2.64倍
  //   蒼空ストリーム      あり¥224,730 / なし¥70,725  = 3.18倍
  // 一方、過去に実際に起きた事故（2026-08-01/08-06 の蒼空ストリーム）は 2.53倍 で、
  // **比率だけでは正当なプレミアムと事故を分離できない**（2.53 < 2.64）。
  //
  // 分けられるのは「その水準が続いているか」。事故は前日比+61%で**突然**跳ねたのに対し、
  // 絶版弾のプレミアムは毎日ほぼ同じ値で居座る（イーブイは前日比+2.8%）。
  // よって: 比が想定域外でも、前日から±20%以内で安定していれば構造的なプレミアムとみなす。
  // 上限3.5倍はカートン/複数BOX混入（実測4〜20倍）を残して弾くための天井。
  if (id.endsWith('-shrink')) {
    const base = readLatestRecord(`${id.slice(0, -'-shrink'.length)}-noshrink`, '')
    if (base?.avg) {
      const r = avg / base.avg
      // 前日から動いていない＝この比は今日生まれたものではない
      const stable = prev?.avg != null && prev.avg > 0 && Math.abs(avg / prev.avg - 1) <= 0.20
      const hi = stable || prev?.avg == null ? 3.5 : 1.6
      if (r > hi || r < 0.95) {
        return { ok: false, reason: `シュリンク比 ${r.toFixed(2)}倍（シュリンクなし ¥${base.avg.toLocaleString()}）が想定域(0.95〜${hi})外` }
      }
    }
  }

  // --- R0: 凍り付き防止（裏付け系のルールだけを免除する逃げ道） ---
  // 関門で弾くと既存価格が残るため、条件が恒久的に変わった銘柄は永久に更新されなくなる。
  // 過去に別のガードで14枚が最長29日間ずっと同じ値のまま固まった事故がある。
  // 出品側が汚れて ask 基準が使えない銘柄（例: ニンフィアVMAX HR は出品検索がSA版を拾い
  // 出品¥150,000 に対し実勢の成約¥10,250 が毎日「0.07倍」で弾かれ得る）でも、
  // 3日を超えて更新できていなければ受け入れる。残る不整合は audit-data.ts が拾う。
  //
  // ⚠️ **免除してよいのは「裏付け」系(R1 ask整合 / R2 前日比)だけ**。
  // 「整合性」系(R3 シュリンク比 / R4 価格帯)は上に置いてあり、ここは通過しない。
  //   理由＝**R0 の入口は関門自身の棄却で開く**。弾く→レコードが増えない→間隔が伸びる→
  //   4日目に同じ値が無条件で通る、というループになり、あらゆるルールが「4日遅れて通す」に
  //   退化する。実際 2026-08-06 の再取得で、08-02以降ずっと棄却されていた蒼空ストリームBOXが
  //   R0 経由で ¥160,573→¥258,750(+61%) を通した。これは verify-price-guard.ts に
  //   「弾くべき」ケースとして載っている 2026-08-01 の事故そのものの再来だった。
  //   裏付け系だけの免除なら、シュリンクなし¥102,150 との比 2.53倍 が R3 で止める。
  //
  // ⚠️ **出所が変わった日は R2 だけ免除しない**（R1 は従来どおり免除する）。
  // R0 が救おうとしているのは「ask が汚れていて比が使えない」銘柄＝R1 の問題であって
  // （上のニンフィアVMAX HR がまさにそれ）、R2 の「前日比の急変」ではない。ところが薄商いの
  // 銘柄は *棄却されなくても* 成約が取れず勝手に日が空くため、R0 が常時開いた状態になり、
  // スニダン⇔メルカリの水準差がそのまま段差として刻まれていた。
  //   実際に起きた事故(2026-08-19): ラティアス&ラティオスGX SA — 8/10 スニダン¥515,000(n=2)
  //   から9日空き、8/19 にメルカリ¥202,625(n=9) が **R0 経由で R2 を飛ばして** 通り、
  //   グラフに -61% の崖ができた。前日レコードがあれば R2 が
  //   「前日比-61%だが出品価格が追随せず」で弾いていた値である。
  //   （極値側は MIN_SAMPLE_COUNT/MAX_DAY_CHANGE で両方とも不採用にしていたため、
  //     「全期間高値¥367,963」と表示しながらグラフには¥515,000 が写る矛盾になっていた）
  //
  // ただし出所が恒久的に変わった銘柄が永久に凍るのは避ける。R0_SOURCE_FLIP_DAYS を超えて
  // 更新できていなければ、出所が変わっていても受け入れる（3日ではなく2週間にすることで、
  // 「弾く→日が空く→無条件で通る」のループが回る周期を実用上問題ない粗さまで落とす）。
  const R0_SOURCE_FLIP_DAYS = 14
  // R0 が開いたが出所が変わっているため R2 だけ効かせる状態
  let askRuleExemptOnly = false
  if (prev?.date) {
    const ageDays = Math.round((Date.parse(date) - Date.parse(prev.date)) / 86400000)
    if (ageDays > 3) {
      const sourceFlipped = prev.source != null && prev.source !== priceSource
      if (!sourceFlipped || ageDays > R0_SOURCE_FLIP_DAYS) return { ok: true }
      askRuleExemptOnly = true
    }
  }

  // --- R1: ask（出品価格）との整合。全ソースに適用する ---
  // askMid(中央値)を優先。askLow は10thパーセンタイルで1件の投げ売りに動かされ、
  // 正常なカードを何日も連続スキップさせた前科があるため補助扱い。
  // BOXは ask を整合の基準に使えない。出品検索を "1BOX"→"BOX" と**わざと広げて**件数を
  // 稼いでいるため、1パック/単品や複数BOXロットが混ざり中央値が実体とかけ離れる。
  //   ストームエメラルダ(統合): 成約¥20,500 に対し出品中央値¥8,300（＝パック単品）
  //   イーブイヒーローズ(シュリンクなし): 成約¥60,500 に対し出品最安¥69,900・中央値¥169,444
  // ここで弾くと健全な成約avgまで巻き添えで凍るので、BOXは R2/R3 で守る。
  const isBoxPool = id.startsWith('box-')
  const askRef = (isBoxPool || askRuleExemptOnly) ? null : (onSale?.askMid ?? onSale?.askLow ?? null)
  if (askRef != null && askRef > 0) {
    let lo: number, hi: number
    if (priceSource === 'snkrdunk') {
      // スニダンは「状態A=美品」かつ手数料込み表示なので、メルカリ出品より高いのは設計通り。
      // ただし安価帯は最低取引価格の影響で ¥1,000〜1,700 に張り付き、実勢の2〜3倍に化ける。
      // この帯だけ上限を締める（実例A の ¥1,517 vs 出品中央値¥739＝2.05倍を止める）。
      lo = 0.35
      hi = askRef < 3000 ? 1.8 : 3.5
    } else {
      lo = onSale?.askMid != null ? 0.4 : 0.5
      hi = onSale?.askMid != null ? 2.2 : 2.5
    }
    const r = avg / askRef
    if (r > hi || r < lo) {
      return { ok: false, reason: `ask整合(${priceSource}) 成約¥${avg.toLocaleString()} vs 出品¥${askRef.toLocaleString()}=${r.toFixed(2)}倍` }
    }
  }

  // --- R2: 前日比の急変は ask の裏付けを要求する ---
  // 相場が本当に動いたなら出品価格も追随する。avg だけが飛んで ask が据え置きなら、
  // それは相場変動ではなく採用サンプルの入れ替わり（＝出所フリップ・検索窓の拡張・
  // 別バージョン混入）である、というのがこれまでの全事故に共通する判別法。
  if (prev?.avg) {
    const jump = avg / prev.avg
    if (jump > 1.35 || jump < 0.65) {
      const prevAsk = prev.ask_mid ?? prev.ask_low ?? null
      const nowAsk = onSale?.askMid ?? onSale?.askLow ?? null
      // (a) ask が同方向に10%以上動いていれば真の相場変動とみなして通す
      const askMoved = prevAsk != null && nowAsk != null && prevAsk > 0 &&
        ((jump > 1 && nowAsk / prevAsk > 1.10) || (jump < 1 && nowAsk / prevAsk < 0.90))
      // (b) 新しい値が出品中央値と素直な関係（0.7〜1.5倍）に収まるなら、前日から飛んでいても
      //     水準そのものは独立に裏付けられている。メルカリ実勢→スニダン美品への**正常な
      //     出所切替**がここに当たる（ミュウex UR: ¥7,936→¥12,970 だが出品中央値¥11,111＝1.17倍、
      //     リザードAR: ¥1,897→¥3,197 で出品中央値¥2,999＝1.07倍。どちらも取引件数10〜17件で健全）。
      //     出所切替で水準が変わるのは設計通りなので、これを事故として弾いてはいけない。
      const askAnchors = !isBoxPool && onSale?.askMid != null && onSale.askMid > 0 &&
        avg / onSale.askMid >= 0.7 && avg / onSale.askMid <= 1.5
      if (!askMoved && !askAnchors) {
        return { ok: false, reason: `前日比${((jump - 1) * 100).toFixed(0)}%だが出品価格が追随せず（${prev.date} ¥${prev.avg.toLocaleString()} → ¥${avg.toLocaleString()}）` }
      }
    }
  }

  return { ok: true }
}

// 観測した成約日の配列を「日付 -> 件数」に畳んで、既存の記録と日ごとの max を取る。
// max なのは、スニダンの履歴が新しい取引に押し出されて古い日が見えなくなるため
// （見えなくなった＝取引が無かった、ではない）。SALES_KEEP_DAYS より古い日は捨てる。
const SALES_KEEP_DAYS = 120

function mergeSalesByDay(
  existing: Record<string, number> | undefined,
  observedDates: string[] | undefined,
  today: string
): Record<string, number> | undefined {
  const merged: Record<string, number> = { ...(existing ?? {}) }
  if (observedDates?.length) {
    const seen: Record<string, number> = {}
    for (const d of observedDates) seen[d] = (seen[d] ?? 0) + 1
    for (const [d, n] of Object.entries(seen)) {
      if (d > today) continue   // 未来日付はパース事故なので採らない
      merged[d] = Math.max(merged[d] ?? 0, n)
    }
  }
  const cutoff = new Date(Date.parse(today + 'T00:00:00+09:00') - SALES_KEEP_DAYS * 86400000)
    .toISOString().slice(0, 10)
  for (const d of Object.keys(merged)) if (d < cutoff) delete merged[d]
  return Object.keys(merged).length ? merged : undefined
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
  soldTotal?: number | null,
  oldestSaleDays?: number | null,
  // スニダン売買履歴から拾った個別取引の日付（1取引1要素）
  regularSaleDates?: string[],
  psa10SaleDates?: string[]
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

  // スニダンの実成約件数を日別に積む。ページには直近の十数件しか載らないので、
  // 毎日の観測を「日ごとの max」で重ねて履歴を作る（観測が欠けた日は前の値が残る）。
  data.sales_by_day = mergeSalesByDay(data.sales_by_day, regularSaleDates, date)
  data.psa10_sales_by_day = mergeSalesByDay(data.psa10_sales_by_day, psa10SaleDates, date)

  const record = {
    date,
    low,
    high,
    avg,
    ...(priceSource ? { source: priceSource } : {}),
    ...(sampleCount != null ? { sample_count: sampleCount } : {}),
    ...(soldTotal != null ? { sold_total: soldTotal } : {}),
    ...(oldestSaleDays != null ? { oldest_sale_days: oldestSaleDays } : {}),
    ...(validatedOnSale?.count != null ? { on_sale: validatedOnSale.count } : {}),
    // ページ上限で打ち切った＝実際はもっとある。画面で「N件以上」と出すための印
    ...(validatedOnSale?.count != null && validatedOnSale.capped ? { on_sale_capped: true } : {}),
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
    cardNo: CardNo | null,
  // 出品検索に使う生の表記（"087/067"）。parseCardNo 後の数値だと先頭ゼロが落ちて
  // 出品タイトルの表記と合わなくなるため、data の文字列をそのまま渡す。
  cardNoStr: string | null
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
    //
    // ⚠️ 絶対額の下限だけでは足りない。実勢¥561 のメガルチャブルex MA に ¥1,517 が入った時、
    // この閾値をわずか17円上回って素通りした。**閾値の縁は必ず破られる**ので、
    // 前日の出品中央値と比べた相対判定(isSnkrdunkFloorPrice)を併用する。
    const SNKRDUNK_MIN_PRICE = 1500
    // 前日レコード。出所ヒステリシスと、上記の相対判定の基準に使う
    // （2026-07-18 以前のレコードには source が無い）
    const prevRecordForSource = readLatestRecord(id, date)
    // スニダン値が「床値張り付き」かどうかを前日の出品価格から判定する。
    // 出品が安いのに素体だけ2倍近い＝スニダンの最低取引価格に張り付いている証拠。
    // これを落とすとメルカリ成約へフォールバックし、**正しい実勢価格が毎日入る**。
    // （落とさずスキップだけしていると値が何日も凍り、guardPrice の凍結回避で
    //   4日ごとに誤値が入る鋸歯になる）
    const isSnkrdunkFloorPrice = (v: number): boolean => {
      const prevAsk = prevRecordForSource?.ask_mid ?? prevRecordForSource?.ask_low ?? null
      return prevAsk != null && prevAsk > 0 && prevAsk < 3000 && v > prevAsk * 1.8
    }
    let snkrdunkRegular: number | null = null
    let snkrdunkCount = 0
    // 鮮度切れのスニダン値。メルカリも取れなかった時の最後の手段としてだけ使う
    let snkrdunkStale: number | null = null
    let snkrdunkStaleDays: number | null = null
    let snkrdunkFetched = false
    // スニダンの売買履歴に出ていた個別取引の日付。出来高（成約数）の元になる。
    // 価格をスニダンから採るかどうかとは無関係に、取れた分は常に記録する
    let snkrdunkSaleDates: string[] = []
    let snkrdunkPsa10SaleDates: string[] = []

    if (apparelId) {
      // スニーカーダンクから取得（PSA10は常にスニダン由来）
      const prices = await getSnkrdunkPrices(browser, apparelId)
      snkrdunkFetched = prices.fetched
      snkrdunkRegular = prices.regular
      snkrdunkCount = prices.regularCount
      psa10 = prices.psa10
      snkrdunkStale = prices.staleRegular
      snkrdunkStaleDays = prices.staleDays
      snkrdunkSaleDates = prices.regularSaleDates
      snkrdunkPsa10SaleDates = prices.psa10SaleDates

      // 取引が止まっている系列は getSnkrdunkPrices が regular=null を返す。何日止まって
      // いたかをログに出す（メルカリに落ちた理由が「取引無し」か「件数不足」か判別するため）
      if (prices.regular == null && prices.staleDays != null) {
        process.stdout.write(`[スニダン最新取引${prices.staleDays}日前→不採用] `)
      }

      if (snkrdunkRegular != null && (snkrdunkRegular < SNKRDUNK_MIN_PRICE || isSnkrdunkFloorPrice(snkrdunkRegular))) {
        const why = snkrdunkRegular < SNKRDUNK_MIN_PRICE
          ? `¥${snkrdunkRegular}`
          : `¥${snkrdunkRegular} vs 前日出品¥${prevRecordForSource?.ask_mid ?? prevRecordForSource?.ask_low}`
        process.stdout.write(`[スニダン床値${why}→不採用] `)
        snkrdunkRegular = null
        snkrdunkCount = 0
      }
    }

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
    // メルカリ成約の鮮度（採用した最古の成約が何日前か）。スニダン採用時は付けない
    let oldestSaleDays: number | null = null
    if (snkrdunkRegular != null && snkrdunkCount >= snkrdunkNeeded) {
      // 十分な取引数があるスニダン価格はそのまま採用
      avg = snkrdunkRegular
      source = 'スニダン'
      priceSource = 'snkrdunk'
      sampleCount = snkrdunkCount
    } else {
      // スニダン無し or 少数サンプル → Mercari sold_out（実勢）でフォールバック
      //
      // 名前照合(matchesCardName)を入れると、検索が緩んで別カードで水増しされていた薄商い銘柄は
      // 件数不足に倒れる。そこで **カード番号をキーワードにした検索を控えにする**。出品タイトルに
      // "080/067" と書く出品者は名前の表記ゆれに関係なく確実に本物なので、名前+レアリティ+弾名の
      // クエリより素直に当たる（出品件数の集計を numFound から実数へ直した時と同じ考え方）。
      //   オーロットVMAX HR: 「オーロットVMAX HR 蒼空ストリーム」= 本物1件＋別カード3件 だったが
      //   「オーロットVMAX 080/067」= ¥333/¥400/¥800 の3件すべて本物。
      const queries = cardNoStr ? [searchQuery, `${cardName} ${cardNoStr}`] : [searchQuery]
      for (let attempt = 1; attempt <= 3; attempt++) {
        const q = queries[Math.min(attempt, queries.length) - 1]
        if (attempt > 1 && q !== searchQuery) process.stdout.write(`[番号キーワードで再検索] `)
        const result = await scrapeMercariSoldAvg(browser, q, 0.2, 0.6, cardNo, 0.25, cardName)
        if (result != null) {
          avg = result.avg; mercariLow = result.low; mercariHigh = result.high; soldTotal = result.soldTotal
          // メルカリ由来でも件数を残す。これが無いと「何件の成約で出した値か」が後から検証できず、
          // 監査で薄いサンプルの跳ねと本物の相場変動を切り分けられなかった。
          sampleCount = result.sampleCount
          oldestSaleDays = result.oldestSaleDays
          if (result.windowDays == null || result.windowDays > 90) {
            const w = result.windowDays == null ? '全期間' : `${result.windowDays}日`
            process.stdout.write(`[成約が薄い→${w}まで拡張(最古${result.oldestSaleDays ?? '?'}日前)] `)
          }
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

    // 出品中は**カード番号**で検索する（2026-08-03）。
    // 「カード名 + レアリティ + 弾名」だとメルカリがレアリティ表記を絞り込みに使わないため、
    // 同名の別レアリティ（SARの検索にRR）がまるごとヒットして件数がひと桁膨らんでいた。
    // "233/193" は出品タイトルにほぼ必ず書かれており、版を確実に分離できる。
    // 番号を書かない出品は取りこぼすが、そもそもどの版か特定できない出品なので数に入れない。
    // プロモ（"260/SV-P" 等・番号が数字/数字でない）は従来どおりカード名＋「プロモ」で引く。
    //
    // ⚠️ 判定は「PROMOかどうか」ではなく「番号が数字/数字で取れるか」で行う（2026-08-22）。
    // 25thプロモ（S8a-P "001/025" 等）のように**数字の番号を持つプロモ**まで名前検索に
    // 落とすと、同名の別プロモが全部混ざって ask が実勢からかけ離れ、guardPrice の
    // ask整合(R1)が正しい成約価格を弾いてしまう。
    //   実測: リザードン(S8a-P 001/025) は「リザードン プロモ」で出品最安¥980 になり、
    //   スニダン成約¥72,692 が「74.18倍」として棄却された（リザードンV/exのプロモ混入）。
    const onSaleQuery = cardNo != null && cardNoStr
      ? `${cardName} ${cardNoStr}`
      : rarity === 'PROMO'
      ? `${cardName} プロモ`
      : `${cardName} ${rarity} ${boxName}`.replace(/\s+/g, ' ').trim()

    // PROMO は番号照合（matchesCardNo）が効かないので、名前だけだとメルカリの
    // あいまい一致で他地域・他プロモまで数に入る。実際「フクオカのピカチュウ」が
    // 804件（トウホク10件・ヒロシマ9件）に膨らんでいた。カード名を「の」で割った
    // 2文字以上の語が**全部**タイトルにあることを要求して数える。
    // 語順が逆の出品（「ピカチュウ フクオカ」）も拾えるよう、含有判定は順不同。
    const promoMust = rarity === 'PROMO'
      ? (title: string) => {
          const t = title.replace(/\s+/g, '')
          return cardName
            .split(/[の・\s]/)
            .filter(w => w.length >= 2)
            .every(w => t.includes(w))
        }
      : null
    const onSale = await getMercariOnSale(browser, onSaleQuery, 0, cardNo, promoMust, cardName)
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
          oldestSaleDays = null
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

    // ★全経路が通る単一の関門。ここを迂回して savePriceHistory を呼ばないこと（guardPrice 参照）
    const verdict = guardPrice({ id, date, avg, low, high, priceSource, onSale, prev: readLatestRecord(id, date), sampleCount })
    if (!verdict.ok) {
      console.log(`不採用: ${verdict.reason} — スキップ（既存価格を維持）`)
      stats.skipped++
      return
    }

    savePriceHistory(id, date, avg, low, high, onSale, psa10, priceSource, sampleCount, soldTotal, oldestSaleDays, snkrdunkSaleDates, snkrdunkPsa10SaleDates)
    console.log(`完了 [${source}] 平均¥${avg.toLocaleString()}${onSaleLog}${psa10Log}`)
    stats.succeeded++
  } catch (e) {
    console.log('失敗（既存価格を維持）')
    console.error('  エラー:', e instanceof Error ? e.message : e)
    stats.failed++
  }
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
}

// BOXの出品件数をタイトルで絞る条件（2026-08-04）。
// カードは card_no で版を分離できるがBOXには番号が無く、メルカリの曖昧一致で
//   ・別弾（"ストームエメラルダ シュリンクなし BOX" の検索に "MEGA アビスアイ BOX シュリンク無し"）
//   ・BOXでない出品（"ポケモンカードゲーム ストームエメラルダ" だけの単品）
//   ・シュリンクあり/なしの取り違え
// が件数に乗って ¥1,109件 のような実態離れした数字になっていた。
//
// シュリンクの判定は「なし」を先に見る。"シュリンクなし" は "シュリンク" を含むので
// 単純な包含判定だと「あり」にも一致してしまう。
// alts: このいずれかが書かれていること（"福岡" と "フクオカ" のような表記ゆれを許すためOR）
// forbidden: これが書かれていたら不採用。姉妹商品（他地域のスペシャルBOX）を弾くのに使う。
//   3地域まとめ売りは "トウホク ヒロシマ フクオカ" のように全部書くので、
//   「自分の地域が書いてある」だけでは通ってしまう。カード側で兄弟レアリティを見るのと同じ考え方。
// required: これが**全部**書かれていること。セット商品で「地域名＋BOX」しか見ないと、
//   その店で買った別商品のBOX（「ポケモンセンターフクオカ産 シュリンク付きBOX」等）まで
//   同じ商品として数えてしまうため、商品名そのもの（例「スペシャル」）を要求する。
function boxTitleFilter(alts: string[], shrink: 'any' | 'yes' | 'no', forbidden: string[] = [], required: string[] = []): (title: string) => boolean {
  // 出品タイトルは弾名に空白や中黒を挟むことが多い（"ストーム エメラルダ"）ので詰めて比較する
  const squash = (s: string) => s.replace(/[\s　・]/g, '')
  const needles = alts.map(squash).filter(n => n !== '')
  const banned = forbidden.map(squash).filter(n => n !== '')
  const musts = required.map(squash).filter(n => n !== '')
  const NO_SHRINK = /シュリンク\s*(なし|無し|無|レス)/
  const HAS_SHRINK = /シュリンク\s*(付|あり|有)/

  return (title: string) => {
    const flat = squash(title)
    if (needles.length > 0 && !needles.some(n => flat.includes(n))) return false
    if (musts.length > 0 && !musts.every(n => flat.includes(n))) return false
    if (banned.some(n => flat.includes(n))) return false
    // 「BOX/ボックス/箱」表記が無いものは単品・パラパラの可能性が高いので数えない
    if (!/BOX|ＢＯＸ|ボックス|箱/i.test(title)) return false
    if (shrink === 'no') return NO_SHRINK.test(title)
    if (shrink === 'yes') return HAS_SHRINK.test(title) && !NO_SHRINK.test(title)
    return true
  }
}

/**
 * 混在系列に渡す出品件数＝「シュリンクあり + なし」の当日レコードの合算。
 * どちらか片方でも当日の件数が無ければ null を返し、混在系列は自分で数えた値に戻す
 * （片方だけの数字を「全体」として出すと、部分の方が大きい矛盾がまた起きるため）。
 * 片方でも打ち切り(capped)なら合算も下限値なので capped を立てる。
 */
function sumPartsOnSale(boxId: string, date: string): { count: number; capped: boolean } | null {
  const parts = [`box-${boxId}-shrink`, `box-${boxId}-noshrink`].map(id => {
    try {
      const data: PriceHistory = JSON.parse(fs.readFileSync(path.join(pricesDir, `${id}.json`), 'utf-8'))
      return data.history.find(r => r.date === date) ?? null
    } catch { return null }
  })
  if (parts.some(r => r?.on_sale == null)) return null
  return {
    count: parts.reduce((a, r) => a + Number(r!.on_sale), 0),
    capped: parts.some(r => r!.on_sale_capped === true),
  }
}

async function scrapeBox(
  browser: Browser,
  id: string,
  searchQuery: string,
  label: string,
  date: string,
  stats: { succeeded: number; skipped: number; failed: number },
  // 弾名（表記ゆれをORで許す）とシュリンク種別。**成約価格と出品件数の両方**に効く。
  // 2026-08-13 まで件数側にしか掛かっておらず、価格側はメルカリの曖昧一致任せだったため
  // シュリンクあり/なしが分離できていなかった（scrapeMercariSoldAvg の titleMust 参照）。
  titleAlts: string[],
  shrink: 'any' | 'yes' | 'no',
  titleForbidden: string[] = [],
  titleRequired: string[] = [],
  // 出品件数を自前の検索ではなく外から与える（混在系列＝あり+なしの合算に使う）。
  // null なら従来どおり自分で数える
  onSaleOverride: { count: number; capped: boolean } | null = null
) {
  process.stdout.write(`  [${label}] スクレイピング中... `)
  // 成約・出品で同一の条件を使う（片方だけに掛けると「価格はあり/なし混在、件数だけ分離」に
  // なり、両者が食い違う）
  const titleMust = boxTitleFilter(titleAlts, shrink, titleForbidden, titleRequired)
  try {
    let avg: number | null = null
    let boxLow = 0, boxHigh = 0
    let soldTotal: number | null = null
    let oldestSaleDays: number | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      // BOXの代表値は成約分布の中位バンド 35th〜65th（＝中央値まわり）を採用する。
      // 以前は床値寄りの 20th〜35th だったが、これは「高額な状態良・付属品付き出品の裾」を
      // 避ける目的に対して行き過ぎで、古い高額弾を系統的に安く表示していた
      // （例 タッグボルト: 実勢中央値¥380,000に対し表示¥231,000＝-34%）。
      // 高値テールは removeOutliers（中央値の0.5〜1.5倍のみ採用）が既に落としているので、
      // 中位バンドでも「高すぎ」側には戻らない。
      // trimTopPct=0: BOXは中位バンド(35-65th)を明示的に取るので、追加の高値カットはしない
      // （2026-07-27 に床値バンドから中位バンドへ戻した経緯があり、二重に下げてはいけない）
      const result = await scrapeMercariSoldAvg(browser, searchQuery, 0.35, 0.65, null, 0, null, titleMust)
      if (result != null) {
        avg = result.avg; boxLow = result.low; boxHigh = result.high; soldTotal = result.soldTotal
        oldestSaleDays = result.oldestSaleDays
        if (result.windowDays == null || result.windowDays > 90) {
          const w = result.windowDays == null ? '全期間' : `${result.windowDays}日`
          process.stdout.write(`[成約が薄い→${w}まで拡張(最古${result.oldestSaleDays ?? '?'}日前)] `)
        }
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
    const scraped = await getMercariOnSale(browser, onSaleQuery, Math.round(avg * 0.4), null, titleMust)
    // 混在系列は件数だけ「あり+なし」で置き換える（ask は自分の検索の分布をそのまま使う）。
    //
    // 【なぜ自分で数えないか】検索は価格昇順で最大3ページ（約300件）しか読めない。混在系列の
    // クエリ（"{弾名} 未開封 BOX"）は3つの中で最も広いので、安いパック単品や端数が先に300件を
    // 埋めてしまい、**本物のBOX出品に到達する前に打ち切られる**。結果、部分が全体を超える。
    //   実測(2026-08-28) ストームエメラルダ: 混在58 < あり173 + なし91 = 264
    //   （混在は拾えた出品が3件未満で ask_low/ask_mid すら取れていなかった＝到達できていない証拠）
    //   アビスアイは混在2件に対しシュリンクなし単体で124件と、さらに極端だった。
    // 合算なら定義から 部分 ≦ 全体 が保証される。取りこぼすのは「シュリンク表記が無い出品」だが、
    // 到達すらできていない数字を並べるより筋が通る。
    const onSale = onSaleOverride != null
      ? { ...scraped, count: onSaleOverride.count, capped: onSaleOverride.capped }
      : scraped

    // ★カードと同じ関門を通す。BOXはこれまで無防備で、成約が薄い弾で検索窓が90日超に
    // 拡張されると古い高値が混ざり +61% の偽の急騰が出ていた（蒼空ストリーム シュリンクあり）
    const verdict = guardPrice({ id, date, avg, low: boxLow, high: boxHigh, priceSource: 'mercari', onSale, prev: readLatestRecord(id, date) })
    if (!verdict.ok) {
      console.log(`不採用: ${verdict.reason} — スキップ（既存価格を維持）`)
      stats.skipped++
      return
    }

    // BOX相場は常にメルカリ成約の中位バンド由来
    savePriceHistory(id, date, avg, boxLow, boxHigh, onSale, null, 'mercari', undefined, soldTotal, oldestSaleDays)
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
  // 同名カードのレアリティ一覧も持つ。番号を書かない出品を「レアリティが一意なら採る」と
  // 救済するのに使う（matchesCardNo 参照）
  const siblingRarities = new Map<string, string[]>()
  for (const card of getAllCards()) {
    const key = `${card.box_id}|${card.card_name}`
    siblingCount.set(key, (siblingCount.get(key) ?? 0) + 1)
    siblingRarities.set(key, [...(siblingRarities.get(key) ?? []), card.rarity])
  }
  const cardNoFor = (card: { box_id: string; card_name: string; card_no?: string; rarity: string }): CardNo | null => {
    const no = parseCardNo(card.card_no)
    if (!no) return null
    const key = `${card.box_id}|${card.card_name}`
    const others = (siblingRarities.get(key) ?? []).filter(r => r !== card.rarity)
    return {
      ...no,
      strict: (siblingCount.get(key) ?? 0) > 1,
      rarity: card.rarity,
      siblingRarities: others,
    }
  }

  try {
    for (const card of cards) {
      const boxName = boxMap.get(card.box_id) ?? ''
      // プロモは card_name（例「トウホクのピカチュウ」）が一意なので box_name/英字レアを付けず
      // カナ「プロモ」だけ添えてヒット件数を確保する（人工box名を付けると0件になる）
      // それ以外: BOXコード（M2/M4等）は出品タイトルに入らないため除外して一致件数を増やす
      //
      // ⚠️ 数字の番号を持つプロモ（25thプロモ = S8a-P "001/025" 等）だけは番号で引く（2026-08-22）。
      // このタイプは card_name が一意でない（「リザードン」のプロモは他にも大量にある）ため
      // 「カード名＋プロモ」だと別カードの成約が混ざる。matchesCardNo は strict でない限り
      // **番号を書かないタイトルを通す**ので、成約側は検索クエリ自体を絞る必要がある。
      //   実測: 「カメックス プロモ」の成約¥4,529（実勢は¥15,000前後）。
      const promoCardNo = card.rarity === 'PROMO' && cardNoFor(card) != null ? card.card_no : null
      const query = promoCardNo
        ? `${card.card_name} ${promoCardNo}`
        : card.rarity === 'PROMO'
        ? `${card.card_name} プロモ`
        : `${card.card_name} ${card.rarity} ${boxName}`.replace(/\s+/g, ' ').trim()
      await scrapeCard(browser, getCardSlug(card), query, `${card.card_name} ${card.rarity}`, date, stats, snkrdunkIds, card.card_name, card.rarity, boxName, cardNoFor(card), card.card_no ?? null)
    }

    if (boxes.length > 0) {
      console.log('\n── 未開封BOX ──')
      for (const box of boxes) {
        // シュリンクあり/なしを分けて取得（相場が別物なので混ぜると実勢とズレる）。
        // ⚠️ 分離しているのは**クエリではなくタイトル条件（boxTitleFilter）**。メルカリの検索は
        // 「シュリンクなし」で引いても「シュリンク付き」の出品を大量に返す（実測で114件中70件）。
        // クエリはあくまで母集団を寄せるためのもので、あり/なしの判定はタイトルで行う。
        //
        // ⚠️ **混在系列より先に走らせること**。混在の出品件数はこの2つの合算にするため
        // （理由は scrapeBox 内 onSaleOverride のコメント）。
        await scrapeBox(browser, `box-${box.box_id}-shrink`, `${box.box_name} 未開封 シュリンク付き 1BOX`, `${box.box_name} シュリンクあり`, date, stats, [box.box_name], 'yes')
        await scrapeBox(browser, `box-${box.box_id}-noshrink`, `${box.box_name} 未開封 シュリンクなし 1BOX`, `${box.box_name} シュリンクなし`, date, stats, [box.box_name], 'no')
        // 混在系列（後方互換・予想の入力・変異ファイルが無い間のフォールバック表示に使う）
        // "1BOX" を明示して複数BOXロットを排除
        await scrapeBox(
          browser, `box-${box.box_id}`, `${box.box_name} 未開封 1BOX`, `${box.box_name} 未開封BOX`,
          date, stats, [box.box_name], 'any', [], [], sumPartsOnSale(box.box_id, date),
        )
      }
    }

    // ── セット商品（ポケセン等）: パックBOXではなく“セット”の相場を地域ごとに取得 ──
    const setBoxEntries = Object.entries(SET_BOXES).filter(([boxId]) => !boxFilter || boxId === boxFilter)
    if (setBoxEntries.length > 0) {
      console.log('\n── セット商品（スペシャルBOX等） ──')
      for (const [boxId, products] of setBoxEntries) {
        for (const p of products) {
          // 同じ弾の他地域セットの名前は「書いてあったら不採用」に回す。
          // 3地域まとめ売りが各地域の件数に3重計上されるのを防ぐ
          const others = products.filter(o => o.setId !== p.setId).flatMap(o => o.titleAny ?? [o.label])
          await scrapeBox(
            browser, `box-${boxId}-${p.setId}`, p.query, `${boxMap.get(boxId) ?? boxId} ${p.label}セット`,
            date, stats, p.titleAny ?? [p.label], 'any', others, p.titleAll ?? [],
          )
        }
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n完了: ${stats.succeeded}件更新, ${stats.skipped}件スキップ, ${stats.failed}件失敗`)
}

// 直接実行された時だけスクレイプする。guardPrice の回帰テスト(verify-price-guard.ts)が
// この関数を import するため、モジュール読み込みだけでブラウザが起動しないようにしている
const entry = (process.argv[1] ?? '').replace(/\\/g, '/')
if (/scrape-prices\.(ts|js|mts|cts)$/.test(entry)) main()
