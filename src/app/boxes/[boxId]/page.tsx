import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllCards, getAllBoxes, getCardSlug, getForecast } from '@/lib/data'

export function generateStaticParams() {
  return getAllBoxes().map((box) => ({ boxId: box.box_id }))
}

export default async function BoxPage(props: PageProps<'/boxes/[boxId]'>) {
  const { boxId } = await props.params
  const boxes = getAllBoxes()
  const box = boxes.find((b) => b.box_id === boxId)
  if (!box) notFound()

  const cards = getAllCards().filter((c) => c.box_id === boxId)
  const cardsWithForecast = cards.map((card) => ({
    card,
    forecast: getForecast(getCardSlug(card)),
  }))

  return (
    <div className="wrap">
      <Link
        href="/"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          color: 'var(--ink-faint)',
          letterSpacing: '0.06em',
          display: 'inline-block',
          padding: '18px 0 10px',
        }}
      >
        ← トップへ戻る
      </Link>
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
      </header>

      {/* ── 収録弾ヘッダ ── */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--ink-faint)',
            letterSpacing: '0.14em',
            marginBottom: '6px',
          }}
        >
          BOX · 収録弾
        </div>
        <h1
          style={{
            fontFamily: 'var(--mincho)',
            fontSize: '28px',
            fontWeight: 800,
            marginBottom: '10px',
          }}
        >
          {box.box_name}
        </h1>
        <div
          style={{
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            fontFamily: 'var(--mono)',
            fontSize: '12px',
            color: 'var(--ink-faint)',
          }}
        >
          <span>発売 {box.release_ym}</span>
          <span>パック ¥{box.pack_price_yen}</span>
          <span>{cards.length}枚収録（掲載中）</span>
        </div>
      </div>

      {/* ── カード一覧 ── */}
      <div
        style={{
          border: '1px solid var(--hair)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* ヘッダ行 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr auto auto',
            gap: '16px',
            padding: '8px 16px',
            background: 'var(--bg2)',
            borderBottom: '1px solid var(--hair)',
            fontFamily: 'var(--mono)',
            fontSize: '10px',
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          <span>No.</span>
          <span>カード</span>
          <span style={{ textAlign: 'right' }}>相場</span>
          <span style={{ textAlign: 'right', minWidth: '60px' }}>上昇期待</span>
        </div>

        {cardsWithForecast.length === 0 ? (
          <div style={{ padding: '24px 16px', fontSize: '13px', color: 'var(--ink-faint)' }}>
            このセットのカードはまだ登録されていません。
          </div>
        ) : (
          cardsWithForecast.map(({ card, forecast }) => {
            const slug = getCardSlug(card)
            const upPct = forecast?.overall.up_pct ?? null
            const upColor = upPct !== null
              ? upPct >= 50 ? 'var(--up)' : upPct >= 35 ? 'var(--gold)' : 'var(--ink-faint)'
              : 'var(--ink-faint)'

            return (
              <Link
                key={slug}
                href={`/cards/${slug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr auto auto',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--hair)',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    color: 'var(--ink-faint)',
                  }}
                >
                  {card.card_no}
                </div>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{card.card_name}</span>
                  <span className="rare-badge">{card.rarity}</span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '13px',
                    color: 'var(--ink-dim)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {forecast
                    ? `¥${forecast.price_forecast.current_low.toLocaleString()}〜`
                    : '—'}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: upColor,
                    textAlign: 'right',
                    minWidth: '60px',
                  }}
                >
                  {upPct !== null ? `↑ ${upPct}%` : '—'}
                </div>
              </Link>
            )
          })
        )}
      </div>

      <div className="disclaimer" style={{ marginTop: '32px' }}>
        本サイトのランキング・予想・相場レンジは AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。
      </div>
    </div>
  )
}
