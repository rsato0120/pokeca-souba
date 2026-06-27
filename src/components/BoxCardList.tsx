'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Card, Forecast } from '@/types/pokeca'
import { useCollection } from '@/hooks/useCollection'

type CardEntry = {
  card: Card
  forecast: Forecast | null
}

// SA=特別アート(SwSh期), HR=ハイパーレア。イーブイヒーローズ等の旧弾で使用。
const RARITY_ORDER = ['RR', 'SR', 'SA', 'SAR', 'MA', 'MUR', 'AR', 'UR', 'HR']

export default function BoxCardList({ cardsWithForecast }: { cardsWithForecast: CardEntry[] }) {
  const presentRarities = RARITY_ORDER.filter(r => cardsWithForecast.some(c => c.card.rarity === r))
  const tabs = ['全て', ...presentRarities]
  const [selected, setSelected] = useState('全て')
  const { getQty, setQty } = useCollection()

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
        <div className="card-table-header" style={{
          display: 'grid',
          gridTemplateColumns: '56px 1fr auto auto 88px',
          gap: '16px',
          padding: '8px 16px',
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--hair)',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          color: 'var(--ink-faint)',
          letterSpacing: '0.1em',
        }}>
          <span className="col-no">No.</span>
          <span>カード</span>
          <span style={{ textAlign: 'right' }}>相場</span>
          <span className="col-up" style={{ textAlign: 'right', minWidth: '60px' }}>上昇期待</span>
          <span style={{ textAlign: 'center' }}>所持枚数</span>
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
            const qty = getQty(card.id)
            return (
              <div
                key={card.id}
                className="card-table-row-wrap"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr auto auto 88px',
                  gap: '16px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--hair)',
                  background: qty > 0 ? 'rgba(var(--gold-rgb, 212,175,55), 0.06)' : undefined,
                }}
              >
                <Link
                  href={`/cards/${card.id}`}
                  style={{ display: 'contents', color: 'inherit' }}
                >
                  <div className="col-no" style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', padding: '14px 0 14px 16px' }}>
                    {card.card_no}
                  </div>
                  <div style={{ padding: '14px 0', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700 }}>{card.card_name}</span>
                    <span className="rare-badge">{card.rarity}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--ink-dim)', textAlign: 'right', whiteSpace: 'nowrap', padding: '14px 0' }}>
                    {forecast ? `¥${forecast.price_forecast.current_low.toLocaleString()}〜` : '—'}
                  </div>
                  <div className="col-up" style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 600, color: upColor, textAlign: 'right', minWidth: '60px', padding: '14px 0' }}>
                    {upPct !== null ? `↑ ${upPct}%` : '—'}
                  </div>
                </Link>
                {/* 所持枚数コントロール */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 16px 8px 0' }}>
                  <button
                    onClick={() => setQty(card.id, qty - 1)}
                    style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      border: '1px solid var(--hair)', background: 'transparent',
                      color: 'var(--ink-dim)', fontSize: '14px', lineHeight: 1,
                      cursor: qty > 0 ? 'pointer' : 'default',
                      opacity: qty > 0 ? 1 : 0.3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >−</button>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600,
                    minWidth: '16px', textAlign: 'center',
                    color: qty > 0 ? 'var(--gold)' : 'var(--ink-faint)',
                  }}>
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(card.id, qty + 1)}
                    style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      border: '1px solid var(--hair)', background: 'transparent',
                      color: 'var(--ink-dim)', fontSize: '14px', lineHeight: 1,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >＋</button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
