import Link from 'next/link'
import { getAllCards, getAllBoxes, getCardSlug, getBoxById, getForecast, getPriceHistory } from '@/lib/data'
import type { Card } from '@/types/pokeca'
import SearchBar from '@/components/SearchBar'
import type { SearchCard } from '@/components/SearchBar'

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

  const featured = cardsWithForecast[0]
  const featuredSlug = featured ? getCardSlug(featured.card) : ''
  const featuredBox = featured ? getBoxById(featured.card.box_id) : undefined

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
      dayChange: (() => { const v = today && yesterday ? ((mid(today) - mid(yesterday)) / mid(yesterday)) * 100 : null; return v !== null && Math.abs(v) > 35 ? null : v })(),
      weekChange: (() => { const v = today && weekAgo ? ((mid(today) - mid(weekAgo)) / mid(weekAgo)) * 100 : null; return v !== null && Math.abs(v) > 35 ? null : v })(),
      onSale: today?.on_sale ?? null,
      forecast: getForecast(slug),
    }
  }).filter((c) => c.currentMid > 0)

  // 今買われているカード: 週間またはAI買いシグナルで選定
  const buyingCards = [...metrics]
    .filter(m => (m.weekChange ?? m.dayChange ?? 0) > 0 || (m.forecast?.overall.up_pct ?? 0) >= 45)
    .sort((a, b) => {
      const va = (a.weekChange ?? a.dayChange ?? 0) + (a.forecast?.overall.up_pct ?? 0) * 0.5
      const vb = (b.weekChange ?? b.dayChange ?? 0) + (b.forecast?.overall.up_pct ?? 0) * 0.5
      return vb - va
    })
    .slice(0, 5)

  // 今売られているカード: 週間下落 or 出品数多 or AI売りシグナル
  const sellingCards = [...metrics]
    .filter(m => (m.weekChange ?? m.dayChange ?? 0) < -1 || (m.forecast?.overall.down_pct ?? 0) >= 45)
    .sort((a, b) => {
      const va = (a.weekChange ?? a.dayChange ?? 0) - (a.forecast?.overall.down_pct ?? 0) * 0.3
      const vb = (b.weekChange ?? b.dayChange ?? 0) - (b.forecast?.overall.down_pct ?? 0) * 0.3
      return va - vb
    })
    .slice(0, 5)

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

  return (
    <div className="wrap">
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
      </header>

      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          color: 'var(--ink-faint)',
          letterSpacing: '0.1em',
          padding: '8px 0 24px',
          borderBottom: '1px solid var(--hair)',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span>
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')} 更新
          {boxes.length > 0 && (
            <> ・ 対象 {boxes.map((b) => b.box_name).join('／')} ほか</>
          )}
        </span>
        <Link
          href="/portfolio"
          style={{
            fontSize: '11px',
            color: 'var(--gold)',
            border: '1px solid var(--gold)',
            borderRadius: '20px',
            padding: '3px 10px',
            letterSpacing: '0.05em',
          }}
        >
          マイコレクション →
        </Link>
      </div>

      <SearchBar cards={searchCards} />

      {/* ── BOXナビ ── */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '2px' }}>
        {boxes.filter(b => b.certainty === 'released').map(b => (
          <Link
            key={b.box_id}
            href={`/boxes/${b.box_id}`}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1px solid var(--hair)',
              background: 'transparent',
              color: 'var(--ink-dim)',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            {b.box_name}
          </Link>
        ))}
      </div>

      {/* ── ヒーロー ── */}
      {featured && (
        <Link
          href={`/cards/${featuredSlug}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: '28px',
            alignItems: 'center',
            background: 'var(--bg2)',
            border: '1px solid var(--hair)',
            borderRadius: '10px',
            padding: '26px',
            marginBottom: '40px',
            borderBottomColor: 'var(--down-deep)',
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
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                color: 'var(--gold)',
                marginBottom: '8px',
              }}
            >
              FEATURED · 今週の注目
            </div>
            <h2
              style={{
                fontFamily: 'var(--mincho)',
                fontSize: '27px',
                fontWeight: 800,
                lineHeight: 1.3,
                marginBottom: '10px',
                color: 'var(--ink)',
              }}
            >
              {featured.card.card_name} {featured.card.rarity}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--ink-dim)', marginBottom: '14px' }}>
              {featured.card.evidence_notes.collector}
            </p>
            <div
              style={{
                display: 'flex',
                gap: '24px',
                fontFamily: 'var(--mono)',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>収録弾</div>
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
                    <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>現在相場</div>
                    <div style={{ fontSize: '17px', color: 'var(--ink)' }}>
                      ¥{featured.forecast.price_forecast.current_low.toLocaleString()}〜¥{featured.forecast.price_forecast.current_high.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>上昇期待</div>
                    <div style={{ fontSize: '17px', color: 'var(--up)' }}>
                      {featured.forecast.overall.up_pct}%
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* ── 01: AI予想 これからの注目カード ── */}
      <div style={{ marginBottom: '44px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--hair)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--gold)', letterSpacing: '0.1em' }}>01</span>
          <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700 }}>AI予想 これからの注目カード</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto', letterSpacing: '0.04em' }}>3ヶ月後の価格予想つき</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cardsWithForecast.slice(0, 5).map(({ card, forecast }, i) => {
            const slug = getCardSlug(card)
            const rankStyle: React.CSSProperties = i < 2
              ? { fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 800, color: 'var(--gold)', textAlign: 'center', minWidth: '34px' }
              : { fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 800, color: 'var(--ink-faint)', textAlign: 'center', minWidth: '34px' }
            const m3Low = forecast?.price_forecast.m3_low
            const m3High = forecast?.price_forecast.m3_high
            return (
              <Link key={slug} href={`/cards/${slug}`} style={{ display: 'grid', gridTemplateColumns: '34px 40px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}>
                <div style={rankStyle}>{i + 1}</div>
                {card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image_url} alt={card.card_name} style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px' }} />
                ) : (
                  <div style={{ width: '40px', height: '56px', background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>
                    {card.rarity}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{card.card_name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--gold)', marginLeft: '6px' }}>{card.rarity}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '2px' }}>
                    {formatBoxName(card, boxes)} ・ {card.card_no}
                  </div>
                  {forecast && (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--up)', marginTop: '2px', fontWeight: 600 }}>
                      ↑ {forecast.overall.up_pct}%
                      {m3Low && m3High && <span style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: '6px' }}>3M ¥{m3Low.toLocaleString()}〜{m3High.toLocaleString()}</span>}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', textAlign: 'right' }}>
                  {forecast ? `¥${forecast.price_forecast.current_low.toLocaleString()}〜` : '—'}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── 02: 今買われているカード ── */}
      <div style={{ marginBottom: '44px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--hair)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--up)', letterSpacing: '0.1em' }}>02</span>
          <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700 }}>今買われているカード</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto', letterSpacing: '0.04em' }}>価格上昇中・買いシグナル</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {buyingCards.length === 0 ? (
            <div style={{ padding: '20px 0', fontSize: '13px', color: 'var(--ink-faint)' }}>データ蓄積中（毎日自動更新）</div>
          ) : (
            buyingCards.map(({ card, slug, currentMid, weekChange, dayChange, onSale, forecast }) => {
              const change = weekChange ?? dayChange
              const upPct = forecast?.overall.up_pct ?? null
              return (
                <Link key={slug} href={`/cards/${slug}`} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.card_name} style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '40px', height: '56px', background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>
                      {card.rarity}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{card.card_name}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--gold)', marginLeft: '6px' }}>{card.rarity}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '2px' }}>
                      ¥{Math.round(currentMid).toLocaleString()}
                      {onSale != null && <> · 出品中 {onSale.toLocaleString()}件</>}
                    </div>
                    {upPct != null && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: upPct >= 45 ? 'var(--up)' : 'var(--ink-faint)', marginTop: '2px' }}>AI↑{upPct}%</div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', textAlign: 'right', minWidth: '56px' }}>
                    {change != null && (
                      <span style={{ color: change > 0 ? 'var(--up)' : 'var(--ink-faint)', fontWeight: 600 }}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>{weekChange != null ? '7日比' : '前日比'}</div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* ── 03: 今売られているカード ── */}
      <div style={{ marginBottom: '44px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--hair)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--down)', letterSpacing: '0.1em' }}>03</span>
          <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700 }}>今売られているカード</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto', letterSpacing: '0.04em' }}>価格下落中・売りシグナル</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sellingCards.length === 0 ? (
            <div style={{ padding: '20px 0', fontSize: '13px', color: 'var(--ink-faint)' }}>データ蓄積中（毎日自動更新）</div>
          ) : (
            sellingCards.map(({ card, slug, currentMid, weekChange, dayChange, onSale, forecast }) => {
              const change = weekChange ?? dayChange
              const downPct = forecast?.overall.down_pct ?? null
              return (
                <Link key={slug} href={`/cards/${slug}`} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.card_name} style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '40px', height: '56px', background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>
                      {card.rarity}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{card.card_name}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--gold)', marginLeft: '6px' }}>{card.rarity}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '2px' }}>
                      ¥{Math.round(currentMid).toLocaleString()}
                      {onSale != null && <> · 出品中 {onSale.toLocaleString()}件</>}
                    </div>
                    {downPct != null && downPct >= 30 && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--down)', marginTop: '2px' }}>AI↓{downPct}%</div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', textAlign: 'right', minWidth: '56px' }}>
                    {change != null && (
                      <span style={{ color: change < 0 ? 'var(--down)' : 'var(--ink-faint)', fontWeight: 600 }}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>{weekChange != null ? '7日比' : '前日比'}</div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* ── 04: 価格急落・急騰 ── */}
      {(surgeCards.length > 0 || dropCards.length > 0) && (
        <div style={{ marginBottom: '44px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px', paddingBottom: '8px', borderBottom: '1px solid var(--hair)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--gold)', letterSpacing: '0.1em' }}>04</span>
            <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700 }}>価格急落・急騰</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto' }}>前日比</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* 急騰 */}
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--up)', marginBottom: '10px', fontWeight: 600 }}>▲ 急騰</div>
              {surgeCards.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--ink-faint)' }}>データ蓄積中</div>
              ) : surgeCards.map(m => {
                const change = getChange(m)
                const label = getChangeLabel(m)
                return (
                  <Link key={m.slug} href={`/cards/${m.slug}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: '8px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hair)', color: 'inherit' }}>
                    {m.card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.card.image_url} alt={m.card.card_name} style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '3px' }} />
                    ) : (
                      <div style={{ width: '36px', height: '50px', background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--ink-faint)' }}>
                        {m.card.rarity}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.card.card_name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)' }}>
                        {m.card.rarity} · ¥{Math.round(m.currentMid).toLocaleString()}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>{label}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, color: 'var(--up)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      +{change.toFixed(1)}%
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* 急落 */}
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--down)', marginBottom: '10px', fontWeight: 600 }}>▼ 急落</div>
              {dropCards.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--ink-faint)' }}>データ蓄積中</div>
              ) : dropCards.map(m => {
                const change = getChange(m)
                const label = getChangeLabel(m)
                return (
                  <Link key={m.slug} href={`/cards/${m.slug}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: '8px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hair)', color: 'inherit' }}>
                    {m.card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.card.image_url} alt={m.card.card_name} style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '3px' }} />
                    ) : (
                      <div style={{ width: '36px', height: '50px', background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--ink-faint)' }}>
                        {m.card.rarity}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.card.card_name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)' }}>
                        {m.card.rarity} · ¥{Math.round(m.currentMid).toLocaleString()}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>{label}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, color: 'var(--down)', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
