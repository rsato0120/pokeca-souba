import Link from 'next/link'
import { getAllCards, getAllBoxes, getCardSlug, getBoxById, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { extremeHitToday } from '@/lib/extremes'
import type { Card } from '@/types/pokeca'
import SearchBar from '@/components/SearchBar'
import type { SearchCard } from '@/components/SearchBar'
import BoxSelector from '@/components/BoxSelector'
import OripaBanner from '@/components/OripaBanner'

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

  // 価格変化・需給データ計算
  type CardMetrics = {
    card: Card
    slug: string
    currentMid: number
    dayChange: number | null
    weekChange: number | null
    onSale: number | null
    forecast: ReturnType<typeof getForecast>
  }

  const mid = (r: { low: number; high: number }) => (r.low + r.high) / 2

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
      currentMid: today ? mid(today) : 0,
      dayChange: (() => { const v = today && yesterday ? ((mid(today) - mid(yesterday)) / mid(yesterday)) * 100 : null; return v !== null && Math.abs(v) > 20 ? null : v })(),
      weekChange: (() => { const v = today && weekAgo ? ((mid(today) - mid(weekAgo)) / mid(weekAgo)) * 100 : null; return v !== null && Math.abs(v) > 35 ? null : v })(),
      onSale: today?.on_sale ?? null,
      forecast: getForecast(slug),
    }
  }).filter((c) => c.currentMid > 0)

  // 今買われているカード: 出品数が減ったカード（SR除外）
  // on_sale件数の前日比減少 = 在庫が捌けている = 買い需要の実態シグナル
  const buyingCards = [...metrics]
    .filter(m => m.card.rarity !== 'SR' && m.onSale != null)
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
    .filter(m => m.card.rarity !== 'SR' && m.onSale != null)
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
  const changeCards = metrics.filter(m => m.dayChange != null || m.weekChange != null)

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
    .filter(m => isRising(m.forecast))
    .sort((a, b) => (b.forecast?.overall.up_pct ?? 0) - (a.forecast?.overall.up_pct ?? 0))
  // 価格データがまだ無いカードも拾えるよう、不足分は「上昇予想」のAI予想順で補完
  const notableBackfill = cardsWithForecast.filter(
    c => isRising(c.forecast) && !notableFromMetrics.some(m => m.slug === getCardSlug(c.card))
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

  const featured = notableCards[0] ?? cardsWithForecast[0]
  const featuredSlug = featured ? getCardSlug(featured.card) : ''
  const featuredBox = featured ? getBoxById(featured.card.box_id) : undefined

  return (
    <div className="wrap">
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
      </header>

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
        <span>
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')} 更新
          {boxes.length > 0 && (
            <> ・ 対象 {boxes.map((b) => b.box_name).join('／')} ほか</>
          )}
        </span>
        <span style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Link href="/accuracy" className="pill">AI的中実績 →</Link>
          <Link href="/portfolio" className="pill pill-gold">マイコレクション →</Link>
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

      <SearchBar cards={searchCards} />

      {/* ── BOXナビ（ドロップダウン選択） ── */}
      <BoxSelector
        boxes={boxes
          .filter(b => b.certainty === 'released')
          .map(b => ({ box_id: b.box_id, box_name: b.box_name }))}
      />

      {/* ── ヒーロー ── */}
      {featured && (
        <Link
          href={`/cards/${featuredSlug}`}
          className="hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: 'var(--sp-6)',
            alignItems: 'center',
            background: 'var(--bg2)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--sp-5)',
            marginBottom: 'var(--sp-7)',
            borderBottomColor: 'var(--hair)',
          }}
        >
          <div className="pokecard" style={{ padding: featured.card.image_url ? '0' : undefined, overflow: 'hidden' }}>
            {featured.card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featured.card.image_url}
                alt={`${featured.card.card_name} ${featured.card.rarity}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="ph">
                <span className="big">{featured.card.card_name}</span>
                <span>カード画像</span>
              </div>
            )}
            <div className="no">{featured.card.card_no} ・ {featured.card.rarity}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 'var(--sp-2)' }}>
              FEATURED · 今週の注目
            </div>
            <h2
              className="hero-title"
              style={{
                fontFamily: 'var(--mincho)',
                fontSize: 'var(--fs-xl)',
                fontWeight: 800,
                lineHeight: 1.3,
                marginBottom: 'var(--sp-2)',
                color: 'var(--ink)',
              }}
            >
              {featured.card.card_name} {featured.card.rarity}
            </h2>
            <p style={{ fontSize: 'var(--fs-base)', color: 'var(--ink-dim)', marginBottom: 'var(--sp-3)' }}>
              {featured.card.evidence_notes.collector}
            </p>
            <div
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                fontFamily: 'var(--mono)',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="stat-label">収録弾</div>
                <Link
                  href={`/boxes/${featured.card.box_id}`}
                  style={{ fontSize: '17px', color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--hair)' }}
                >
                  {featuredBox?.box_name ?? featured.card.box_id}
                </Link>
              </div>
              {featured.forecast && (
                <>
                  <div>
                    <div className="stat-label">現在相場</div>
                    <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>
                      ¥{featured.forecast.price_forecast.current_low.toLocaleString()}〜¥{featured.forecast.price_forecast.current_high.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    {/* up_pct は上昇率ではなく「上昇シナリオの確率」 */}
                    <div className="stat-label">上昇する確率</div>
                    <div style={{ fontSize: 'var(--fs-md)', color: 'var(--up)' }}>
                      {featured.forecast.overall.up_pct}%
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* オリパ案件バナー（A8 / PR） */}
      <OripaBanner marginY={4} />

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
            const rankStyle: React.CSSProperties = {
              fontFamily: 'var(--mincho)',
              fontSize: i < 2 ? 'var(--fs-xl)' : 'var(--fs-lg)',
              fontWeight: 800,
              color: i < 2 ? 'var(--gold)' : 'var(--ink-faint)',
              textAlign: 'center',
              minWidth: '34px',
            }
            const m3Low = forecast?.price_forecast.m3_low
            const m3High = forecast?.price_forecast.m3_high
            return (
              <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: '34px 40px 1fr auto' }}>
                <div style={rankStyle}>{i + 1}</div>
                {card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image_url} alt={card.card_name} className="row-thumb" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                )}
                <div>
                  <div className="row-name">{card.card_name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--gold)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
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
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', textAlign: 'right' }}>
                  {forecast ? `¥${forecast.price_forecast.current_low.toLocaleString()}〜` : '—'}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── 本日の高値・安値更新 ── */}
      {(highUpdates.length > 0 || lowUpdates.length > 0) && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--gold)' }}>★</span>
            <span className="sec-title">本日 最高値・最安値を更新したカード</span>
            <span className="sec-sub">計測開始以降でいちばん高い／安い水準</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...highUpdates, ...lowUpdates].map(({ m, ex, hit }) => (
              <Link key={m.slug} href={`/cards/${m.slug}`} className="row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                {m.card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.card.image_url} alt={m.card.card_name} className="row-thumb" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{m.card.rarity}</div>
                )}
                <div>
                  <div className="row-name">{m.card.card_name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--gold)', marginLeft: 'var(--sp-1)' }}>{m.card.rarity}</span>
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
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 02: 今買われているカード ── */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--up)' }}>02</span>
          <span className="sec-title">今買われているカード</span>
          <span className="sec-sub">出品数が減少＝在庫が捌けている</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {buyingCards.length === 0 ? (
            <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>データ蓄積中（毎日自動更新）</div>
          ) : (
            buyingCards.map(({ card, slug, currentMid, weekChange, dayChange, onSale, forecast }) => {
              const change = weekChange ?? dayChange
              const upPct = forecast?.overall.up_pct ?? null
              return (
                <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.card_name} className="row-thumb" />
                  ) : (
                    <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                  )}
                  <div>
                    <div className="row-name">{card.card_name}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--gold)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
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
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* ── 03: 今売られているカード ── */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--down)' }}>03</span>
          <span className="sec-title">今売られているカード</span>
          <span className="sec-sub">出品数が増加＝売り圧が高まっている</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sellingCards.length === 0 ? (
            <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>データ蓄積中（毎日自動更新）</div>
          ) : (
            sellingCards.map(({ card, slug, currentMid, weekChange, dayChange, onSale, forecast }) => {
              const change = weekChange ?? dayChange
              const downPct = forecast?.overall.down_pct ?? null
              return (
                <Link key={slug} href={`/cards/${slug}`} className="row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.card_name} className="row-thumb" />
                  ) : (
                    <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                  )}
                  <div>
                    <div className="row-name">{card.card_name}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--gold)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
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
            <span className="sec-title">価格急落・急騰</span>
            <span className="sec-sub">実際の成約価格の変化率</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
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
          </div>
        </div>
      )}

      <div className="disclaimer">
        本サイトのランキング・予想・相場レンジは AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。
      </div>
    </div>
  )
}
