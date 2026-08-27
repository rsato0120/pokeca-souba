'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export type SearchCard = {
  slug: string
  card_name: string
  rarity: string
  box_name: string
  up_pct: number | null
}

export default function SearchBar({ cards }: { cards: SearchCard[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const results = query.trim().length === 0 ? [] : cards.filter((c) => {
    const q = query.trim().toLowerCase()
    return (
      c.card_name.toLowerCase().includes(q) ||
      c.rarity.toLowerCase().includes(q) ||
      c.box_name.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  // 外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(slug: string) {
    setQuery('')
    setOpen(false)
    router.push(`/cards/${slug}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="searchbar">
        <input
          type="text"
          placeholder="カード名・レアリティ・収録弾で検索"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.trim() && setOpen(true)}
          autoComplete="off"
        />
        {query ? (
          <button onClick={() => { setQuery(''); setOpen(false) }} style={{ background: 'none', color: 'var(--ink-faint)', fontSize: '16px' }}>
            ✕
          </button>
        ) : (
          // 絵文字の🔍は環境ごとに色も形も変わる（Windowsでは青紫の別物になる）ので、
          // 線画のSVGにして currentColor で他のUIと同じ色に揃える
          <button disabled aria-hidden="true" style={{ background: 'none', color: 'var(--ink-faint)', cursor: 'default', display: 'flex', alignItems: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="15.4" y1="15.4" x2="20.5" y2="20.5" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg2)',
            border: '1px solid var(--hair)',
            borderRadius: '8px',
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {results.map((c) => (
            <button
              key={c.slug}
              onClick={() => handleSelect(c.slug)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '12px',
                alignItems: 'center',
                width: '100%',
                padding: '12px 16px',
                borderBottom: '1px solid var(--hair)',
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ink)',
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{c.card_name}</span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    color: 'var(--ink-faint)',
                    marginLeft: '8px',
                  }}
                >
                  {c.box_name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    color: 'var(--accent)',
                  }}
                >
                  {c.rarity}
                </span>
                {c.up_pct !== null && (
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: c.up_pct >= 50 ? 'var(--up)' : 'var(--ink-dim)',
                    }}
                  >
                    ↑{c.up_pct}%
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length > 0 && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg2)',
            border: '1px solid var(--hair)',
            borderRadius: '8px',
            padding: '14px 16px',
            zIndex: 100,
            fontSize: '13px',
            color: 'var(--ink-faint)',
          }}
        >
          「{query}」に一致するカードが見つかりません
        </div>
      )}
    </div>
  )
}
