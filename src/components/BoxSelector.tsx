'use client'

import { useRouter } from 'next/navigation'

interface BoxOption {
  box_id: string
  box_name: string
  release_ym?: string   // "2025-12" 形式。発売年でグループ分けするのに使う
}

interface Props {
  boxes: BoxOption[]
  current?: string          // 現在表示中のBOX（選択状態にする）
  marginTop?: number
  marginBottom?: number
  basePath?: string
}

// 収録弾をドロップダウンで選択 → 選んだBOXページへ遷移。
// 弾が何個増えても1行で収まり、横スクロールにならない。
export default function BoxSelector({ boxes, current, marginTop = 12, marginBottom = 32, basePath = '/boxes' }: Props) {
  const router = useRouter()

  // 弾が増えるほど一覧が縦に伸びて選びにくいので、発売年でグループに畳む。
  // 新しい年が上（探すのはたいてい新しい弾）。年が分からない弾は最後に「その他」でまとめる。
  const groups = (() => {
    const byYear = new Map<string, BoxOption[]>()
    for (const b of boxes) {
      const year = /^\d{4}/.exec(b.release_ym ?? '')?.[0] ?? ''
      const key = year || 'その他'
      const list = byYear.get(key)
      if (list) list.push(b)
      else byYear.set(key, [b])
    }
    return [...byYear.entries()].sort((a, b) => {
      if (a[0] === 'その他') return 1
      if (b[0] === 'その他') return -1
      return b[0].localeCompare(a[0])
    })
  })()

  return (
    // ⚠ maxWidth を効かせる（2026-08-30）。<select> は最長の <option> に合わせて伸びるため、
    //   「プロモカードパック 25th ANNIVERSARY edition」のような長い弾名があると 426px になり、
    //   390px のスマホで画面外にはみ出していた（トップのヒーロー枠ごと押し広げていた）。
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginTop, marginBottom }}>
      <select
        defaultValue={current ?? ''}
        onChange={(e) => {
          if (e.target.value && e.target.value !== current) router.push(`${basePath}/${e.target.value}`)
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
          maxWidth: '100%',
          // 長い弾名でも枠内に収める（はみ出す代わりに省略される）
          textOverflow: 'ellipsis',
        }}
      >
        <option value="" disabled>
          弾を選ぶ…
        </option>
        {groups.map(([year, list]) => (
          <optgroup key={year} label={year === 'その他' ? 'その他' : `${year}年`}>
            {list.map((b) => (
              <option key={b.box_id} value={b.box_id}>
                {b.box_name}
              </option>
            ))}
          </optgroup>
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
