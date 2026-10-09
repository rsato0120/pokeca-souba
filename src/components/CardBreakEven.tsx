'use client'

import { useId, useState } from 'react'
import { useCostBasis, psaKey } from '@/hooks/useCollection'
import { calculateBreakEven } from '@/lib/break-even'

export default function CardBreakEven({ cardId, rawPrice, psa10Price, rawDate, psa10Date }: {
  cardId: string; rawPrice: number | null; psa10Price: number | null
  rawDate: string | null; psa10Date: string | null
}) {
  const id = useId()
  const { cost } = useCostBasis()
  const [variant, setVariant] = useState<'raw' | 'psa10'>('raw')
  const [purchases, setPurchases] = useState<{ raw?: string; psa10?: string }>({})
  const [expenses, setExpenses] = useState('0')
  const [shipping, setShipping] = useState('0')
  const [fee, setFee] = useState('10')
  const key = variant === 'raw' ? cardId : psaKey(cardId)
  const purchase = purchases[variant] ?? (cost[key] != null ? String(cost[key]) : '')
  const price = variant === 'raw' ? rawPrice : psa10Price
  const date = variant === 'raw' ? rawDate : psa10Date
  const result = [purchase, expenses, shipping, fee].some(v => v.trim() === '') ? null
    : calculateBreakEven({ purchase: Number(purchase), expenses: Number(expenses), shipping: Number(shipping), feePct: Number(fee) }, price)
  const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`
  const fields = [
    { key: 'purchase', label: '購入額（1枚・円）', value: purchase, set: (v: string) => setPurchases(prev => ({ ...prev, [variant]: v })), max: undefined },
    { key: 'expenses', label: '購入時送料・鑑定費など（円）', value: expenses, set: setExpenses, max: undefined },
    { key: 'shipping', label: '売却時送料・梱包費（円）', value: shipping, set: setShipping, max: undefined },
    { key: 'fee', label: '販売手数料（%）', value: fee, set: setFee, max: 99.99 },
  ]
  return (
    <section aria-labelledby={`${id}-heading`} style={{ margin: '22px 0', padding: '16px', border: '1px solid var(--hair)', borderRadius: '12px', background: 'var(--bg2)' }}>
      <h2 id={`${id}-heading`} style={{ fontSize: '16px', margin: '0 0 8px' }}>カードの損益分岐点</h2>
      <p style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>1枚の売却で赤字にならない価格を計算します。保有一覧の購入額があれば初期値に使います。</p>
      <label htmlFor={`${id}-variant`} style={{ fontSize: '12px' }}>対象 </label>
      <select id={`${id}-variant`} value={variant} onChange={e => setVariant(e.target.value as 'raw' | 'psa10')} style={{ padding: '6px', marginBottom: '12px', background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--hair)', borderRadius: '6px' }}>
        <option value="raw">素体</option><option value="psa10">PSA10</option>
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {fields.map(field => <label key={field.key} htmlFor={`${id}-${field.key}`} style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>
          {field.label}
          <input id={`${id}-${field.key}`} type="number" inputMode="decimal" min="0" max={field.max} step={field.key === 'fee' ? '0.1' : '1'} value={field.value} onChange={e => field.set(e.target.value)} style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '6px', padding: '9px', border: '1px solid var(--hair)', borderRadius: '6px', background: 'var(--panel)', color: 'var(--ink)' }} />
        </label>)}
      </div>
      <div aria-live="polite" style={{ marginTop: '16px' }}>
        {result ? <>
          <p style={{ margin: '0 0 8px' }}>損益分岐価格 <strong style={{ fontFamily: 'var(--mono)', fontSize: '22px' }}>{yen(result.breakEven)}</strong></p>
          {result.proceeds != null && result.profit != null ? <p style={{ fontSize: '13px', margin: 0 }}>
            相場 {yen(price!)}{date ? `（${date.replace(/-/g, '/')}時点）` : ''}で売る場合：手取り {yen(result.proceeds)} ／ 損益 <strong style={{ color: result.profit >= 0 ? 'var(--up)' : 'var(--down)' }}>{result.profit >= 0 ? '+' : '−'}{yen(Math.abs(result.profit))}</strong>
          </p> : <p style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>この状態の相場が未取得のため、相場での売却損益は表示できません。</p>}
        </> : <p style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>購入額と費用を入力してください。手数料率は0%以上100%未満です。</p>}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: 0 }}>手数料10%は仮の入力値です。売却先に合わせて変更してください。手数料は円単位で切り上げた概算。入力はこの画面の計算だけに使います。</p>
    </section>
  )
}
