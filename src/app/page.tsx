import Link from 'next/link'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getPriceExtremes, getBuyTheses, getLastUpdate, getBoxPriceHistory, getBoxPriceVariant } from '@/lib/data'
import { selectBuyCandidates, type BuyInput } from '@/lib/buy-signals'
import { computeCardScore } from '@/lib/score'
import { isDeckUtilityCard } from '@/lib/card-kind'
import { sparkSeries, todayJST, midOf } from '@/lib/market'
import type { Card, PriceRecord } from '@/types/pokeca'
import SearchBar from '@/components/SearchBar'
import type { SearchCard } from '@/components/SearchBar'
import BoxSelector from '@/components/BoxSelector'
import OripaBanner from '@/components/OripaBanner'
import VisitorStrip, { type MarketCard } from '@/components/VisitorStrip'
import UpdateClock from '@/components/UpdateClock'
import SiteHeader from "@/components/SiteHeader"
import MarketPulse from '@/components/MarketPulse'
import HeatPicks, { type HeatPick } from '@/components/HeatPicks'
import { computeMarketTemp } from '@/lib/market-temp'
import { onSaleChange } from '@/lib/on-sale'
import BoxRanking from '@/components/BoxRanking'
import { buildBoxRanking } from '@/lib/box-ranking'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'


export default function TopPage() {
  const cards = getAllCards()
  const boxes = getAllBoxes()

  // 検索用データ（Client Componentに渡す）
  const searchCards: SearchCard[] = cards.map((card) => ({
    slug: getCardSlug(card),
    card_name: card.card_name,
    rarity: card.rarity,
    box_name: boxes.find((b) => b.box_id === card.box_id)?.box_name ?? card.box_id,
    up_pct: getForecast(getCardSlug(card))?.overall.up_pct ?? null,
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

  const metricsBySlug = new Map(metrics.map((m) => [m.slug, m]))


  // 出品数の変化。**出所（スニダン/メルカリ）が違う2点は引き算しない**（src/lib/on-sale.ts）。
  // スニダンは商品固有の実数、メルカリは検索の集計で桁がまるごと違うため、切替日に
  // 偽の増減が出る（実測: ブラッキーex SAR はメルカリ71件 / スニダン344件）。
  const onSaleDelta = new Map<string, ReturnType<typeof onSaleChange>>()
  for (const m of metrics) onSaleDelta.set(m.slug, onSaleChange(m.records))





  // 価格急騰・急落: 前日比優先、なければ週間比
  const getChange = (m: CardMetrics) => m.dayChange ?? m.weekChange ?? 0
  const changeCards = metrics.filter(m => isRankable(m) && (m.dayChange != null || m.weekChange != null))

  const surgeCards = [...changeCards]
    .filter(m => getChange(m) > 0)
    .sort((a, b) => getChange(b) - getChange(a))
    .slice(0, 5)

  const dropCards = [...changeCards]
    .filter(m => getChange(m) < 0)
    .sort((a, b) => getChange(a) - getChange(b))
    .slice(0, 5)

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
  // ⚠ 「AI高騰気配」は廃止した（2026-08-30）。
  //   買い候補の中の順位（パーセンタイル 40〜99）を出す指標だったが、カード詳細に
  //   「AI投資スコア 0〜100」が別にあり、同じ「買い妙味」を2つの数字で語っていて
  //   利用者が違いを理解できなかった（同じカードで 83 と 91 が並ぶ）。
  //   **画面に出す数字は AI投資スコア（src/lib/score.ts）に一本化**し、
  //   scoreBuy は「どのカードを候補に採るか」という**並び順専用**として内部に残す。
  const scoreBySlug = new Map(
    buyInputs.map((b) => [b.slug, computeCardScore({ card: b.card, forecast: b.forecast, history: b.history, extremes: b.extremes })?.total ?? null]),
  )

  const buyTheses = getBuyTheses()

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
      // カード詳細と**同じ AI投資スコア**（0〜100）。別物の数字を並べない
      score: scoreBySlug.get(c.slug) ?? null,
      upPct: fc?.overall.up_pct ?? null,
      m3Low: fc?.price_forecast.m3_low ?? null,
      m3High: fc?.price_forecast.m3_high ?? null,
      omens: c.omens,
      cautions: c.cautions,
      // 厚い論拠(BuyThesis)の見出しだけを短い理由として使う。全文はカード詳細で読ませる
      thesis: buyTheses[c.card.id]?.headline ?? null,
    }
  })


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



  // ── 市場サマリー（ヒーロー右） ──
  // ⚠ ここに出してよいのは**実データで裏付けられる指標だけ**。
  //   「取引件数(24h)」「総取引額(24h)」は出さない。成約数はスニダン売買履歴が唯一の実データ源で、
  //   BOXは61系列すべてに sales_by_day が無く、カードも直近7日の充填率が23.2%しかない
  //   （2026-08-28 実測）。24時間の件数も金額も裏が取れないので、置けば飾りの嘘になる。
  //   代わりに騰落銘柄数（advance/decline）を出す。指数と意味が繋がっていて実データで出せる。
  // 未開封BOXのランキング。カードのランキングはあるのにBOXには無かった
  const boxRanking = buildBoxRanking(
    boxes.map((box) => ({
      box,
      noshrink: getBoxPriceVariant(box.box_id, 'noshrink')?.history ?? null,
      mixed: getBoxPriceHistory(box.box_id)?.history ?? null,
      shrink: getBoxPriceVariant(box.box_id, 'shrink')?.history ?? null,
    })),
  )

  // AI予想の的中実績（/accuracy と同じ計算をそのまま使う）

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
    <div className="wrap home-wrap">
      <SiteHeader />
      <section className="home-hero" aria-labelledby="home-title">
        <p id="home-title">ポケモンカードの相場を、すばやく確認</p>
        <SearchBar cards={searchCards} />
        <BoxSelector
          marginTop={12}
          marginBottom={0}
          boxes={boxes
            .filter(b => b.certainty === 'released')
            .map(b => ({ box_id: b.box_id, box_name: b.box_name, release_ym: b.release_ym }))}
        />
      </section>

      <div className="home-update-row">
        <UpdateClock updatedLabel={updatedLabel} />
        <span>価格はメルカリ成約・スニダン実取引から毎日更新</span>
      </div>

      <div className="home-pulse">
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
      </div>

      <VisitorStrip cards={marketCards} />

      <div className="home-dashboard-grid">
        {(surgeCards.length > 0 || dropCards.length > 0) && (
          <section className="home-panel">
            <div className="home-panel-head">
              <div><span>MARKET MOVES</span><h2>今日の値動き</h2></div>
              <Link href="/ranking">すべて見る →</Link>
            </div>
            <div className="rank-cols home-rank-cols">
              <div>
                <div className="home-rank-label is-up">▲ 急騰</div>
                {surgeCards.slice(0, 3).map(m => {
                  const change = getChange(m)
                  return (
                    <Link key={m.slug} href={`/cards/${m.slug}`} className="home-market-row">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 外部カード画像は既存データURLをそのまま使用 */}
                      {m.card.image_url ? <img src={m.card.image_url} alt="" /> : <span className="home-thumb-ph">{m.card.rarity}</span>}
                      <span><strong>{m.card.card_name}</strong><small>{m.card.rarity} · ¥{Math.round(m.currentMid).toLocaleString()}</small></span>
                      <em className="is-up">+{change.toFixed(1)}%</em>
                    </Link>
                  )
                })}
              </div>
              <div>
                <div className="home-rank-label is-down">▼ 急落</div>
                {dropCards.slice(0, 3).map(m => {
                  const change = getChange(m)
                  return (
                    <Link key={m.slug} href={`/cards/${m.slug}`} className="home-market-row">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 外部カード画像は既存データURLをそのまま使用 */}
                      {m.card.image_url ? <img src={m.card.image_url} alt="" /> : <span className="home-thumb-ph">{m.card.rarity}</span>}
                      <span><strong>{m.card.card_name}</strong><small>{m.card.rarity} · ¥{Math.round(m.currentMid).toLocaleString()}</small></span>
                      <em className="is-down">{change.toFixed(1)}%</em>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {boxRanking.length > 0 && (
          <section className="home-panel">
            <div className="home-panel-head">
              <div><span>SEALED BOX</span><h2>未開封BOX</h2></div>
              <Link href="/ranking">すべて見る →</Link>
            </div>
            <BoxRanking rows={boxRanking.slice(0, 3)} />
          </section>
        )}
      </div>

      <section className="home-ai-section">
        <div className="home-panel-head">
          <div><span>AI PICK</span><h2>今日の注目カード</h2></div>
          <Link href="/ai">AI予想を見る →</Link>
        </div>
        {heatPicks.length > 0 ? (
          <HeatPicks picks={heatPicks} />
        ) : (
          <p className="home-empty">いまは条件を満たすカードがありません。</p>
        )}
      </section>

      <div className="home-pr"><OripaBanner marginY={4} /></div>

      <div className="disclaimer">
        本サイトのランキング・予想・予想価格帯は AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。
      </div>
    </div>
  )
}
