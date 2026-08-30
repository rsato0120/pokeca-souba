'use client'

import { useState } from 'react'

// ランキングの種別切り替え（ページ内タブ）。
//
// ⚠ パネルの中身はサーバー側で組み立てて ReactNode で渡す。ここは表示の出し分けだけを持つ。
//   全パネルを同時にDOMに置くと、閲覧ランキングや投票の取得が裏で全部走るので、
//   選択中のものだけを描く。
// ⚠ タブは role="tab"、パネルは role="tabpanel" で結び、キーボードの左右キーでも動かす。

export interface RankingTab {
  id: string
  label: string
  /** タブの下に添える一行説明 */
  note?: string
  node: React.ReactNode
}

export default function RankingTabs({ tabs }: { tabs: RankingTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active))
  const current = tabs[idx]

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length
    setActive(tabs[next].id)
  }

  return (
    <div>
      <div role="tablist" aria-label="ランキングの種類" className="rank-tabs" onKeyDown={onKey}>
        {tabs.map((t) => {
          const on = t.id === current?.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`rank-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`rank-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={`rank-tab${on ? ' is-active' : ''}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {current?.note && (
        <p style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.8, margin: '12px 0 16px' }}>
          {current.note}
        </p>
      )}

      {current && (
        <div role="tabpanel" id={`rank-panel-${current.id}`} aria-labelledby={`rank-tab-${current.id}`}>
          {current.node}
        </div>
      )}
    </div>
  )
}
