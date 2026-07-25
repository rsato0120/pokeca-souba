import Link from 'next/link'

export interface SetRow {
  setId: string
  label: string
  cardSlug: string
  cardName: string
  low: number | null
  high: number | null
  onSale: number | null
  listPrice?: number
}

// セット商品（ポケセンのスペシャルBOX等）の相場を地域ごとに並べるパネル。
// パック未開封BOXではなく“セット”の実勢を出す。カード単体価格はカード一覧側に残す。
export default function SetPricePanel({ rows }: { rows: SetRow[] }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '4px' }}>
        SET · セット相場（未開封スペシャルBOX・メルカリ実勢）
      </div>
      <div style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.6, marginBottom: '14px' }}>
        カード1枚封入のセット商品（未開封）の相場です。カード単体の相場は下のカード一覧をご覧ください。
      </div>

      <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '7px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
          <span>地域セット</span>
          <span style={{ textAlign: 'right' }}>セット相場</span>
          <span style={{ textAlign: 'right', minWidth: '56px' }}>出品中</span>
        </div>
        {rows.map(r => (
          <Link
            key={r.setId}
            href={`/cards/${r.cardSlug}`}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}
          >
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{r.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginLeft: '8px' }}>{r.cardName}</span>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {r.low != null && r.high != null ? (
                <>¥{r.low.toLocaleString()}<span style={{ color: 'var(--ink-dim)', fontWeight: 400 }}>〜</span>¥{r.high.toLocaleString()}</>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--ink-faint)', fontWeight: 400 }}>
                  {r.listPrice != null ? `定価 ¥${r.listPrice.toLocaleString()}` : 'データ蓄積中'}
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--ink-dim)', textAlign: 'right', minWidth: '56px' }}>
              {r.onSale != null ? `${r.onSale.toLocaleString()}件` : '—'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
