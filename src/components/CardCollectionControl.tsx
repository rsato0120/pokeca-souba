'use client'

import { useCollection, psaKey } from '@/hooks/useCollection'

interface Props {
  cardId: string
  hasPsa10: boolean   // PSA10価格があるカードのみPSA枠を出す
}

// カード詳細ページでコレクションに追加するUI。素体とPSA10を別枠で登録できる。
export default function CardCollectionControl({ cardId, hasPsa10 }: Props) {
  const { getQty, setQty } = useCollection()
  const rawQty = getQty(cardId)
  const pKey = psaKey(cardId)
  const psaQty = getQty(pKey)

  const stepper = (label: string, color: string, key: string, qty: number) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--hair)',
        background: qty > 0 ? 'var(--panel)' : 'transparent',
      }}
    >
      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: qty > 0 ? color : 'var(--ink-dim)', fontWeight: qty > 0 ? 700 : 500 }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setQty(key, qty - 1)}
          aria-label="減らす"
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: '1px solid var(--hair)', background: 'transparent',
            color: 'var(--ink-dim)', fontSize: '17px', lineHeight: 1,
            cursor: qty > 0 ? 'pointer' : 'default', opacity: qty > 0 ? 1 : 0.3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >−</button>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 700, minWidth: '22px', textAlign: 'center', color: qty > 0 ? color : 'var(--ink-faint)' }}>
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQty(key, qty + 1)}
          aria-label="増やす"
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: '1px solid var(--hair)', background: 'transparent',
            color: 'var(--ink-dim)', fontSize: '17px', lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >＋</button>
      </div>
    </div>
  )

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--hair)',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '22px',
      }}
    >
      <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '0.14em', color: 'var(--ink-faint)', marginBottom: '10px' }}>
        MY COLLECTION · コレクションに追加
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {stepper('素体', 'var(--gold)', cardId, rawQty)}
        {hasPsa10 && stepper('PSA10', '#6c8ebf', pKey, psaQty)}
      </div>
    </div>
  )
}
