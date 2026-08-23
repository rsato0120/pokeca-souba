'use client'

import { useWatchlist } from '@/hooks/useWatchlist'

interface Props {
  cardId: string
  /** 登録時に記録する相場。「登録来 +X%」を出すための基準になる */
  mid?: number
  /** 一覧の行に置く小さい版（星だけ） */
  compact?: boolean
}

// ウォッチリストへの登録トグル。カード詳細とスクリーナーの行の両方で使う。
export default function WatchButton({ cardId, mid = 0, compact = false }: Props) {
  const { isWatched, toggle, loaded } = useWatchlist()
  const on = isWatched(cardId)

  // localStorage を読む前は状態が確定していないので、
  // 「未登録」を描いて直後に「登録済み」へ跳ねるのを避けて薄く出す
  const label = on ? 'ウォッチリストから外す' : 'ウォッチリストに追加'

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => toggle(cardId, mid)}
        aria-label={label}
        title={label}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: 1,
          padding: '4px',
          color: on ? 'var(--gold)' : 'var(--ink-faint)',
          opacity: loaded ? 1 : 0.35,
          transition: 'color .15s',
        }}
      >
        {on ? '★' : '☆'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => toggle(cardId, mid)}
      aria-pressed={on}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--fs-sm)',
        letterSpacing: '0.05em',
        padding: '8px 16px',
        borderRadius: 'var(--r-pill)',
        border: `1px solid ${on ? 'var(--gold)' : 'var(--hair)'}`,
        background: on ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg2)',
        color: on ? 'var(--gold)' : 'var(--ink-dim)',
        cursor: 'pointer',
        fontWeight: on ? 700 : 500,
        opacity: loaded ? 1 : 0.6,
      }}
    >
      <span style={{ fontSize: '15px', lineHeight: 1 }}>{on ? '★' : '☆'}</span>
      {on ? 'ウォッチ中' : 'ウォッチリストに追加'}
    </button>
  )
}
