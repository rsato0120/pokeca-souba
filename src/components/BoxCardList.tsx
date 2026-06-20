'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Card, Forecast } from '@/types/pokeca'

type CardEntry = {
  card: Card
  forecast: Forecast | null
}

const RARITY_ORDER = ['RR', 'SR', 'SAR', 'MUR', 'AR', 'UR']

export default function BoxCardList({ cardsWithForecast }: { cardsWithForecast: CardEntry[] }) {
  const presentRarities = RARITY_ORDER.filter(r => cardsWithForecast.some(c => c.card.rarity === r))
  const tabs = ['全て', ...presentRarities]
  const [selected, setSelected] = useState('全て')

  const filtered = selected === '全て'
    ? cardsWithForecast
    : cardsWithForecast.filter(c => c.card.rarity === selected)

  return (
    <div>
      {/* レアリティタブ */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map(r => {
          const count = r === '全て' ? cardsWithForecast.length : cardsWithForecast.filter(c => c.card.rarity === r).length
          const active = selected === r
          return (
            <button
              key={r}
              onClick={() => setSelected(r)}
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                border: `1px solid ${active ? 'var(--gold)' : 'var(--hair)'}`,
                background: active ? 'var(--gold)' : 'transparent',
                color: active ? '#000' : 'var(--ink-dim)',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {r}
              <span style={{ marginLeft: '4px', opacity: 0.65, fontSize: '10px' }}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* カードリスト */}
      <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '56px 1fr auto auto',
          gap: '16px',
          padding: '8px 16px',
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--hair)',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          color: 'var(--ink-faint)',
          letterSpacing: '0.1em',
        }}>
          <span>No.</span>
          <span>カード</span>
          <span style={{ textAlign: 'right' }}>相場</span>
          <span style={{ textAlign: 'right', minWidth: '60px' }}>上昇期待</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '24px 16px', fontSize: '13px', color: 'var(--ink-faint)' }}>
            該当するカードがありません
          </div>
        ) : (
          filtered.map(({ card, forecast }) => {
            const upPct = forecast?.overall.up_pct ?? null
            const upColor = upPct !== null
              ? upPct >= 50 ? 'var(--up)' : upPct >= 35 ? 'var(--gold)' : 'var(--ink-faint)'
              : 'var(--ink-faint)'
            return (
              <Link
                key={card.id}
                href={`/cards/${card.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr auto auto',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--hair)',
                  color: 'inherit',
                }}
              >
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)' }}>
                  {card.card_no}
                </div>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{card.card_name}</span>
                  <span className="rare-badge">{card.rarity}</span>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--ink-dim)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {forecast ? `¥${forecast.price_forecast.current_low.toLocaleString()}〜` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 600, color: upColor, textAlign: 'right', minWidth: '60px' }}>
                  {upPct !== null ? `↑ ${upPct}%` : '—'}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
