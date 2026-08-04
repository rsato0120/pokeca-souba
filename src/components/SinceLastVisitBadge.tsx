'use client'
import { useVisitPrice } from '@/hooks/useLastVisit'
import { md } from '@/components/VisitorStrip'

// カード詳細の「前回見たときから」バッジ。
// スナップショットの書き込みはトップページが担当するので、ここは読むだけ。
// （トップを一度も開いたことがない人には出ない。これは仕様）
//
// ⚠ 金額は出さない。このページの見出し価格は avg（取引平均）だが、スナップショットは
//   トップと同じ (low+high)/2 で焼いている。並べると数百円ずれて見えるので変化率だけにする。

export default function SinceLastVisitBadge({ cardId, mid }: { cardId: string; mid: number }) {
  const prev = useVisitPrice(cardId)
  if (!prev || mid <= 0) return null

  const pct = ((mid - prev.price) / prev.price) * 100
  if (Math.abs(pct) < 0.5) return null   // 誤差レベルの差は出さない

  const color = pct > 0 ? 'var(--up)' : 'var(--down)'
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap',
        fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)',
        border: `1px solid color-mix(in srgb, ${color} 35%, var(--hair))`,
        background: `color-mix(in srgb, ${color} 7%, var(--panel))`,
        borderRadius: 'var(--r-pill)', padding: '4px 12px', marginBottom: 'var(--sp-3)',
      }}
    >
      <span style={{ color: 'var(--ink-faint)' }}>
        前回見たとき（{md(prev.date)}）から
      </span>
      <span style={{ color, fontWeight: 700 }}>
        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </div>
  )
}
