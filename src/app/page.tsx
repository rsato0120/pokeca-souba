import Link from 'next/link'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getPriceExtremes, getBuyTheses, getLastUpdate, getBoxPriceHistory, getBoxPriceVariant } from '@/lib/data'
import { selectBuyCandidates, scoreBuy, makeHeatScale, type BuyInput } from '@/lib/buy-signals'
import { isDeckUtilityCard } from '@/lib/card-kind'
import { sparkSeries, todayJST, midOf } from '@/lib/market'
import type { Card, PriceRecord } from '@/types/pokeca'
import SearchBar from '@/components/SearchBar'
import type { SearchCard } from '@/components/SearchBar'
import BoxSelector from '@/components/BoxSelector'
import OripaBanner from '@/components/OripaBanner'
import CommunityPicks, { type PickCard } from '@/components/CommunityPicks'
import VisitorStrip, { type MarketCard } from '@/components/VisitorStrip'
import UpdateClock from '@/components/UpdateClock'
import SiteHeader from "@/components/SiteHeader"
import MarketPulse from '@/components/MarketPulse'
import HeatPicks, { type HeatPick } from '@/components/HeatPicks'
import { computeMarketTemp } from '@/lib/market-temp'
import { onSaleChange } from '@/lib/on-sale'
import AccuracyStrip from '@/components/AccuracyStrip'
import { computeAccuracy } from '@/lib/accuracy'
import BoxRanking from '@/components/BoxRanking'
import { buildBoxRanking } from '@/lib/box-ranking'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'


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


  // 出品数の変化。**出所（スニダン/メルカリ）が違う2点は引き算しない**（src/lib/on-sale.ts）。
  // スニダンは商品固有の実数、メルカリは検索の集計で桁がまるごと違うため、切替日に
  // 偽の増減が出る（実測: ブラッキーex SAR はメルカリ71件 / スニダン344件）。
  const onSaleDelta = new Map<string, ReturnType<typeof onSaleChange>>()
  for (const m of metrics) onSaleDelta.set(m.slug, onSaleChange(m.records))





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
  // 「AI高騰気配」の物差しは**全候補**から1つだけ作り、看板・買うべきカードの双方に渡す。
  // 絞り込んだ集合ごとに作ると、同じ数字が画面によって違う意味になる。
  const heatPoolSize = buyInputs.map(scoreBuy).filter((c) => c != null).length
  const heatScale = makeHeatScale(
    buyInputs.map(scoreBuy).filter((c) => c != null).map((c) => c!.score),
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
  const heatPicks: HeatPick[] = selectBuyCandidates(quietInputs, 3, 1, heatScale).map((c) => {
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
      heatPercentile: c.heatPercentile,
      heatPool: heatPoolSize,
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
        {/* ⚠ ここにあった4つのショートカット（スクリーナー・ウォッチリスト・AI的中実績・
            マイコレクション）は削除した（2026-08-30）。同じ行き先が共通ヘッダーのナビに
            並んでおり、開いた直後に同じリンクが2列見える状態だった。 */}
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
      {/* ── BOXランキング ──
          指数(市場全体) → BOX(弾ごとの市場) → 個別カード の順に絞り込む位置に置く。
          カード側にはランキングが揃っているのにBOXには無かった。並びは7日変化率の降順で、
          定価比は情報として添えるだけにしている（絶版弾は定価比が桁違いなので、
          倍率で並べると常に古い弾が上位を独占して「いま動いている弾」が見えなくなる）。 */}
      {boxRanking.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
            <span className="sec-title">未開封BOXランキング</span>
            <span className="sec-sub">直近7日の値動き順・定価比つき</span>
          </div>
          <BoxRanking rows={boxRanking.slice(0, 5)} />
        </div>
      )}

      {/* ⚠ ここにあった「今日の注目カード（3枚）」は削除した（2026-08-29）。
          notableCards の上位3枚を出すだけで、すぐ下の「01: AI予想 これからの注目カード」
          （同じ5枚＋3ヶ月予想価格）と**顔ぶれも数字も同じ**だった。
          notableCards は他に 値動きランキングの「AI注目」列でも使っており、
          3箇所で同じ並びを見せていたので、情報が一番薄いこの枠を落とす。 */}

      {/* オリパ案件バナー（A8 / PR） */}
      <OripaBanner marginY={4} />

      {/* ── 01b: みんなの予想 注目カード ──
          AI予想ランキングの直後に置いて、AIと閲覧者の見立ての差がその場で見えるようにする。
          票は Supabase にあるのでクライアント側で取得する（票が0のうちは自分で消える） */}
      <CommunityPicks cards={pickCards} />

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
