import Link from 'next/link'
import { getAllCards, getAllBoxes, getCardSlug, getBoxById, getForecast } from '@/lib/data'
import type { Card, Forecast } from '@/types/pokeca'

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
        }}
      >
        {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')} 更新
        {boxes.length > 0 && (
          <> ・ 対象 {boxes.map((b) => b.box_name).join('／')} ほか</>
        )}
      </div>

      <div className="searchbar">
        <input type="text" placeholder="カード名で検索" />
        <button>予想する</button>
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
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                <div style={{ fontSize: '17px', color: 'var(--ink)' }}>
                  {featuredBox?.box_name ?? featured.card.box_id}
                </div>
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

      {/* ── 01: AI予想 上昇期待ランキング ── */}
      <div style={{ marginBottom: '44px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--hair)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              color: 'var(--gold)',
              letterSpacing: '0.1em',
            }}
          >
            01
          </span>
          <span
            style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700 }}
          >
            AI予想 上昇期待ランキング
          </span>
          <span
            style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto', letterSpacing: '0.04em' }}
          >
            これから上がりそう（独自予想）
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cardsWithForecast.map(({ card, forecast }, i) => {
            const slug = getCardSlug(card)
            const rankStyle: React.CSSProperties =
              i < 2
                ? { fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 800, color: 'var(--gold)', textAlign: 'center', minWidth: '38px' }
                : { fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 800, color: 'var(--ink-faint)', textAlign: 'center', minWidth: '38px' }

            return (
              <Link
                key={slug}
                href={`/cards/${slug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '38px 1fr auto auto',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '14px 4px',
                  borderBottom: '1px solid var(--hair)',
                  color: 'inherit',
                }}
              >
                <div style={rankStyle}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{card.card_name}</div>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      color: 'var(--ink-faint)',
                      marginTop: '2px',
                    }}
                  >
                    {formatBoxName(card, boxes)} ・ {card.card_no}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--mono)',
                    minWidth: '60px',
                  }}
                >
                  {forecast ? (
                    <>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--up)' }}>
                        ↑ {forecast.overall.up_pct}%
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>上昇期待</div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--ink-faint)' }}>予想なし</div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--gold)',
                    minWidth: '40px',
                    textAlign: 'right',
                  }}
                >
                  {card.rarity}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── 02: 実績ランキング（スタブ） ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--hair)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '12px',
            color: 'var(--gold)',
            letterSpacing: '0.1em',
          }}
        >
          02
        </span>
        <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700 }}>
          実績ランキング
        </span>
        <span
          style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto', letterSpacing: '0.04em' }}
        >
          直近7日の実際の動き
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1px',
          background: 'var(--hair)',
          border: '1px solid var(--hair)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '40px',
        }}
      >
        {[
          { label: '上昇率', sub: 'PRICE UP · 7日', dot: 'var(--up)', val: '+---%' },
          { label: '下落率', sub: 'PRICE DOWN · 7日', dot: 'var(--down)', val: '−---%' },
          { label: '注目度', sub: 'TRENDING · 検索数', dot: 'var(--gold)', val: '---' },
        ].map(({ label, sub, dot }) => (
          <div
            key={label}
            style={{ background: 'var(--panel)', padding: '18px' }}
          >
            <h3
              style={{
                fontFamily: 'var(--mincho)',
                fontSize: '15px',
                fontWeight: 700,
                marginBottom: '3px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: dot,
                }}
              />
              {label}
            </h3>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                color: 'var(--ink-faint)',
                letterSpacing: '0.08em',
                marginBottom: '14px',
              }}
            >
              {sub}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>
              相場データ取得後に表示されます
            </div>
          </div>
        ))}
      </div>

      <div className="disclaimer">
        本サイトのランキング・予想・相場レンジは AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。
      </div>
    </div>
  )
}
