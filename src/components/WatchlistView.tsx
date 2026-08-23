'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useWatchlist } from '@/hooks/useWatchlist'
import PushSubscribe from '@/components/PushSubscribe'
import type { ScreenerRow } from '@/components/ScreenerTable'

interface Props {
  cards: ScreenerRow[]
  /** 相場指数の7日変化率(%)。「市場比」の基準 */
  index7d: number | null
}

function pct(v: number | null, digits = 1): { text: string; color: string } {
  if (v == null) return { text: '—', color: 'var(--ink-faint)' }
  const color = v > 0.5 ? 'var(--up)' : v < -0.5 ? 'var(--down)' : 'var(--flat)'
  return { text: `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`, color }
}

export default function WatchlistView({ cards, index7d }: Props) {
  const { list, loaded, remove, count } = useWatchlist()

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const watched = useMemo(() => {
    return Object.entries(list)
      .map(([id, entry]) => {
        const card = byId.get(id)
        if (!card) return null
        // 登録来の騰落。登録時の相場を控えていないカード（旧データ・価格未取得時の登録）は出さない
        const sinceAdd =
          entry.price > 0 && card.mid > 0 ? ((card.mid - entry.price) / entry.price) * 100 : null
        return { card, entry, sinceAdd }
      })
      .filter((x): x is { card: ScreenerRow; entry: { at: string; price: number }; sinceAdd: number | null } => x != null)
      .sort((a, b) => (b.card.weekChange ?? -999) - (a.card.weekChange ?? -999))
  }, [list, byId])

  if (!loaded) {
    return (
      <div style={{ padding: 'var(--sp-7) 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 'var(--fs-base)' }}>
        読み込み中…
      </div>
    )
  }

  if (count === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--hair)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-7) var(--sp-5)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-md)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
          まだ何も登録されていません
        </div>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: 'var(--sp-4)' }}>
          気になるカードのページか
          <Link href="/screener" style={{ color: 'var(--gold)' }}>スクリーナー</Link>
          で ☆ を押すと、ここに並びます。持っていないカードの値動きを追うための一覧です。
        </p>
        <Link href="/screener" className="pill pill-gold">スクリーナーで探す →</Link>
      </div>
    )
  }

  return (
    <div>
      <PushSubscribe cardIds={Object.keys(list)} />

      <div style={{ overflowX: 'auto', border: '1px solid var(--hair)', borderRadius: 'var(--r-lg)', background: 'var(--panel)' }}>
        <table className="data-table" style={{ minWidth: '700px' }}>
          <thead>
            <tr>
              {['カード', '相場', '登録来', '前日比', '7日比', '市場比', ''].map((h, i) => (
                <th
                  key={h || `x${i}`}
                  className={i === 0 ? 'dt-sticky' : undefined}
                  style={{ textAlign: i === 0 ? 'left' : i === 6 ? 'center' : 'right' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {watched.map(({ card, entry, sinceAdd }) => {
              const since = pct(sinceAdd)
              const day = pct(card.dayChange)
              const week = pct(card.weekChange)
              const rel = pct(card.weekChange != null && index7d != null ? card.weekChange - index7d : null)
              return (
                <tr key={card.id}>
                  <td className="dt-sticky">
                    <Link href={`/cards/${card.id}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'inherit' }}>
                      {card.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="row-thumb" />
                      ) : (
                        <span className="row-thumb row-thumb-ph">—</span>
                      )}
                      <span style={{ minWidth: 0 }}>
                        <span className="row-name" style={{ display: 'block' }}>{card.name}</span>
                        <span className="row-meta">
                          {card.rarity} · {entry.at ? `${entry.at.slice(5).replace('-', '/')} 登録` : '登録日不明'}
                          {entry.price > 0 && ` · ¥${entry.price.toLocaleString()}`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="dt-num dt-price">
                    {card.mid > 0 ? `¥${card.mid.toLocaleString()}` : '—'}
                  </td>
                  <td className="dt-num" style={{ fontWeight: 700, color: since.color }}>{since.text}</td>
                  <td className="dt-num" style={{ color: day.color }}>{day.text}</td>
                  <td className="dt-num" style={{ color: week.color }}>{week.text}</td>
                  <td className="dt-num" style={{ color: rel.color }}>{rel.text}</td>
                  <td style={{ textAlign: 'center', padding: 'var(--sp-2)' }}>
                    <button
                      type="button"
                      onClick={() => remove(card.id)}
                      aria-label={`${card.name} をウォッチリストから外す`}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: '15px', padding: '4px 8px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="source-note" style={{ marginTop: 'var(--sp-3)' }}>
        「登録来」は ☆ を押した時点の相場と現在の相場を比べた値です。
        ウォッチリストはこの端末のブラウザにだけ保存され、サーバーには送られません
        （通知をONにした場合のみ、通知を送るために対象カードの一覧が保存されます）。
      </p>
    </div>
  )
}
