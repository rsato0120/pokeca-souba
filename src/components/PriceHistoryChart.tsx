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
const PL = 68
const PR = 16
const PT = 16
const PB = 32

interface Props {
  history: PriceRecord[]
}

export default function PriceHistoryChart({ history }: Props) {
  const [days, setDays] = useState<number>(30)

  const nowMs = Date.now() + 9 * 60 * 60 * 1000
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000

  const filtered = history
    .filter(r => new Date(r.date).getTime() >= cutoffMs)
    .reverse()
    .map(r => ({
      date: r.date,
      low: Number(r.low),
      high: Number(r.high),
      mid: r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2,
      psa10: r.psa10 != null ? Number(r.psa10) : null,
    }))

  const hasPeriodData = (d: number) =>
    history.filter(r => new Date(r.date).getTime() >= nowMs - d * 24 * 60 * 60 * 1000).length >= 1

  const psa10Points = filtered.filter(r => r.psa10 != null)
  const hasPsa = psa10Points.length > 0

  // 右側にPSA10用の軸ラベル領域を確保（PSA10があるときだけ広げる）
  const PR_EFF = hasPsa ? 54 : PR

  // 通常相場の縦軸（左）— PSA10は桁が違うため除外して、通常相場の上下動が見えるようにする
  const regPrices = filtered.flatMap(r => [r.low, r.high])
  const rawMin = regPrices.length ? Math.min(...regPrices) : 0
  const rawMax = regPrices.length ? Math.max(...regPrices) : 1
  const pad = (rawMax - rawMin) * 0.2 || rawMin * 0.15 || 1000
  const minP = Math.max(0, rawMin - pad)
  const maxP = rawMax + pad

  const toY = (p: number) =>
    PT + (H - PT - PB) * (1 - (p - minP) / (maxP - minP))

  // PSA10の縦軸（右）— 独立スケール。1点だけのときは±15%でレンジを作る
  const psaVals = psa10Points.map(r => r.psa10 as number)
  const psaRawMin = psaVals.length ? Math.min(...psaVals) : 0
  const psaRawMax = psaVals.length ? Math.max(...psaVals) : 1
  const psaPad = (psaRawMax - psaRawMin) * 0.2 || psaRawMax * 0.15 || 1000
  const psaMin = Math.max(0, psaRawMin - psaPad)
  const psaMax = psaRawMax + psaPad
  const toYPsa = (p: number) =>
    psaMax === psaMin
      ? PT + (H - PT - PB) / 2
      : PT + (H - PT - PB) * (1 - (p - psaMin) / (psaMax - psaMin))

  const timestamps = filtered.map(r => new Date(r.date).getTime())
  const minT = timestamps[0] ?? nowMs
  const maxT = timestamps[timestamps.length - 1] ?? nowMs
  const rangeT = maxT - minT || 1

  const toX = (t: number) => PL + ((t - minT) / rangeT) * (W - PL - PR_EFF)

  const midPts = filtered.map(r => `${toX(new Date(r.date).getTime())},${toY(r.mid)}`).join(' ')
  const topPts = filtered.map(r => `${toX(new Date(r.date).getTime())},${toY(r.high)}`).join(' ')
  const botPts = [...filtered].reverse().map(r => `${toX(new Date(r.date).getTime())},${toY(r.low)}`).join(' ')

  const step = (maxP - minP) / 3
  const yLabels = [0, 1, 2, 3].map(i => ({
    y: toY(maxP - step * i),
    price: maxP - step * i,
  }))

  // PSA10右軸ラベル（1点だけのときはその値のみ）
  const psaStep = (psaMax - psaMin) / 3
  const psaYLabels = !hasPsa
    ? []
    : psaMax === psaMin
    ? [{ y: toYPsa(psaMax), price: psaMax }]
    : [0, 1, 2, 3].map(i => ({ y: toYPsa(psaMax - psaStep * i), price: psaMax - psaStep * i }))

  const fmtPrice = (p: number) =>
    p >= 10000 ? `${Math.round(p / 1000)}千` : Math.round(p).toLocaleString()

  // 点数が少なければ全ラベル、多ければ最大6個を均等表示（先頭・末尾は必ず含む）
  const MAX_LABELS = 6
  const dateLabelIndices = filtered.length <= MAX_LABELS
    ? filtered.map((_, i) => i)
    : Array.from(
        new Set(
          Array.from({ length: MAX_LABELS }, (_, k) =>
            Math.round((k * (filtered.length - 1)) / (MAX_LABELS - 1))
          )
        )
      )

  return (
    <div>
      {/* 期間セレクター */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
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
        {/* 凡例 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--ink-faint)' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '2px', background: 'var(--gold)', borderRadius: '1px' }} />
            通常相場{hasPsa ? '（左軸）' : ''}
          </span>
          {hasPsa && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--ink-faint)' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#6c8ebf', borderRadius: '50%' }} />
              PSA 10（右軸）
            </span>
          )}
        </div>
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
                <line key={y} x1={PL} y1={y} x2={W - PR_EFF} y2={y} />
              ))}
            </g>

            {/* 左Y軸ラベル（通常相場） */}
            <g fill="var(--ink-faint)" fontSize="11" textAnchor="end">
              {yLabels.map(({ y, price }) => (
                <text key={y} x={PL - 6} y={y + 4}>
                  {fmtPrice(price)}
                </text>
              ))}
            </g>

            {/* 右Y軸ラベル（PSA10・独立スケール） */}
            {hasPsa && (
              <g fill="#6c8ebf" fontSize="11" textAnchor="start">
                {psaYLabels.map(({ y, price }) => (
                  <text key={`psa-${y}`} x={W - PR_EFF + 6} y={y + 4}>
                    {fmtPrice(price)}
                  </text>
                ))}
              </g>
            )}

            {/* 価格レンジ帯 */}
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

            {/* 通常データポイント */}
            {filtered.map(r => (
              <circle
                key={r.date}
                cx={toX(new Date(r.date).getTime())}
                cy={toY(r.mid)}
                r="3.5"
                fill="var(--gold)"
              />
            ))}

            {/* PSA10をつなぐ線（2点以上のとき・右軸スケール） */}
            {psa10Points.length >= 2 && (
              <polyline
                points={psa10Points.map(r => `${toX(new Date(r.date).getTime())},${toYPsa(r.psa10 as number)}`).join(' ')}
                fill="none"
                stroke="#6c8ebf"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}

            {/* PSA10 データポイント（右軸スケール） */}
            {psa10Points.map(r => (
              <g key={`psa10-${r.date}`}>
                <circle
                  cx={toX(new Date(r.date).getTime())}
                  cy={toYPsa(r.psa10 as number)}
                  r="5"
                  fill="#6c8ebf"
                  stroke="var(--bg2)"
                  strokeWidth="1.5"
                />
                <text
                  x={toX(new Date(r.date).getTime())}
                  y={toYPsa(r.psa10 as number) - 10}
                  fill="#6c8ebf"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {fmtPrice(r.psa10 as number)}
                </text>
              </g>
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
