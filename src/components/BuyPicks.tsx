import Link from 'next/link'
import type { Card, BuyThesis, Conviction } from '@/types/pokeca'

export interface BuyPick {
  card: Card
  slug: string
  boxName: string
  mid: number
  upsidePct: number
  upPct: number | null
  factors: string[]
  thesis: BuyThesis | null
}

const CONVICTION: Record<Conviction, { label: string; color: string; bg: string }> = {
  high: { label: '確信度 高', color: '#146c43', bg: 'rgba(22,163,74,0.12)' },
  mid: { label: '確信度 中', color: '#a97b1f', bg: 'rgba(169,123,31,0.12)' },
  low: { label: '確信度 低', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}

function ThesisRow({ label, text, color }: { label: string; text: string; color: string }) {
  if (!text) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 'var(--sp-2)', alignItems: 'baseline', marginTop: 'var(--sp-2)' }}>
      <span
        style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', fontWeight: 700,
          color, letterSpacing: '0.04em', textAlign: 'center',
          border: `1px solid ${color}`, borderRadius: '4px', padding: '2px 0', lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-dim)', lineHeight: 1.65 }}>{text}</span>
    </div>
  )
}

export default function BuyPicks({ picks }: { picks: BuyPick[] }) {
  if (picks.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {picks.map(({ card, slug, boxName, mid, upsidePct, upPct, factors, thesis }, i) => {
        const conv = thesis ? CONVICTION[thesis.conviction] : null
        return (
          <Link
            key={slug}
            href={`/cards/${slug}`}
            style={{
              display: 'block',
              background: 'var(--panel)',
              border: '1px solid var(--hair)',
              borderLeft: '3px solid var(--gold)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-sm)',
              padding: 'var(--sp-4) var(--sp-5)',
              color: 'inherit',
            }}
          >
            {/* ヘッダ行 */}
            <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: 'var(--mincho)', fontSize: 'var(--fs-lg)', fontWeight: 800,
                    color: 'var(--gold)', minWidth: '24px', textAlign: 'center',
                  }}
                >
                  {i + 1}
                </span>
                {card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image_url} alt={card.card_name} className="row-thumb" referrerPolicy="no-referrer" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="row-name">
                    {card.card_name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--gold)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
                  </div>
                  <div className="row-meta">{boxName} ・ {card.card_no}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', marginTop: '2px' }}>
                    <span style={{ color: 'var(--ink)' }}>¥{Math.round(mid).toLocaleString()}</span>
                    <span style={{ color: 'var(--ink-faint)' }}> → 3ヶ月後 </span>
                    <span style={{ color: upsidePct >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                      {upsidePct >= 0 ? '+' : ''}{Math.round(upsidePct)}%
                    </span>
                    {upPct != null && <span style={{ color: 'var(--ink-faint)' }}> ・ 上昇確率 {upPct}%</span>}
                  </div>
                </div>
              </div>
              {conv && (
                <span
                  style={{
                    flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                    color: conv.color, background: conv.bg, borderRadius: '999px',
                    padding: '3px 10px', whiteSpace: 'nowrap',
                  }}
                >
                  {conv.label}
                </span>
              )}
            </div>

            {/* 論拠（厚い内容） */}
            {thesis ? (
              <div style={{ marginTop: 'var(--sp-3)' }}>
                {thesis.headline && (
                  <div style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5 }}>
                    「{thesis.headline}」
                  </div>
                )}
                <ThesisRow label="割安" text={thesis.valuation} color="var(--up)" />
                <ThesisRow label="買い時" text={thesis.timing} color="var(--gold)" />
                <ThesisRow label="材料" text={thesis.catalyst} color="var(--ink-dim)" />
                <ThesisRow label="注意" text={thesis.risk} color="var(--down)" />
              </div>
            ) : (
              factors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
                  {factors.map((f, j) => (
                    <span
                      key={j}
                      style={{
                        fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-dim)',
                        border: '1px solid var(--hair)', borderRadius: '999px', padding: '3px 10px', background: 'var(--bg2)',
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )
            )}
          </Link>
        )
      })}
    </div>
  )
}
