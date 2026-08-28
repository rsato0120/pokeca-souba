import Link from 'next/link'
import { getAllCards, getAllBoxes, getCardSlug, getBoxById, getForecast, getPriceHistory, getPriceExtremes, getBuyTheses, getLastUpdate } from '@/lib/data'
import { extremeHitToday } from '@/lib/extremes'
import { selectBuyCandidates, type BuyInput } from '@/lib/buy-signals'
import { isDeckUtilityCard } from '@/lib/card-kind'
import { sparkSeries, prevUpPct, rankByUpPct, todayJST, midOf } from '@/lib/market'
import type { Card, PriceRecord } from '@/types/pokeca'
import SearchBar from '@/components/SearchBar'
import type { SearchCard } from '@/components/SearchBar'
import BoxSelector from '@/components/BoxSelector'
import OripaBanner from '@/components/OripaBanner'
import BuyPicks, { type BuyPick } from '@/components/BuyPicks'
import CommunityPicks, { type PickCard } from '@/components/CommunityPicks'
import TrendingCards, { type TrendCard } from '@/components/TrendingCards'
import PriceTicker, { type TickerItem } from '@/components/PriceTicker'
import Sparkline from '@/components/Sparkline'
import VisitorStrip, { type MarketCard } from '@/components/VisitorStrip'
import UpdateClock from '@/components/UpdateClock'
import SiteHeader from "@/components/SiteHeader"
import MarketIndexChart, { type IndexWire } from '@/components/MarketIndexChart'
import FeaturedTrio, { type TrioCard } from '@/components/FeaturedTrio'
import MarketPulse from '@/components/MarketPulse'
import HeatPicks, { type HeatPick } from '@/components/HeatPicks'
import AnomalyFeed, { type AnomalyRow } from '@/components/AnomalyFeed'
import { computeMarketTemp } from '@/lib/market-temp'
import { selectAnomalies } from '@/lib/anomaly'
import AccuracyStrip from '@/components/AccuracyStrip'
import { computeAccuracy } from '@/lib/accuracy'
import { getIndexMenu, getMarketIndex, indexChangePct } from '@/lib/index-series'

function formatBoxName(card: Card, boxes: ReturnType<typeof getAllBoxes>): string {
  const box = boxes.find((b) => b.box_id === card.box_id)
  return box?.box_name ?? card.box_id
}

export default function TopPage() {
  const cards = getAllCards()
  const boxes = getAllBoxes()

  // 各カードに予想データを紐付け
  const cardsWithForecast = cards
    .map((card) => ({
      card,
      forecast: getForecast(getCardSlug(card)),
    }))
    .sort((a, b) => (b.forecast?.overall.up_pct ?? 0) - (a.forecast?.overall.up_pct ?? 0))

  // 検索用データ（Client Componentに渡す）
  const searchCards: SearchCard[] = cards.map((card) => ({
    slug: getCardSlug(card),
    card_name: card.card_name,
    rarity: card.rarity,
    box_name: boxes.find((b) => b.box_id === card.box_id)?.box_name ?? card.box_id,
    up_pct: getForecast(getCardSlug(card))?.overall.up_pct ?? null,
  }))

  // 「みんなの予想 注目カード」用の対応表。どのカードに票が入っているかはビルド時に
  // 分からないので、id→表示情報を丸ごと渡してクライアント側で突き合わせる。
  // 画像URLまで含めても数十KBに収まるので、票のたびに再ビルドするより軽い。
  const pickCards: PickCard[] = cards.map((card) => ({
    id: getCardSlug(card),
    name: card.card_name,
    rarity: card.rarity,
    image: card.image_url ?? null,
    aiUp: getForecast(getCardSlug(card))?.overall.up_pct ?? null,
  }))

  // 価格変化・需給データ計算
  type CardMetrics = {
    card: Card
    slug: string
    records: PriceRecord[]
    spark: number[]
    currentMid: number
    dayChange: number | null
    weekChange: number | null
    onSale: number | null
    forecast: ReturnType<typeof getForecast>
  }

  // 代表値は src/lib/market.ts(実体は extremes.ts) の midOf に統一する。
  // ここに独自実装を置くと、カード詳細・極値と違う金額が出る（53%のカードでズレていた）。
  const mid = midOf

  const metrics: CardMetrics[] = cards.map((card) => {
    const slug = getCardSlug(card)
    const history = getPriceHistory(slug)
    const records = history?.history ?? []
    const today = records[0]
    const yesterday = records[1]
    const weekAgo = records[7]
    return {
      card,
      slug,
      records,
      spark: sparkSeries(records),
      currentMid: today ? mid(today) : 0,
      dayChange: (() => { const v = today && yesterday ? ((mid(today) - mid(yesterday)) / mid(yesterday)) * 100 : null; return v !== null && Math.abs(v) > 20 ? null : v })(),
      weekChange: (() => { const v = today && weekAgo ? ((mid(today) - mid(weekAgo)) / mid(weekAgo)) * 100 : null; return v !== null && Math.abs(v) > 35 ? null : v })(),
      onSale: today?.on_sale ?? null,
      forecast: getForecast(slug),
    }
  }).filter((c) => c.currentMid > 0)

  // ── 「今日の話」をする節に混ぜてよいカードか ──
  //
  // 出品数の増減・前日比・本日の高値安値更新は、どれも「直近2つの観測を並べた差」で作る。
  // ところが観測が止まっているカード（成約が薄くスクレイプが件数不足でスキップされ続ける等）が
  // あり、その2点が1週間以上離れていることがある。日付を見ないと**先週の変化が「前日比」として
  // 今日の欄に並ぶ**（実例: ラティアス&ラティオスGX は 8/19 の1つ前が 8/10 で9日空いていた）。
  //
  // そこで「サイト全体の最新日に追随していること」と「前日比の相手が古すぎないこと」の
  // 2つを満たすカードだけを、今日を語る節に通す。
  const FRESH_DAYS = 2     // サイト全体の最新日からこれ以上離れた観測は今日の話に混ぜない
  const PAIR_MAX_GAP = 3   // 直近2観測がこれ以上離れていたら「前日比」と呼べない
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)

  // サイト全体の最新日は**最頻値**で取る。数枚だけ翌日に取り直されることがあるので、
  // 最大値にすると1枚に引きずられて他の全カードが「古い」と判定される（最終更新の表示と同じ考え方）
  const latestCounts = new Map<string, number>()
  for (const m of metrics) {
    const d = m.records[0]?.date
    if (d) latestCounts.set(d, (latestCounts.get(d) ?? 0) + 1)
  }
  const siteLatest = [...latestCounts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? todayJST()

  // 観測が今日ぶんで、かつ直近2点が隣り合っているカードだけ true
  const isCurrent = (m: CardMetrics): boolean => {
    const d0 = m.records[0]?.date
    const d1 = m.records[1]?.date
    if (!d0 || !d1) return false
    return dayDiff(siteLatest, d0) <= FRESH_DAYS && dayDiff(d0, d1) <= PAIR_MAX_GAP
  }

  // 価格から作るランキング枠の共通条件。グッズ・ポケモンのどうぐ・スタジアム・エネルギーは
  // コレクター相場の話ではないので、順位を付けて推し出す枠には出さない
  // （カード詳細・収録弾一覧・検索には引き続き出る）
  const isRankable = (m: CardMetrics): boolean => isCurrent(m) && !isDeckUtilityCard(m.card)

  // 「みんなの注目ランキング」用の対応表。どのカードが見られているかはビルド時には分からないので、
  // CommunityPicks と同じく id→表示情報を丸ごと渡してクライアント側で突き合わせる。
  // 価格が欠測しているカードも開かれる（＝ランキングに載り得る）ので、metrics ではなく cards から作る。
  const metricsBySlug = new Map(metrics.map((m) => [m.slug, m]))
  const trendCards: TrendCard[] = cards.map((card) => {
    const slug = getCardSlug(card)
    const m = metricsBySlug.get(slug)
    return {
      id: slug,
      name: card.card_name,
      rarity: card.rarity,
      image: card.image_url ?? null,
      price: m && m.currentMid > 0 ? m.currentMid : null,
      dayChange: m?.dayChange ?? null,
    }
  })

  // 相場ティッカー: 本日の値動きが大きい順。上げ下げの両方を混ぜて流す。
  // 前日比が無い日（スクレイプ未実施・欠測）は7日比で代替し、それも無ければ載せない。
  const tickerItems: TickerItem[] = metrics
    .filter(isRankable)
    .map((m) => ({ m, change: m.dayChange ?? m.weekChange }))
    .filter((x): x is { m: CardMetrics; change: number } => x.change != null && Math.abs(x.change) >= 1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 24)
    .map(({ m, change }) => ({
      slug: m.slug,
      name: m.card.card_name,
      rarity: m.card.rarity,
      mid: Math.round(m.currentMid),
      changePct: change,
    }))

  // 今買われているカード: 出品数が減ったカード（SR除外）
  // on_sale件数の前日比減少 = 在庫が捌けている = 買い需要の実態シグナル
  const buyingCards = [...metrics]
    .filter(m => m.card.rarity !== 'SR' && m.onSale != null && isRankable(m))
    .filter(m => {
      const slug = m.slug
      const history = getPriceHistory(slug)
      const yesterday = history?.history?.[1]
      return yesterday?.on_sale != null && m.onSale! < yesterday.on_sale
    })
    .sort((a, b) => {
      const histA = getPriceHistory(a.slug)?.history
      const histB = getPriceHistory(b.slug)?.history
      const prevA = histA?.[1]?.on_sale ?? a.onSale!
      const prevB = histB?.[1]?.on_sale ?? b.onSale!
      const changeA = (a.onSale! - prevA) / prevA
      const changeB = (b.onSale! - prevB) / prevB
      return changeA - changeB  // 減少率が大きい順
    })
    .slice(0, 5)

  // 今売られているカード: 出品数が増えたカード（SR除外）
  // on_sale件数の前日比増加 = 売り圧が高まっている = 売り需要の実態シグナル
  const sellingCards = [...metrics]
    .filter(m => m.card.rarity !== 'SR' && m.onSale != null && isRankable(m))
    .filter(m => {
      const slug = m.slug
      const history = getPriceHistory(slug)
      const yesterday = history?.history?.[1]
      return yesterday?.on_sale != null && m.onSale! > yesterday.on_sale
    })
    .sort((a, b) => {
      const histA = getPriceHistory(a.slug)?.history
      const histB = getPriceHistory(b.slug)?.history
      const prevA = histA?.[1]?.on_sale ?? a.onSale!
      const prevB = histB?.[1]?.on_sale ?? b.onSale!
      const changeA = (a.onSale! - prevA) / prevA
      const changeB = (b.onSale! - prevB) / prevB
      return changeB - changeA  // 増加率が大きい順
    })
    .slice(0, 5)

  // 本日の高値・安値更新: 全期間の極値（data/price-extremes.json）を当日更新したカード。
  // 蓄積が浅いカードは extremeHitToday 側で除外される（新弾は初日が必ず最高かつ最安になるため）
  const extremeUpdates = metrics
    .filter(isRankable)
    .map(m => {
      const ex = getPriceExtremes(m.slug)
      const latestDate = getPriceHistory(m.slug)?.history?.[0]?.date
      return { m, ex, hit: extremeHitToday(ex, latestDate) }
    })
    .filter((e): e is { m: CardMetrics; ex: NonNullable<typeof e.ex>; hit: 'high' | 'low' } => e.hit != null && e.ex != null)

  const highUpdates = extremeUpdates.filter(e => e.hit === 'high')
    .sort((a, b) => b.m.currentMid - a.m.currentMid).slice(0, 5)
  const lowUpdates = extremeUpdates.filter(e => e.hit === 'low')
    .sort((a, b) => b.m.currentMid - a.m.currentMid).slice(0, 5)

  // 価格急騰・急落: 前日比優先、なければ週間比
  const getChange = (m: CardMetrics) => m.dayChange ?? m.weekChange ?? 0
  const getChangeLabel = (m: CardMetrics) => m.dayChange != null ? '前日比' : '7日比'
  const changeCards = metrics.filter(m => isRankable(m) && (m.dayChange != null || m.weekChange != null))

  const surgeCards = [...changeCards]
    .filter(m => getChange(m) > 0)
    .sort((a, b) => getChange(b) - getChange(a))
    .slice(0, 5)

  const dropCards = [...changeCards]
    .filter(m => getChange(m) < 0)
    .sort((a, b) => getChange(a) - getChange(b))
    .slice(0, 5)

  // AI注目カード: AIが本当に「上がる」と見ているカードに限定する
  //  - 3ヶ月後の本線(m3)が現在より上（予想価格が上昇方向）
  //  - up_pct > down_pct（ネットで上昇寄りの判断）
  // 従来は up_pct 順だけで並べていたため、本線が下落・down_pct優勢のカードも
  // 「注目」に入り「価格が下がって見える」違和感があった。
  // ※直近の値動きでは絞らない（AIが+12%と見ている押し目カードを除外しないため）
  const fcM3Gain = (fc: ReturnType<typeof getForecast>): number | null => {
    const p = fc?.price_forecast
    if (!p) return null
    const cur = (p.current_low + p.current_high) / 2
    const m3 = (p.m3_low + p.m3_high) / 2
    return cur > 0 ? (m3 - cur) / cur : null
  }
  const isRising = (fc: ReturnType<typeof getForecast>): boolean => {
    if (!fc) return false
    if (fc.overall.up_pct <= fc.overall.down_pct) return false     // ネット上昇のみ
    const gain = fcM3Gain(fc)
    return gain != null && gain > 0                                // 本線が現在より上
  }
  const notableFromMetrics = [...metrics]
    .filter(m => isRising(m.forecast) && !isDeckUtilityCard(m.card))
    .sort((a, b) => (b.forecast?.overall.up_pct ?? 0) - (a.forecast?.overall.up_pct ?? 0))
  // 価格データがまだ無いカードも拾えるよう、不足分は「上昇予想」のAI予想順で補完
  const notableBackfill = cardsWithForecast.filter(
    c => isRising(c.forecast) && !isDeckUtilityCard(c.card)
      && !notableFromMetrics.some(m => m.slug === getCardSlug(c.card))
  )
  const risingPool = notableFromMetrics.length >= 5
    ? notableFromMetrics
    : [...notableFromMetrics, ...notableBackfill]
  // 1弾に偏らないよう、各弾上限2枚で分散して選ぶ（足りなければ上限を無視して埋める）。
  // 予想スコアのスケールが弾ごとに違っても、ホームが特定弾だけで埋まるのを防ぐ。
  const diversifyByBox = <T extends { card: Card }>(items: T[], limit: number, maxPerBox: number): T[] => {
    const picked: T[] = []
    const count: Record<string, number> = {}
    for (const it of items) {
      if (picked.length >= limit) break
      const b = it.card.box_id
      if ((count[b] ?? 0) < maxPerBox) { picked.push(it); count[b] = (count[b] ?? 0) + 1 }
    }
    if (picked.length < limit) {
      for (const it of items) {
        if (picked.length >= limit) break
        if (!picked.includes(it)) picked.push(it)
      }
    }
    return picked
  }
  const notableCards = diversifyByBox(risingPool, 5, 2)

  // ── AIが買うべきカード: 決定論シグナルで候補選定 → 上位に厚いAI論拠を紐付け ──
  const buyInputs: BuyInput[] = cards.map((card) => {
    const slug = getCardSlug(card)
    return {
      card,
      slug,
      forecast: getForecast(slug),
      history: getPriceHistory(slug)?.history ?? [],
      extremes: getPriceExtremes(slug),
    }
  })
  const buyTheses = getBuyTheses()
  const buyPicks: BuyPick[] = selectBuyCandidates(buyInputs, 6, 2).map((c) => ({
    card: c.card,
    slug: c.slug,
    boxName: formatBoxName(c.card, boxes),
    mid: c.mid,
    upsidePct: c.upsidePct,
    upPct: c.card && getForecast(c.slug)?.overall.up_pct != null ? getForecast(c.slug)!.overall.up_pct : null,
    factors: c.factors,
    thesis: buyTheses[c.card.id] ?? null,
  }))

  // ── 看板: AIが見つけた「まだ上がっていないカード」 ──
  //
  // ⚠ 下の「AIが買うべきカード」(BuyPicks) と**同じ母集団から選ぶと上位が丸かぶりする**。
  //   どちらも selectBuyCandidates(buyInputs) を呼んでいたため、看板の3枚は
  //   買うべきカードの1〜3位とまったく同じ並びだった＝看板が独自機能になっていない。
  //
  // ここは名前どおり「**まだ上がっていない**」に絞る。直近7日の値動きが小さい
  // （±3%以内）カードだけを候補にし、すでに動いた銘柄は急騰ランキングと
  // 「買うべきカード」に任せる。これで2つの枠の役割が分かれる:
  //   看板 … これから動きそうだが、まだ動いていない
  //   買うべきカード … 動きの有無を問わず、いま買う妙味が大きい
  const STILL_QUIET_PCT = 3
  const quietInputs = buyInputs.filter((b) => {
    const m = metricsBySlug.get(b.slug)
    const w = m?.weekChange
    // 7日変化が取れないカードは「動いていない」と断定できないので候補にしない
    return w != null && Math.abs(w) <= STILL_QUIET_PCT
  })
  const heatPicks: HeatPick[] = selectBuyCandidates(quietInputs, 3, 1).map((c) => {
    const m = metricsBySlug.get(c.slug)
    const fc = getForecast(c.slug)
    return {
      slug: c.slug,
      name: c.card.card_name,
      rarity: c.card.rarity,
      cardNo: c.card.card_no,
      image: c.card.image_url ?? null,
      mid: c.mid,
      dayPct: m?.dayChange ?? null,
      heat: c.heat,
      upPct: fc?.overall.up_pct ?? null,
      m3Low: fc?.price_forecast.m3_low ?? null,
      m3High: fc?.price_forecast.m3_high ?? null,
      omens: c.omens,
      cautions: c.cautions,
      // 厚い論拠(BuyThesis)の見出しだけを短い理由として使う。全文はカード詳細で読ませる
      thesis: buyTheses[c.card.id]?.headline ?? null,
    }
  })

  // ── 看板: AI異変検知 ──
  // 価格がまだ動いていないのに在庫・取引件数・PSA10価格差・値動きの荒さが動いている銘柄。
  // 材料の揃わないシグナルは欠測として外し、画面に「対象外」と出す（src/lib/anomaly.ts 参照）。
  const anomalyRows: AnomalyRow[] = selectAnomalies(
    metrics
      .filter(m => !isDeckUtilityCard(m.card))
      .map(m => ({
        card: m.card,
        slug: m.slug,
        history: m.records,
        salesByDay: getPriceHistory(m.slug)?.sales_by_day,
        latestDate: siteLatest,
      })),
    4,
    2,
  ).map(a => ({ ...a, image: a.card.image_url ?? null }))

  // 「あなた」の帯（保有評価額・前回訪問からの値動き）に渡す一覧。
  // 個人の数字はクライアントにしか無いので、材料だけ全部渡して向こうで組ませる。
  //
  // 前日比の基準は**そのカードの1つ前の観測**（records[1]）。
  // 暦の前日で引くと、その日に取得できなかった薄商い銘柄は現在値と同じ日を指してしまい
  // 変化0になる（実データでは294枚中278枚が同じ日付に固まっているので影響が大きい）。
  // サイトの dayChange も records[1] 基準なので、こちらに揃える方が表示同士も食い違わない。
  const psaSeries = (records: PriceRecord[]): number[] =>
    records.filter((r) => r.psa10 != null).map((r) => r.psa10 as number)

  const marketCards: MarketCard[] = metrics.map((m) => {
    const psa = psaSeries(m.records)
    return {
      id: m.slug,
      name: m.card.card_name,
      rarity: m.card.rarity,
      mid: Math.round(m.currentMid),
      prevMid: m.records[1] ? Math.round(mid(m.records[1])) : null,
      psa10: psa[0] ?? null,
      prevPsa10: psa[1] ?? null,
    }
  })

  // ── AI予想順位の前日比 ──
  // data/predictions に日次スナップショットがあるので、同じ式で前日の順位表を作り直して差を取る。
  // カードを追加した直後は母数が変わって順位がまとめてずれるため、
  // 前日の記録が今日の9割に満たない日は変動を出さない（全部NEWになるのを防ぐ）。
  const upToday = metrics
    .map((m) => ({ id: m.slug, up: m.forecast?.overall.up_pct ?? null }))
    .filter((e): e is { id: string; up: number } => e.up != null)
  const upPrev = metrics
    .map((m) => ({ id: m.slug, up: prevUpPct(m.slug) }))
    .filter((e): e is { id: string; up: number } => e.up != null)
  const rankNow = rankByUpPct(upToday)
  const rankPrev = rankByUpPct(upPrev)
  const rankComparable = upPrev.length >= upToday.length * 0.9
  // 行に添える直近の値動き。予想だけあって価格が無いカードは空になる
  const sparkBySlug = new Map(metrics.map((m) => [m.slug, m.spark]))
  const rankDelta = (slug: string): number | null | 'new' => {
    if (!rankComparable || rankNow[slug] == null) return null
    if (rankPrev[slug] == null) return 'new'
    return rankPrev[slug] - rankNow[slug]   // 正 = 順位が上がった
  }

  // ── 最終更新の表記 ──
  // 日次バッチのスタンプ（data/last-update.json）があれば時刻まで出す。
  // 無い間は価格の最新日で代用するが、**最大値ではなく最頻値**を使う。
  // 数枚だけ翌日に取り直されることがあり、最大値だと「大半は前日のデータなのに翌日更新」に見える。
  const dateCounts = new Map<string, number>()
  for (const m of metrics) {
    const d = m.records[0]?.date
    if (d) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1)
  }
  const modalDate = [...dateCounts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null

  const lastUpdate = getLastUpdate()
  const updatedLabel = lastUpdate
    ? (() => {
        const d = new Date(Date.parse(lastUpdate.updated_at) + 9 * 3600_000)
        return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      })()
    : modalDate
    ? `${Number(modalDate.slice(5, 7))}/${Number(modalDate.slice(8, 10))}`
    : null

  // ── 相場指数 ──
  // 全指数（全体・レアリティ別・弾別）をまとめて渡し、切替はクライアントで完結させる。
  // 値は小数2桁に丸めてから焼く（生の倍精度をそのまま出すと1点あたり20桁近く食う）。
  const indexWires: IndexWire[] = getIndexMenu().map((m) => {
    const idx = getMarketIndex(m.key)!
    return {
      key: m.key,
      label: m.label,
      members: m.members,
      points: idx.series.map((p) => [p.date, Math.round(p.value * 100) / 100] as [string, number]),
    }
  })

  // ── 今日の注目カード（3枚） ──
  // 上昇確率の高い順（notableCards は既に弾の偏りをならしてある）。
  // 現在相場・前日比は metrics から引く（forecast の current_low/high は予想生成時点の値なので、
  // 「今いくらか」を出す枠ではスクレイプ由来の実測を使う）
  const trioCards: TrioCard[] = notableCards.slice(0, 3).map(({ card, forecast }) => {
    const slug = getCardSlug(card)
    const m = metricsBySlug.get(slug)
    const o = forecast?.overall
    const stance = o
      ? (o.up_pct >= o.flat_pct && o.up_pct >= o.down_pct
          ? '強気'
          : o.down_pct >= o.flat_pct
          ? '弱気'
          : '中立')
      : null
    return {
      slug,
      name: card.card_name,
      rarity: card.rarity,
      cardNo: card.card_no,
      boxId: card.box_id,
      boxName: getBoxById(card.box_id)?.box_name ?? card.box_id,
      image: card.image_url ?? null,
      mid: m && m.currentMid > 0 ? Math.round(m.currentMid) : null,
      changePct: m?.dayChange ?? m?.weekChange ?? null,
      changeLabel: m?.dayChange != null ? '前日比' : m?.weekChange != null ? '7日比' : null,
      upPct: o?.up_pct ?? null,
      stance,
    }
  })

  // ── 市場サマリー（ヒーロー右） ──
  // ⚠ ここに出してよいのは**実データで裏付けられる指標だけ**。
  //   「取引件数(24h)」「総取引額(24h)」は出さない。成約数はスニダン売買履歴が唯一の実データ源で、
  //   BOXは61系列すべてに sales_by_day が無く、カードも直近7日の充填率が23.2%しかない
  //   （2026-08-28 実測）。24時間の件数も金額も裏が取れないので、置けば飾りの嘘になる。
  //   代わりに騰落銘柄数（advance/decline）を出す。指数と意味が繋がっていて実データで出せる。
  // AI予想の的中実績（/accuracy と同じ計算をそのまま使う）
  const accuracy = computeAccuracy()

  const allIndex = getMarketIndex('all')
  const indexLatest = allIndex?.series[allIndex.series.length - 1] ?? null
  const indexDayPct = allIndex ? indexChangePct(allIndex, 1) : null
  const advCount = changeCards.filter(m => getChange(m) > 0).length
  const decCount = changeCards.filter(m => getChange(m) < 0).length

  // AIの強弱。up_pct が down_pct を上回れば強気、下回れば弱気（拮抗は数えない）
  let bullishCount = 0
  let bearishCount = 0
  for (const m of metrics) {
    const o = m.forecast?.overall
    if (!o) continue
    if (o.up_pct > o.down_pct) bullishCount++
    else if (o.down_pct > o.up_pct) bearishCount++
  }

  // 市場温度。指数の計算(index-series.ts)は一切触らず、読み替えだけをここで作る
  const marketTemp = computeMarketTemp({
    advancers: advCount,
    decliners: decCount,
    indexWeekPct: allIndex ? indexChangePct(allIndex, 7) : null,
    bullish: bullishCount,
    bearish: bearishCount,
  })

  return (
    <div className="wrap">
      <SiteHeader />

      {/* 本日の値動きを流す帯。開いた瞬間に「動いている市場」だと分かるようヘッダ直下に置く */}
      <PriceTicker items={tickerItems} />

      {/* 保有評価額と「前回見たときから」。この端末に記録が無ければ何も描かれない */}
      <VisitorStrip cards={marketCards} />

      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--ink-faint)',
          letterSpacing: 'var(--ls-wide)',
          padding: 'var(--sp-2) 0 var(--sp-5)',
          borderBottom: '1px solid var(--hair)',
          marginBottom: 'var(--sp-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--sp-2)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {/* 最終更新は実際のバッチ実行時刻。次の更新までの残り時間は毎秒動く（＝止まっていないことが見える） */}
          <UpdateClock updatedLabel={updatedLabel} />
          {/* 「対象 ◯◯／◯◯／…」の弾の羅列は、弾が増えるほど行数を食うだけで
              読まれないので撤去した（下のドロップダウンで選べる） */}
        </span>
        <span style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Link href="/screener" className="pill pill-accent">スクリーナー →</Link>
          <Link href="/watchlist" className="pill">ウォッチリスト →</Link>
          <Link href="/accuracy" className="pill">AI的中実績 →</Link>
          <Link href="/portfolio" className="pill pill-accent">マイコレクション →</Link>
        </span>
      </div>

      {/* 価格の出所を明示（どこの数字かが分からないと相場サイトは信用されない） */}
      <div
        style={{
          fontSize: 'var(--fs-xs)',
          color: 'var(--ink-faint)',
          lineHeight: 1.7,
          marginBottom: 'var(--sp-5)',
        }}
      >
        価格はメルカリの成約実績とスニーカーダンクの実取引から毎日自動取得しています。
        カードごとに取引件数の多い方を採用し、出所は各カードのページに表示しています。
      </div>

      {/* ── ヒーロー: 何のサイトかを1行で言い切り、その場で検索させる ──
          右は市場サマリー。**実データで裏付けられる3指標だけ**を置いている（summaryRows のコメント参照） */}
      <section className="top-hero">
        <div>
          <h1 className="top-hero-title">
            ポケモンカードの<br />
            <span style={{ color: 'var(--accent)' }}>「これから」</span>が分かる。
          </h1>
          <p className="top-hero-sub">
            現在の相場から、AIが今後の価格を根拠つきで予想します。
          </p>
          <SearchBar cards={searchCards} />
          {/* 弾から探す導線は検索のすぐ下に置く。以前は看板セクションと指数チャートの下に
              あり、ファーストビューから完全に外れていた。「名前で探す」と「弾から探す」は
              同じ“探す”行為なので隣り合っている方が迷わない */}
          <BoxSelector
            marginTop={12}
            marginBottom={0}
            boxes={boxes
              .filter(b => b.certainty === 'released')
              .map(b => ({ box_id: b.box_id, box_name: b.box_name, release_ym: b.release_ym }))}
          />
        </div>

        <MarketPulse
          index={indexLatest?.value ?? null}
          indexDayPct={indexDayPct}
          indexDate={indexLatest?.date ?? null}
          temp={marketTemp}
          advancers={advCount}
          decliners={decCount}
          bullish={bullishCount}
          bearish={bearishCount}
        />
      </section>

      {/* ── 看板① AIが見つけた、まだ上がっていないカード ──
          サイトの強みを3秒で伝える枠なので、ファーストビュー直下に単独で置く */}
      {heatPicks.length > 0 && (
        <section className="sec">
          <h2 className="flag-title">
            AIが見つけた、<br />
            <span style={{ color: 'var(--accent)' }}>まだ上がっていないカード。</span>
          </h2>
          <p className="flag-sub">
            AIの上昇予想・割安度・在庫の減り方から、値動きが出る前の銘柄を毎日選び直しています。
          </p>
          <HeatPicks picks={heatPicks} />
        </section>
      )}

      {/* AI予想の的中実績。「AIが見つけた」と言い切る直後に、その予想がどれだけ
          当たってきたかを置く（材料は /accuracy と同じ computeAccuracy） */}
      <AccuracyStrip summary={accuracy} />

      {/* ── 看板② AI異変検知 ── */}
      <section className="sec">
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--accent)' }}>⚡</span>
          <span className="sec-title">AI異変検知</span>
          <span className="sec-sub">価格が動く前の需給の変化を拾う</span>
        </div>
        <p className="flag-sub" style={{ marginBottom: 'var(--sp-4)' }}>
          在庫・取引件数・PSA10との価格差・値動きの荒さを毎日見て、価格そのものがまだ動いていない銘柄だけを出しています。
        </p>
        <AnomalyFeed rows={anomalyRows} />
      </section>

      {/* 市場全体の基準線。個別カードの騰落を「市場と比べて」読むための土台なので、
          個別の枠より先に置く */}
      <MarketIndexChart indices={indexWires} />

      {/* ── 今日の注目カード（3枚） ──
          旧: 1枚だけを大きく出すヒーロー。すぐ下の「01」の1位と必ず同じカードになり
          先頭2ブロックが同じ情報を繰り返していたので3枚に広げた（FeaturedTrio.tsx 参照） */}
      {trioCards.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--accent)' }}>◆</span>
            <span className="sec-title">今日の注目カード</span>
            <span className="sec-sub">AIの上昇確率が高い順</span>
          </div>
          <FeaturedTrio cards={trioCards} />
        </div>
      )}


      {/* オリパ案件バナー（A8 / PR） */}
      <OripaBanner marginY={4} />

      {/* ── ★ AIが買うべきカード（厚い論拠つき） ── */}
      {buyPicks.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--accent)' }}>★</span>
            <span className="sec-title">AIが買うべきカード</span>
            <span className="sec-sub">割安度・AI予想・買い時シグナルから選定</span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', lineHeight: 1.7, marginBottom: 'var(--sp-4)' }}>
            現在の相場水準・AIの上昇予想・出品数の動き・希少性などを総合し、いま仕込む妙味があるとAIが判断したカードです。各カードの根拠を添えています（投資助言ではありません）。
          </div>
          <BuyPicks picks={buyPicks} />
        </div>
      )}

      {/* ── 01: AI予想 これからの注目カード ── */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">01</span>
          <span className="sec-title">AI予想 これからの注目カード</span>
          <span className="sec-sub">3ヶ月後の価格予想つき</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notableCards.map(({ card, forecast }, i) => {
            const slug = getCardSlug(card)
            const delta = rankDelta(slug)
            const rankStyle: React.CSSProperties = {
              fontFamily: 'var(--mincho)',
              fontSize: i < 2 ? 'var(--fs-xl)' : 'var(--fs-lg)',
              fontWeight: 800,
              color: i < 2 ? 'var(--accent)' : 'var(--ink-faint)',
              textAlign: 'center',
              minWidth: '34px',
            }
            const m3Low = forecast?.price_forecast.m3_low
            const m3High = forecast?.price_forecast.m3_high
            return (
              <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: '34px var(--thumb-w) 1fr auto' }}>
                <div>
                  <div style={rankStyle}>{i + 1}</div>
                  {/* AI予想順位の前日比。順位が動いていること自体が「生きている」合図になる */}
                  {delta != null && (
                    <div
                      style={{
                        fontFamily: 'var(--mono)', fontSize: '9px', textAlign: 'center', marginTop: '1px',
                        color: delta === 'new' ? 'var(--accent)' : delta > 0 ? 'var(--up)' : delta < 0 ? 'var(--down)' : 'var(--ink-faint)',
                      }}
                      title={delta === 'new' ? '前日は予想がなかったカード' : `AI予想順位の前日比（${rankNow[slug]}位）`}
                    >
                      {delta === 'new' ? 'NEW' : delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '—'}
                    </div>
                  )}
                </div>
                {card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image_url} alt={card.card_name} className="row-thumb" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                )}
                <div>
                  <div className="row-name">{card.card_name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--accent)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
                  </div>
                  <div className="row-meta">
                    {formatBoxName(card, boxes)} ・ {card.card_no}
                  </div>
                  {forecast && (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', color: 'var(--up)', marginTop: '2px', fontWeight: 600 }}>
                      上昇確率 {forecast.overall.up_pct}%
                      {m3Low && m3High && <span style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 'var(--sp-1)' }}>3ヶ月後 ¥{m3Low.toLocaleString()}〜{m3High.toLocaleString()}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <Sparkline values={sparkBySlug.get(slug) ?? []} wide />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>
                    {forecast ? `¥${forecast.price_forecast.current_low.toLocaleString()}〜` : '—'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── 01b: みんなの予想 注目カード ──
          AI予想ランキングの直後に置いて、AIと閲覧者の見立ての差がその場で見えるようにする。
          票は Supabase にあるのでクライアント側で取得する（票が0のうちは自分で消える） */}
      <CommunityPicks cards={pickCards} />

      {/* ── 01c: みんなの注目ランキング ──
          他の節が全部「価格」から作られているのに対し、ここだけ閲覧者の行動が元。
          価格が動く前の注目を拾えるので、値上がりランキングとは中身が被らない。
          人数は Supabase 側にあるのでクライアント取得（閲覧が貯まるまでは自分で消える） */}
      <TrendingCards cards={trendCards} />

      {/* ── 本日の高値・安値更新 ── */}
      {(highUpdates.length > 0 || lowUpdates.length > 0) && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--accent)' }}>★</span>
            <span className="sec-title">本日 最高値・最安値を更新したカード</span>
            <span className="sec-sub">計測開始以降でいちばん高い／安い水準</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...highUpdates, ...lowUpdates].map(({ m, ex, hit }) => (
              <Link key={m.slug} href={`/cards/${m.slug}`} className="row" style={{ gridTemplateColumns: 'var(--thumb-w) 1fr auto' }}>
                {m.card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.card.image_url} alt={m.card.card_name} className="row-thumb" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{m.card.rarity}</div>
                )}
                <div>
                  <div className="row-name">{m.card.card_name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--accent)', marginLeft: 'var(--sp-1)' }}>{m.card.rarity}</span>
                  </div>
                  <div className="row-meta">
                    ¥{Math.round(m.currentMid).toLocaleString()}
                    {' · '}
                    {hit === 'high'
                      ? <>これまでの最高 ¥{ex.high.value.toLocaleString()} を更新</>
                      : <>これまでの最安 ¥{ex.low.value.toLocaleString()} を更新</>}
                  </div>
                  <div className="row-meta" style={{ color: 'var(--ink-faint)' }}>
                    {ex.records}日分の記録（{ex.since.slice(5).replace('-', '/')}以降）
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', textAlign: 'right', minWidth: '56px' }}>
                  <span style={{ color: hit === 'high' ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                    {hit === 'high' ? '🔺 高値' : '🔻 安値'}
                  </span>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>
                    {hit === 'high' ? '更新' : '買い時水準'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <Sparkline values={m.spark} wide />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 02: 在庫吸収ランキング（旧「今買われているカード」）──
          中身の選定・並び順は変えていない。出品数が減る＝在庫が吸われている、という
          需給の話をしている枠なので、分析側の言葉に合わせて名前だけ変えた */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--up)' }}>🧹</span>
          <span className="sec-title">在庫吸収ランキング</span>
          <span className="sec-sub">出品数が減少＝市場の在庫が吸われている</span>
        </div>
        <p className="flag-sub" style={{ marginBottom: 'var(--sp-3)' }}>
          価格がまだ動いていなくても、売り物が減っていれば次に効いてくるのは値段です。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {buyingCards.length === 0 ? (
            <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>データ蓄積中（毎日自動更新）</div>
          ) : (
            buyingCards.map(({ card, slug, currentMid, weekChange, dayChange, onSale, forecast }) => {
              const change = weekChange ?? dayChange
              const upPct = forecast?.overall.up_pct ?? null
              return (
                <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: 'var(--thumb-w) 1fr auto' }}>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.card_name} className="row-thumb" />
                  ) : (
                    <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                  )}
                  <div>
                    <div className="row-name">{card.card_name}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--accent)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
                    </div>
                    <div className="row-meta">
                      ¥{Math.round(currentMid).toLocaleString()}
                      {onSale != null && <> · 出品中 {onSale.toLocaleString()}件</>}
                    </div>
                    {upPct != null && (
                      <div className="row-meta" style={{ color: upPct >= 45 ? 'var(--up)' : 'var(--ink-faint)' }}>
                        AI予想 上昇確率 {upPct}%
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', textAlign: 'right', minWidth: '56px' }}>
                    {change != null && (
                      <span style={{ color: change > 0 ? 'var(--up)' : 'var(--ink-faint)', fontWeight: 600 }}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>{weekChange != null ? '7日比' : '前日比'}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <Sparkline values={sparkBySlug.get(slug) ?? []} wide />
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* ── 03: 売り圧ランキング（旧「今売られているカード」）── */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--down)' }}>▲</span>
          <span className="sec-title">売り圧ランキング</span>
          <span className="sec-sub">出品数が増加＝売りたい人が増えている</span>
        </div>
        <p className="flag-sub" style={{ marginBottom: 'var(--sp-3)' }}>
          手放す人が増えている銘柄です。買うなら価格が落ち着くのを待つ判断もあります。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sellingCards.length === 0 ? (
            <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>データ蓄積中（毎日自動更新）</div>
          ) : (
            sellingCards.map(({ card, slug, currentMid, weekChange, dayChange, onSale, forecast }) => {
              const change = weekChange ?? dayChange
              const downPct = forecast?.overall.down_pct ?? null
              return (
                <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: 'var(--thumb-w) 1fr auto' }}>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.card_name} className="row-thumb" />
                  ) : (
                    <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                  )}
                  <div>
                    <div className="row-name">{card.card_name}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--accent)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
                    </div>
                    <div className="row-meta">
                      ¥{Math.round(currentMid).toLocaleString()}
                      {onSale != null && <> · 出品中 {onSale.toLocaleString()}件</>}
                    </div>
                    {downPct != null && downPct >= 30 && (
                      <div className="row-meta" style={{ color: 'var(--down)' }}>
                        AI予想 下落確率 {downPct}%
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', textAlign: 'right', minWidth: '56px' }}>
                    {change != null && (
                      <span style={{ color: change < 0 ? 'var(--down)' : 'var(--ink-faint)', fontWeight: 600 }}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>{weekChange != null ? '7日比' : '前日比'}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <Sparkline values={sparkBySlug.get(slug) ?? []} wide />
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* ── 04: 価格急落・急騰 ── */}
      {(surgeCards.length > 0 || dropCards.length > 0) && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no">04</span>
            <span className="sec-title">値動きランキング</span>
            <span className="sec-sub">実際の成約価格の変化率とAIの注目度</span>
          </div>

          {/* 3カラム（急騰／急落／AI注目）。上げ・下げ・AIの見立てを横に並べて突き合わせられる形にする。
              3列目だけ軸が違う（実績ではなく予想）ので、見出しの色をアクセントにして区別する */}
          <div className="rank-cols">
            {/* 急騰 */}
            <div>
              <div className="eyebrow" style={{ color: 'var(--up)', fontWeight: 600, marginBottom: 'var(--sp-2)' }}>▲ 急騰</div>
              {surgeCards.length === 0 ? (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-faint)' }}>データ蓄積中</div>
              ) : surgeCards.map(m => {
                const change = getChange(m)
                const label = getChangeLabel(m)
                return (
                  <Link key={m.slug} href={`/cards/${m.slug}`} className="row" style={{ gridTemplateColumns: '36px 1fr auto', gap: 'var(--sp-2)' }}>
                    {m.card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.card.image_url} alt={m.card.card_name} className="row-thumb" style={{ width: '36px', height: '50px' }} />
                    ) : (
                      <div className="row-thumb row-thumb-ph" style={{ width: '36px', height: '50px' }}>{m.card.rarity}</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="row-name" style={{ fontSize: 'var(--fs-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.card.card_name}</div>
                      <div className="row-meta">
                        {m.card.rarity} · ¥{Math.round(m.currentMid).toLocaleString()}
                      </div>
                      <div className="row-meta">{label}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--up)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      +{change.toFixed(1)}%
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* 急落 */}
            <div>
              <div className="eyebrow" style={{ color: 'var(--down)', fontWeight: 600, marginBottom: 'var(--sp-2)' }}>▼ 急落</div>
              {dropCards.length === 0 ? (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-faint)' }}>データ蓄積中</div>
              ) : dropCards.map(m => {
                const change = getChange(m)
                const label = getChangeLabel(m)
                return (
                  <Link key={m.slug} href={`/cards/${m.slug}`} className="row" style={{ gridTemplateColumns: '36px 1fr auto', gap: 'var(--sp-2)' }}>
                    {m.card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.card.image_url} alt={m.card.card_name} className="row-thumb" style={{ width: '36px', height: '50px' }} />
                    ) : (
                      <div className="row-thumb row-thumb-ph" style={{ width: '36px', height: '50px' }}>{m.card.rarity}</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="row-name" style={{ fontSize: 'var(--fs-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.card.card_name}</div>
                      <div className="row-meta">
                        {m.card.rarity} · ¥{Math.round(m.currentMid).toLocaleString()}
                      </div>
                      <div className="row-meta">{label}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--down)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {change.toFixed(1)}%
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* AI注目。左2列が「実際に動いた実績」なのに対し、ここだけ「これから上がるとAIが見ている」＝
                軸が違う。数字も変化率ではなく上昇シナリオの確率なので、単位を明記して混同を防ぐ */}
            <div>
              <div className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 'var(--sp-2)' }}>◆ AI注目</div>
              {notableCards.length === 0 ? (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-faint)' }}>データ蓄積中</div>
              ) : notableCards.slice(0, 5).map(({ card, forecast }) => {
                const slug = getCardSlug(card)
                const m = metricsBySlug.get(slug)
                return (
                  <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: '36px 1fr auto', gap: 'var(--sp-2)' }}>
                    {card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image_url} alt={card.card_name} className="row-thumb" style={{ width: '36px', height: '50px' }} />
                    ) : (
                      <div className="row-thumb row-thumb-ph" style={{ width: '36px', height: '50px' }}>{card.rarity}</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="row-name" style={{ fontSize: 'var(--fs-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.card_name}</div>
                      <div className="row-meta">
                        {card.rarity}
                        {m && m.currentMid > 0 ? ` · ¥${Math.round(m.currentMid).toLocaleString()}` : ''}
                      </div>
                      <div className="row-meta">上昇確率</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--accent)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {forecast?.overall.up_pct != null ? `${forecast.overall.up_pct}%` : '—'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="disclaimer">
        本サイトのランキング・予想・予想価格帯は AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。
      </div>
    </div>
  )
}
