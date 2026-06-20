import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getBoxPriceHistory } from '@/lib/data'

export async function generateMetadata(props: PageProps<'/boxes/[boxId]'>): Promise<Metadata> {
  const { boxId } = await props.params
  const box = getAllBoxes().find((b) => b.box_id === boxId)
  if (!box) return {}
  const cardCount = getAllCards().filter((c) => c.box_id === boxId).length
  const title = `${box.box_name} カード一覧`
  const description = `${box.box_name}（${box.release_ym}発売）のポケモンカード相場一覧。${cardCount}枚掲載。AI予想による上昇期待ランキングつき。`
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  }
}

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

  const boxPriceHistory = getBoxPriceHistory(boxId)
  const latestBoxPrice = boxPriceHistory?.history?.[0] ?? null
  const prevBoxPrice = boxPriceHistory?.history?.[7] ?? null
  const msrp = box.packs_per_box != null ? box.packs_per_box * box.pack_price_yen : null
  const boxMid = latestBoxPrice ? Math.round((latestBoxPrice.low + latestBoxPrice.high) / 2) : null
  const premiumPct = msrp && boxMid ? Math.round(((boxMid - msrp) / msrp) * 100) : null
  const priceTrend = latestBoxPrice && prevBoxPrice
    ? Math.round(((latestBoxPrice.low + latestBoxPrice.high) / 2 - (prevBoxPrice.low + prevBoxPrice.high) / 2) / ((prevBoxPrice.low + prevBoxPrice.high) / 2) * 100)
    : null

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

      {/* ── 未開封BOX相場 ── */}
      {latestBoxPrice && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--hair)',
            borderRadius: '10px',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              color: 'var(--ink-faint)',
              letterSpacing: '0.14em',
              marginBottom: '12px',
            }}
          >
            BOX · 未開封ボックス相場（メルカリ実勢）
          </div>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* 現在相場 */}
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }}>現在相場</div>
              <div style={{ fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>
                ¥{latestBoxPrice.low.toLocaleString()}
                <span style={{ fontSize: '16px', color: 'var(--ink-dim)' }}>〜</span>
                ¥{latestBoxPrice.high.toLocaleString()}
              </div>
            </div>

            {/* 定価比 */}
            {msrp != null && premiumPct != null && (
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }}>
                  定価比（¥{msrp.toLocaleString()} 基準）
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: premiumPct > 0 ? 'var(--up)' : premiumPct < 0 ? 'var(--down)' : 'var(--flat)',
                  }}
                >
                  {premiumPct > 0 ? `+${premiumPct}%` : `${premiumPct}%`}
                  <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--ink-faint)', marginLeft: '6px' }}>
                    {premiumPct > 0 ? 'プレミア' : premiumPct < 0 ? 'ディスカウント' : '定価並み'}
                  </span>
                </div>
              </div>
            )}

            {/* 7日間トレンド */}
            {priceTrend != null && (
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }}>7日間推移</div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: priceTrend > 2 ? 'var(--up)' : priceTrend < -2 ? 'var(--down)' : 'var(--flat)',
                  }}
                >
                  {priceTrend > 0 ? `↑ +${priceTrend}%` : priceTrend < 0 ? `↓ ${priceTrend}%` : '→ 横ばい'}
                </div>
              </div>
            )}

            {/* 出品中件数 */}
            {latestBoxPrice.on_sale != null && (
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }}>出品中</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: 'var(--ink-dim)' }}>
                  {latestBoxPrice.on_sale.toLocaleString()}件
                </div>
              </div>
            )}
          </div>

          {msrp != null && box.packs_per_box != null && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px' }}>
              定価: {box.packs_per_box}パック × ¥{box.pack_price_yen} = ¥{msrp.toLocaleString()}
            </div>
          )}
        </div>
      )}

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
