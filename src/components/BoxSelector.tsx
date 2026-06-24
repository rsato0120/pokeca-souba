'use client'

import { useRouter } from 'next/navigation'

interface BoxOption {
  box_id: string
  box_name: string
}

interface Props {
  boxes: BoxOption[]
}

// 収録弾をドロップダウンで選択 → 選んだBOXページへ遷移。
// 弾が何個増えても1行で収まり、横スクロールにならない。
export default function BoxSelector({ boxes }: Props) {
  const router = useRouter()

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginTop: '12px', marginBottom: '32px' }}>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) router.push(`/boxes/${e.target.value}`)
        }}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          padding: '8px 36px 8px 16px',
          borderRadius: '20px',
          border: '1px solid var(--ink-faint)',
          background: 'var(--panel)',
          color: 'var(--ink)',
          fontFamily: 'var(--mono)',
          fontSize: '13px',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          minWidth: '200px',
        }}
      >
        <option value="" disabled>
          弾を選ぶ…
        </option>
        {boxes.map((b) => (
          <option key={b.box_id} value={b.box_id}>
            {b.box_name}
          </option>
        ))}
      </select>
      {/* ▾ アイコン */}
      <span
        style={{
          position: 'absolute',
          right: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--ink-dim)',
          fontSize: '11px',
        }}
      >
        ▾
      </span>
    </div>
  )
}
