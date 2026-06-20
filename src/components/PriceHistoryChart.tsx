'use client'
import { useState } from 'react'
import type { PriceRecord } from '@/types/pokeca'

const PERIODS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
] as const

const W = 760
const H = 200
const PL = 68  // left padding (Y labels)
const PR = 16
const PT = 16
const PB = 32  // bottom padding (date labels)

interface Props {
  history: PriceRecord[]
}

export default function PriceHistoryChart({ history }: Props) {
  const [days, setDays] = useState<number>(30)

  const nowMs = Date.now() + 9 * 60 * 60 * 1000  // JST
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000

  const filtered = history
    .filter(r => new Date(r.date).getTime() >= cutoffMs)
    .reverse()  // oldest → newest
    .map(r => ({
      date: r.date,
      low: Number(r.low),
      high: Number(r.high),
      mid: (Number(r.low) + Number(r.high)) / 2,
    }))

  const hasPeriodData = (d: number) =>
    history.filter(r => new Date(r.date).getTime() >= nowMs - d * 24 * 60 * 60 * 1000).length >= 1

  // ── 座標計算 ──────────────────────────────────────────────
  const allPrices = filtered.flatMap(r => [r.low, r.high])
  const rawMin = allPrices.length ? Math.min(...allPrices) : 0
  const rawMax = allPrices.length ? Math.max(...allPrices) : 1
  const pad = (rawMax - rawMin) * 0.2 || rawMin * 0.15 || 1000
  const minP = Math.max(0, rawMin - pad)
  const maxP = rawMax + pad

  const toY = (p: number) =>
    PT + (H - PT - PB) * (1 - (p - minP) / (maxP - minP))

  const timestamps = filtered.map(r => new Date(r.date).getTime())
  const minT = timestamps[0] ?? nowMs
  const maxT = timestamps[timestamps.length - 1] ?? nowMs
  const rangeT = maxT - minT || 1

  const toX = (t: number) => PL + ((t - minT) / rangeT) * (W - PL - PR)

  // ── SVGパス ──────────────────────────────────────────────
  const midPts = filtered.map(r => `${toX(new Date(r.date).getTime())},${toY(r.mid)}`).join(' ')
  const topPts = filtered.map(r => `${toX(new Date(r.date).getTime())},${toY(r.high)}`).join(' ')
  const botPts = [...filtered].reverse().map(r => `${toX(new Date(r.date).getTime())},${toY(r.low)}`).join(' ')

  // ── Y軸ラベル ─────────────────────────────────────────────
  const step = (maxP - minP) / 3
  const yLabels = [0, 1, 2, 3].map(i => ({
    y: toY(maxP - step * i),
    price: maxP - step * i,
  }))

  const fmtPrice = (p: number) =>
    p >= 10000 ? `${Math.round(p / 1000)}千` : Math.round(p).toLocaleString()

  // 日付ラベル（最初・中間・最後）
  const dateLabelIndices = filtered.length <= 1 ? [0] :
    [0, Math.floor((filtered.length - 1) / 2), filtered.length - 1]

  return (
    <div>
      {/* 期間セレクター */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {PERIODS.map(({ label, days: d }) => {
          const active = days === d
          const enabled = hasPeriodData(d)
          return (
            <button
              key={label}
              onClick={() => enabled && setDays(d)}
              style={{
                padding: '4px 12px',
                border: `1px solid ${active ? 'var(--gold)' : 'var(--hair)'}`,
                background: active ? 'var(--gold)' : 'transparent',
                color: active ? 'var(--bg)' : enabled ? 'var(--ink-dim)' : 'var(--ink-faint)',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                borderRadius: '4px',
                cursor: enabled ? 'pointer' : 'default',
                letterSpacing: '0.05em',
                opacity: enabled ? 1 : 0.4,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* グラフ本体 */}
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--hair)',
          borderRadius: '8px',
          padding: '14px 8px 6px',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              height: `${H}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-faint)',
              fontSize: '13px',
              gap: '6px',
            }}
          >
            <span>データ蓄積中</span>
            <span style={{ fontSize: '11px' }}>毎日自動取得 — しばらくお待ちください</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ fontFamily: 'var(--mono)' }}
          >
            {/* グリッド */}
            <g stroke="var(--hair)" strokeWidth="0.8">
              {yLabels.map(({ y }) => (
                <line key={y} x1={PL} y1={y} x2={W - PR} y2={y} />
              ))}
            </g>

            {/* Y軸ラベル */}
            <g fill="var(--ink-faint)" fontSize="11" textAnchor="end">
              {yLabels.map(({ y, price }) => (
                <text key={y} x={PL - 6} y={y + 4}>
                  {fmtPrice(price)}
                </text>
              ))}
            </g>

            {/* 価格レンジ帯（低〜高） */}
            {filtered.length >= 2 && (
              <polygon
                points={`${topPts} ${botPts}`}
                fill="var(--gold)"
                fillOpacity="0.10"
              />
            )}

            {/* 中央値ライン */}
            {filtered.length >= 2 && (
              <polyline
                points={midPts}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2"
              />
            )}

            {/* データポイント */}
            {filtered.map(r => (
              <circle
                key={r.date}
                cx={toX(new Date(r.date).getTime())}
                cy={toY(r.mid)}
                r="3.5"
                fill="var(--gold)"
              />
            ))}

            {/* 日付ラベル */}
            {dateLabelIndices.map(i => {
              if (!filtered[i]) return null
              const x = toX(new Date(filtered[i].date).getTime())
              const anchor = i === 0 ? 'start' : i === filtered.length - 1 ? 'end' : 'middle'
              return (
                <text key={i} x={x} y={H - 6} fill="var(--ink-faint)" fontSize="11" textAnchor={anchor}>
                  {filtered[i].date.slice(5)}
                </text>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
