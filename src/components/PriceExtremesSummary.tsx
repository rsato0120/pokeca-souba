import type { PriceExtremes } from '@/types/pokeca'
import RangePosition from './RangePosition'
export default function PriceExtremesSummary({ extremes, mid }: { extremes: PriceExtremes | null; mid: number }) {
  if (!extremes) return null
  return <div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: '12px', marginBottom: '10px' }}>
    <span>最高 <strong style={{ color: 'var(--up)' }}>¥{extremes.high.value.toLocaleString()}</strong>（{extremes.high.date}）</span>
    <span>最安 <strong style={{ color: 'var(--down)' }}>¥{extremes.low.value.toLocaleString()}</strong>（{extremes.low.date}）</span>
    <span className="source-note">{extremes.since}以降の平均相場</span>
  </div><RangePosition extremes={extremes} mid={mid} /></div>
}
