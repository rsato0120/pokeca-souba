import { getAllCards, getAllBoxes, getCardSlug, getPriceHistory } from '@/lib/data'
import { isDeckUtilityCard } from '@/lib/card-kind'
import { midOf } from '@/lib/market'
import type { Card } from '@/types/pokeca'

// ── 相場指数（SOUBA指数） ──
//
// 「このカードが上がった」だけでは、市場全体が上げた日に一緒に上げただけなのか、
// 市場に逆らって強いのかが区別できない。株の日経平均にあたる基準線をここで作る。
//
// 方式は **等ウェイトの連鎖指数（chain-linked）**。
//   index_t = index_{t-1} × trimmedMean( p_t / p_{t-1} )   ※両日に観測があるカードだけで集計
//
// 時価総額加重にしない理由: ¥50万のSARが1枚いるだけで指数がその1枚の値動きになる。
// 「相場全体の体感」を出したいので、1枚1票の等ウェイトにする。
//
// 連鎖にする理由: カードは日々追加され、薄商い銘柄は観測が飛ぶ。
// 「基準日の価格で割る」固定基準だと、途中参加のカードを一切入れられないか、
// 入れた日に指数が飛ぶ。連鎖なら「その日に両端が観測できたカード」だけで
// 日次リターンを作れるので、母集団が変わっても段差が出ない。

/** 指数に採用する最小カード数。これを下回る日は前日値を据え置く（薄い日に指数が暴れるのを防ぐ） */
const MIN_CONTRIBUTORS = 12

// 基準日（=100 を置く日）にはもっと厳しい条件を課す。
// 計測初期は数十枚しか観測が無く、その数十枚の値動きが以降の全期間の倍率を決めてしまう。
// 母集団が十分に厚くなった日まで待ってから指数を建てる。
const MIN_BASE_CONTRIBUTORS = 100

/** 1日リターンの採用上限。これを超える動きは汚染（出所フリップ・誤マッチ）の疑いが濃いので指数から外す */
const MAX_DAILY_RATIO = 1.25

/** 指数を建てる最小の銘柄数。これに満たないグループ（レアリティ・弾）は指数を作らない */
const MIN_GROUP_SIZE = 15

/** 指数として出す最小の点数。追加直後の弾は数点しか無く、線として読めないので出さない */
const MIN_SERIES_POINTS = 14

export interface IndexPoint {
  date: string
  value: number
  /** その日のリターン計算に使えたカード数（薄い日を画面で注記できるように残す） */
  contributors: number
}

export interface MarketIndex {
  key: string
  label: string
  /** 古い順 */
  series: IndexPoint[]
  /** 指数に採用しているカード数（全期間で一度でも寄与したもの） */
  members: number
}

type Series = Map<string, number>   // date -> mid

// 日次リターンの代表値は **刈り込み平均（trimmed mean）**。上下 TRIM_RATIO ずつを
// 捨ててから残りを平均する。
//
// ⚠ 中央値はこのデータでは使えない。薄商いのカードは前日と同じ値のまま据え置かれる日が
//   多く、全体の半分以上が「変化なし」になる。すると中央値は毎日ぴったり 1.0 になり、
//   指数が何日も 100.00 で固まったあと突然跳ねる（実装して確認済み）。
//   刈り込み平均なら、動いた銘柄の分だけ素直に動きつつ、出所フリップや誤マッチによる
//   単発の飛び（このデータで繰り返し出ている汚染）は両端で落ちる。
const TRIM_RATIO = 0.1

function trimmedMean(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const cut = Math.floor(s.length * TRIM_RATIO)
  const core = cut > 0 && s.length - cut * 2 >= 3 ? s.slice(cut, s.length - cut) : s
  return core.reduce((a, b) => a + b, 0) / core.length
}

function buildSeries(cardId: string): Series | null {
  const records = getPriceHistory(cardId)?.history ?? []
  if (records.length < 2) return null
  const m: Series = new Map()
  for (const r of records) {
    const v = midOf(r)
    if (v > 0) m.set(r.date, v)
  }
  return m.size >= 2 ? m : null
}

/**
 * 連鎖指数を組む。series は「カードごとの date→価格」の集合。
 * 基準日（最初に baseMin を満たした日）を 100 とする。
 */
function chainLink(seriesList: Series[]): IndexPoint[] {
  const dates = [...new Set(seriesList.flatMap((s) => [...s.keys()]))].sort()
  if (dates.length < 2) return []

  // 採用条件は母集団の大きさに比例させる。固定本数にすると、
  // 全体指数（400枚超）にちょうどいい閾値が、レアリティ別・弾別（十数枚）では
  // 一度も満たされず指数が建たない。割合で見て、下限だけ固定する。
  const size = seriesList.length
  const baseMin = Math.max(MIN_CONTRIBUTORS, Math.min(MIN_BASE_CONTRIBUTORS, Math.ceil(size * 0.6)))
  const dailyMin = Math.max(5, Math.min(MIN_CONTRIBUTORS, Math.ceil(size * 0.4)))

  const out: IndexPoint[] = []
  let value = 100
  let prevDate: string | null = null

  for (const date of dates) {
    if (prevDate == null) {
      // 基準日は「その日に観測があるカードが十分いる日」まで探す。
      // 最初期の1〜2枚しか無い日を基準にすると、そこからの倍率が意味を持たない。
      const n = seriesList.filter((s) => s.has(date)).length
      if (n < baseMin) continue
      prevDate = date
      out.push({ date, value, contributors: n })
      continue
    }

    const ratios: number[] = []
    for (const s of seriesList) {
      const now = s.get(date)
      const prev = s.get(prevDate)
      if (now == null || prev == null || prev <= 0) continue
      const r = now / prev
      // 汚染由来の飛びは指数に入れない（値を捏造せず、その1枚をその日だけ外す）
      if (r > MAX_DAILY_RATIO || r < 1 / MAX_DAILY_RATIO) continue
      ratios.push(r)
    }

    if (ratios.length >= dailyMin) {
      value = value * trimmedMean(ratios)
    }
    // 薄い日は value を据え置いたまま点を打つ（線が途切れるより、動かない方が実態に近い）
    out.push({ date, value, contributors: ratios.length })
    prevDate = date
  }

  return out
}

function eligibleCards(): Card[] {
  return getAllCards().filter((c) => !isDeckUtilityCard(c))
}

// 指数は全カードの価格履歴を舐めるので、ビルド中は結果を使い回す
let cache: Map<string, MarketIndex> | null = null

function computeAll(): Map<string, MarketIndex> {
  if (cache) return cache

  const cards = eligibleCards()
  const withSeries = cards
    .map((card) => ({ card, series: buildSeries(getCardSlug(card)) }))
    .filter((x): x is { card: Card; series: Series } => x.series != null)

  const result = new Map<string, MarketIndex>()

  const add = (key: string, label: string, members: { card: Card; series: Series }[]) => {
    if (members.length < MIN_GROUP_SIZE) return
    const series = chainLink(members.map((m) => m.series))
    if (series.length < MIN_SERIES_POINTS) return
    result.set(key, { key, label, series, members: members.length })
  }

  add('all', '相場指数（全体）', withSeries)

  const boxNames = new Map(getAllBoxes().map((b) => [b.box_id, b.box_name]))
  const byBox = new Map<string, { card: Card; series: Series }[]>()
  const byRarity = new Map<string, { card: Card; series: Series }[]>()
  for (const m of withSeries) {
    const b = m.card.box_id
    const r = m.card.rarity
    if (!byBox.has(b)) byBox.set(b, [])
    if (!byRarity.has(r)) byRarity.set(r, [])
    byBox.get(b)!.push(m)
    byRarity.get(r)!.push(m)
  }
  for (const [boxId, members] of byBox) add(`box:${boxId}`, boxNames.get(boxId) ?? boxId, members)
  for (const [rarity, members] of byRarity) add(`rarity:${rarity}`, `${rarity} 指数`, members)

  cache = result
  return result
}

export function getMarketIndex(key = 'all'): MarketIndex | null {
  return computeAll().get(key) ?? null
}

/** 画面のセレクタに出す指数の一覧。全体 → レアリティ（銘柄数順）→ 弾（新しい順） */
export function getIndexMenu(): { key: string; label: string; members: number }[] {
  const all = [...computeAll().values()]
  const pick = (prefix: string) =>
    all
      .filter((i) => i.key.startsWith(prefix))
      .sort((a, b) => b.members - a.members)
      .map((i) => ({ key: i.key, label: i.label, members: i.members }))

  return [
    ...all.filter((i) => i.key === 'all').map((i) => ({ key: i.key, label: i.label, members: i.members })),
    ...pick('rarity:'),
    ...pick('box:'),
  ]
}

/** 指数の N 日変化率(%)。系列の末尾（最新）と、そこから days 日前を比べる */
export function indexChangePct(index: MarketIndex, days: number): number | null {
  const s = index.series
  if (s.length < 2) return null
  const last = s[s.length - 1]
  const targetMs = Date.parse(`${last.date}T00:00:00+09:00`) - days * 86400000

  // days 日前ちょうどの点は無いことがある（欠測）。それ以前で最も近い点を使う
  let base: IndexPoint | null = null
  for (let i = s.length - 1; i >= 0; i--) {
    if (Date.parse(`${s[i].date}T00:00:00+09:00`) <= targetMs) { base = s[i]; break }
  }
  if (base == null) base = s[0]
  if (base.value <= 0 || base.date === last.date) return null
  return ((last.value - base.value) / base.value) * 100
}

/**
 * 1枚のカードの「市場比」。カードの N 日変化率から、同じ期間の指数の変化率を引く。
 * 正なら市場より強い（株でいう相対力）。
 */
export function relativeStrength(
  cardChangePct: number | null,
  indexKey: string,
  days: number,
): { rel: number; indexPct: number } | null {
  if (cardChangePct == null) return null
  const idx = getMarketIndex(indexKey) ?? getMarketIndex('all')
  if (!idx) return null
  const ip = indexChangePct(idx, days)
  if (ip == null) return null
  return { rel: cardChangePct - ip, indexPct: ip }
}
