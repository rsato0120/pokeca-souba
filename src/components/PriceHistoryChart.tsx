'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { PriceRecord } from '@/types/pokeca'

interface Props {
  history: PriceRecord[]
}

type Tab = 'raw' | 'psa10'

const PERIODS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
] as const

const DAY = 24 * 60 * 60 * 1000

// Y軸ラベル用 ¥ 表記。10万円未満はフル円表記（狭いレンジでも目盛りが潰れない）、
// 10万円以上だけ万表記でコンパクトにする
function yen(v: number): string {
  if (v >= 100000) return `¥${(v / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `¥${Math.round(v).toLocaleString()}`
}

interface Point {
  label: string          // M/D
  date: string
  value: number | null
}

export default function PriceHistoryChart({ history }: Props) {
  const [tab, setTab] = useState<Tab>('raw')
  const [days, setDays] = useState<number>(30)

  // 履歴にPSA10価格が1つでもあればタブを出す
  const hasPsa = history.some(r => r.psa10 != null)
  const showPsa = hasPsa

  const nowMs = history.length > 0 ? new Date(history[0].date).getTime() : 0
  const hasPeriodData = (d: number) =>
    history.filter(r => new Date(r.date).getTime() >= nowMs - d * DAY).length >= 1

  const accent = tab === 'raw' ? 'var(--gold)' : '#6c8ebf'

  const data = useMemo<Point[]>(() => {
    const cutoff = nowMs - days * DAY
    return history
      .filter(r => new Date(r.date).getTime() >= cutoff)
      .slice()
      .reverse() // 古い順
      .map(r => ({
        label: r.date.slice(5).replace('-', '/'),
        date: r.date,
        value:
          tab === 'raw'
            ? (r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2)
            : (r.psa10 != null ? Number(r.psa10) : null),
      }))
  }, [history, tab, days, nowMs])

  const hasData = data.some(d => d.value != null)

  const tabBtn = (id: Tab): React.CSSProperties => ({
    flex: '0 0 auto',
    padding: '9px 20px',
    borderRadius: '8px',
    // 非アクティブも明るい文字＋見える枠でモバイルでも判別できるようにする
    border: `1px solid ${tab === id ? 'var(--gold)' : 'var(--ink-faint)'}`,
    background: tab === id ? 'var(--panel)' : 'transparent',
    color: tab === id ? 'var(--ink)' : 'var(--ink-dim)',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
    fontWeight: tab === id ? 700 : 500,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    lineHeight: 1.3,
  })

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--hair)',
        borderRadius: '12px',
        padding: '18px 16px 10px',
      }}
    >
      {/* ── タブ＋期間セレクター ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '18px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {showPsa && (
          <>
            <button type="button" onClick={() => setTab('raw')} style={tabBtn('raw')}>
              素体
            </button>
            <button type="button" onClick={() => setTab('psa10')} style={tabBtn('psa10')}>
              PSA10
            </button>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {PERIODS.map(({ label, days: d }) => {
            const active = days === d
            const enabled = hasPeriodData(d)
            return (
              <button
                key={label}
                type="button"
                onClick={() => enabled && setDays(d)}
                style={{
                  padding: '5px 12px',
                  border: `1px solid ${active ? 'var(--ink-dim)' : 'var(--hair)'}`,
                  background: active ? 'var(--panel)' : 'transparent',
                  color: active ? 'var(--ink)' : enabled ? 'var(--ink-dim)' : 'var(--ink-faint)',
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  borderRadius: '6px',
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
      </div>

      {/* ── チャート ── */}
      {!hasData ? (
        <div
          style={{
            height: '240px',
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
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--hair)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }}
              stroke="var(--hair)"
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={yen}
              tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }}
              stroke="var(--hair)"
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--hair)',
                borderRadius: '8px',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--ink-faint)' }}
              formatter={(value) =>
                [`¥${Number(value).toLocaleString()}`, tab === 'raw' ? '相場' : 'PSA10'] as [string, string]
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={accent}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: accent, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* ── 凡例 ── */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          fontSize: '11px',
          color: 'var(--ink-dim)',
          fontFamily: 'var(--mono)',
          marginTop: '4px',
        }}
      >
        <span>
          <span style={{ display: 'inline-block', width: '14px', borderTop: `2.5px solid ${accent}`, marginRight: '5px', verticalAlign: 'middle' }} />
          {tab === 'raw' ? '通常相場（取引平均）' : 'PSA10（スニダン平均）'}
        </span>
      </div>
    </div>
  )
}
