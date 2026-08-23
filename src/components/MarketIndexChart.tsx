'use client'

import { useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'

// 相場指数のパネル。株の日経平均にあたる基準線を1本置く。
//
// ここに載るデータはサーバ側（src/lib/index-series.ts）で計算済み。
// 全指数を丸ごと渡して切替はクライアントで完結させる — 指数は全部で20本前後、
// 1本60点なので、ページに焼いても数十KBに収まる。

/** [日付, 指数値] の組。JSONに焼く量を抑えるためオブジェクトではなく配列で持つ */
export type IndexPointWire = [string, number]

export interface IndexWire {
  key: string
  label: string
  members: number
  points: IndexPointWire[]   // 古い順
}

interface Props {
  indices: IndexWire[]
}

const PERIODS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '全期間', days: 0 },
] as const

const DAY = 86400000

function changePct(points: IndexPointWire[], days: number): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  if (days <= 0) {
    const first = points[0]
    return first[1] > 0 ? ((last[1] - first[1]) / first[1]) * 100 : null
  }
  const targetMs = Date.parse(`${last[0]}T00:00:00+09:00`) - days * DAY
  let base: IndexPointWire | null = null
  for (let i = points.length - 1; i >= 0; i--) {
    if (Date.parse(`${points[i][0]}T00:00:00+09:00`) <= targetMs) { base = points[i]; break }
  }
  if (!base) base = points[0]
  if (base[0] === last[0] || base[1] <= 0) return null
  return ((last[1] - base[1]) / base[1]) * 100
}

function pct(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function toneOf(v: number | null): string {
  if (v == null) return 'var(--ink-faint)'
  if (v > 0.05) return 'var(--up)'
  if (v < -0.05) return 'var(--down)'
  return 'var(--flat)'
}

export default function MarketIndexChart({ indices }: Props) {
  const [key, setKey] = useState(indices[0]?.key ?? 'all')
  const [days, setDays] = useState<number>(30)

  const active = indices.find((i) => i.key === key) ?? indices[0]

  const data = useMemo(() => {
    if (!active) return []
    const pts = active.points
    if (days <= 0) return pts.map(([date, value]) => ({ label: date.slice(5).replace('-', '/'), date, value }))
    const cutoff = Date.parse(`${pts[pts.length - 1][0]}T00:00:00+09:00`) - days * DAY
    return pts
      .filter(([date]) => Date.parse(`${date}T00:00:00+09:00`) >= cutoff)
      .map(([date, value]) => ({ label: date.slice(5).replace('-', '/'), date, value }))
  }, [active, days])

  const yDomain = useMemo<[number, number] | undefined>(() => {
    const vals = data.map((d) => d.value)
    if (!vals.length) return undefined
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)

    // 基準線(100)は「100より上か下か」という指数の読み方そのものなので、なるべく画角に入れる。
    // ただし無条件に入れると、指数が60まで下がった弾の7日チャートで、実際の値動きが
    // 下端の細い帯に潰れて何も読めなくなる。データの幅と同じ距離までなら引き込む。
    const span = Math.max(hi - lo, hi * 0.01)
    if (100 >= lo - span && 100 <= hi + span) {
      lo = Math.min(lo, 100)
      hi = Math.max(hi, 100)
    }

    const pad = Math.max((hi - lo) * 0.2, 0.6)
    return [lo - pad, hi + pad]
  }, [data])

  if (!active || active.points.length < 2) return null

  const latest = active.points[active.points.length - 1]
  const baseDate = active.points[0][0]
  const d1 = changePct(active.points, 1)
  const d7 = changePct(active.points, 7)
  const d30 = changePct(active.points, 30)
  const dAll = changePct(active.points, 0)

  // 指数が100より上か下かで線の色を変える（基準日から見て市場が上か下か）
  const accent = latest[1] >= 100 ? 'var(--up)' : 'var(--down)'

  const periodBtn = (active_: boolean): React.CSSProperties => ({
    padding: '4px 11px',
    border: `1px solid ${active_ ? 'var(--ink-dim)' : 'var(--hair)'}`,
    background: active_ ? 'var(--panel)' : 'transparent',
    color: active_ ? 'var(--ink)' : 'var(--ink-dim)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--fs-xs)',
    borderRadius: 'var(--r-md)',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  })

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-4) var(--sp-4) var(--sp-2)',
        marginBottom: 'var(--sp-6)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* ── 見出し＋指数セレクタ ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
        <span className="eyebrow" style={{ marginBottom: 0 }}>SOUBA INDEX · 相場指数</span>
        <select
          value={key}
          onChange={(e) => setKey(e.target.value)}
          aria-label="指数を選ぶ"
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--fs-xs)',
            padding: '4px 8px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--hair)',
            background: 'var(--panel)',
            color: 'var(--ink)',
            maxWidth: '190px',
          }}
        >
          {indices.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}（{i.members}枚）
            </option>
          ))}
        </select>
      </div>

      {/* ── 現在値と騰落 ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
        <div>
          <div className="stat-label">{baseDate.replace(/-/g, '/')} = 100</div>
          <span className="stat-value" style={{ color: accent }}>{latest[1].toFixed(2)}</span>
        </div>
        {([['前日比', d1], ['7日', d7], ['30日', d30], ['基準日比', dAll]] as const).map(([label, v]) => (
          <div key={label}>
            <div className="stat-label">{label}</div>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--fs-md)',
                fontWeight: 700,
                color: toneOf(v),
              }}
            >
              {pct(v)}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-1)' }}>
          {PERIODS.map(({ label, days: d }) => (
            <button key={label} type="button" onClick={() => setDays(d)} style={periodBtn(days === d)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 指数チャート ── */}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--hair)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--ink-faint)', fontSize: 10, fontFamily: 'var(--mono)' }}
            stroke="var(--hair)"
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: 'var(--ink-faint)', fontSize: 10, fontFamily: 'var(--mono)' }}
            stroke="var(--hair)"
            width={44}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--r-md)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--fs-sm)',
            }}
            labelStyle={{ color: 'var(--ink-faint)' }}
            formatter={(value) => [Number(value).toFixed(2), '指数'] as [string, string]}
          />
          {/* 基準線。ここより上なら基準日より市場が高い */}
          <ReferenceLine y={100} stroke="var(--ink-faint)" strokeDasharray="3 3" strokeOpacity={0.7} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={accent}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="source-note" style={{ marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
        採用{active.members}枚の等ウェイト連鎖指数（1枚1票）。日々の値動きは上下10%を刈り込んだ平均で集計し、
        グッズ・どうぐ・スタジアム・エネルギーは除外しています。
      </div>
    </div>
  )
}
