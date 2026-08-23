'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { PriceRecord } from '@/types/pokeca'

interface Props {
  history: PriceRecord[]
  /** 全期間の高値・安値。素体タブでのみ水平線として描く */
  extremes?: { high: number; low: number } | null
}

type Tab = 'raw' | 'psa10'

const PERIODS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
] as const

const DAY = 24 * 60 * 60 * 1000

/** 移動平均の本数。7日＝週の癖をならす、30日＝趨勢 */
const MA_SHORT = 7
const MA_LONG = 30

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
  ma7: number | null
  ma30: number | null
  /** その日に売れた枚数（1日あたり換算）。株の出来高にあたる */
  vol: number | null
}

/** 末尾 n 点の単純移動平均。欠測は飛ばし、実データが n の半分未満なら出さない */
function movingAverage(values: (number | null)[], i: number, n: number): number | null {
  const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((v): v is number => v != null && v > 0)
  if (win.length < Math.ceil(n / 2)) return null
  return win.reduce((a, b) => a + b, 0) / win.length
}

export default function PriceHistoryChart({ history, extremes = null }: Props) {
  const [tab, setTab] = useState<Tab>('raw')
  const [days, setDays] = useState<number>(30)

  // 履歴にPSA10価格が1つでもあればタブを出す
  const hasPsa = history.some(r => r.psa10 != null)
  const showPsa = hasPsa

  const nowMs = history.length > 0 ? new Date(history[0].date).getTime() : 0
  const hasPeriodData = (d: number) =>
    history.filter(r => new Date(r.date).getTime() >= nowMs - d * DAY).length >= 1

  const accent = tab === 'raw' ? 'var(--gold)' : '#6c8ebf'

  // ── 出来高（回転率） ──
  // sold_total は「これまでに売れた累計」なので、前の観測との差が期間中に売れた枚数になる。
  // 観測が飛んでいる日があるので日数で割って1日あたりに直す。
  // 差が負になる日は検索条件の変更やメルカリ側の数え直しなので、出来高としては採らない。
  const volumeByDate = useMemo(() => {
    const asc = [...history].reverse()   // 古い順
    const m = new Map<string, number>()
    for (let i = 1; i < asc.length; i++) {
      const cur = asc[i]
      const prev = asc[i - 1]
      if (cur.sold_total == null || prev.sold_total == null) continue
      const diff = Number(cur.sold_total) - Number(prev.sold_total)
      if (!(diff >= 0)) continue
      const gap = Math.max(1, Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / DAY))
      m.set(cur.date, diff / gap)
    }
    return m
  }, [history])

  const hasVolume = tab === 'raw' && volumeByDate.size >= 3

  const data = useMemo<Point[]>(() => {
    const cutoff = nowMs - days * DAY

    // 移動平均は表示期間の外も使って計算する。期間で切ってから平均すると
    // 左端の数点がいつまでも欠けたままになる
    const asc = [...history].reverse()
    const series = asc.map(r =>
      tab === 'raw'
        ? (r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2)
        : (r.psa10 != null ? Number(r.psa10) : null),
    )

    return asc
      .map((r, i) => ({
        label: r.date.slice(5).replace('-', '/'),
        date: r.date,
        value: series[i],
        ma7: movingAverage(series, i, MA_SHORT),
        ma30: movingAverage(series, i, MA_LONG),
        vol: volumeByDate.get(r.date) ?? null,
      }))
      .filter(p => new Date(p.date).getTime() >= cutoff)
  }, [history, tab, days, nowMs, volumeByDate])

  const hasData = data.some(d => d.value != null)
  // 移動平均は点が少ないと線にならないので、表示期間に十分な点がある時だけ出す
  const showMa7 = tab === 'raw' && data.filter(d => d.ma7 != null).length >= 4
  const showMa30 = tab === 'raw' && days >= 30 && data.filter(d => d.ma30 != null).length >= 6

  // Y軸domain: 'auto'だと線が底に張り付き変動が潰れるので、実データのmin/maxに
  // レンジ比例パディングを付けて変動が中央に見えるようにする
  // 高値・安値の水平線は素体タブのみ（PSA10は別系列なので混ぜない）
  const refLines = tab === 'raw' ? extremes : null

  const yDomain = useMemo<[number, number] | [string, string]>(() => {
    const vals = data.map(d => d.value).filter((v): v is number => v != null && v > 0)
    if (!vals.length) return ['auto', 'auto']
    // 水平線が枠外に出ないよう、極値も domain の計算に含める
    const all = refLines ? [...vals, refLines.high, refLines.low] : vals
    const lo = Math.min(...all)
    const hi = Math.max(...all)
    const pad = Math.max((hi - lo) * 0.18, hi * 0.04)
    return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)]
  }, [data, refLines])

  // 出来高の軸は上限を実測の3倍強に取る。こうすると棒がチャート下1/3に収まり、
  // 価格の線と重ならない（株のチャートと同じ見え方）
  const volDomain = useMemo<[number, number]>(() => {
    const vals = data.map(d => d.vol).filter((v): v is number => v != null)
    const max = vals.length ? Math.max(...vals) : 1
    return [0, Math.max(max * 3.4, 1)]
  }, [data])

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

  const legendItem = (color: string, label: string, dashed = false) => (
    <span key={label}>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          borderTop: `${dashed ? '2px dashed' : '2.5px solid'} ${color}`,
          marginRight: '5px',
          verticalAlign: 'middle',
        }}
      />
      {label}
    </span>
  )

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
        <ResponsiveContainer width="100%" height={260}>
          {/* right マージンは右端(最新日)のX軸ラベルが見切れないよう広めに確保する */}
          <ComposedChart data={data} margin={{ top: 8, right: 30, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--hair)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }}
              stroke="var(--hair)"
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="price"
              domain={yDomain}
              tickFormatter={yen}
              tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }}
              stroke="var(--hair)"
              width={60}
            />
            {/* 出来高の軸は目盛りを出さない。棒の高さは相対的に読めれば十分で、
                目盛りを2本出すとチャートが数字だらけになる */}
            <YAxis yAxisId="vol" domain={volDomain} hide />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--hair)',
                borderRadius: '8px',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--ink-faint)' }}
              formatter={(value, name) => {
                const v = Number(value)
                if (name === 'vol') return [`${v < 1 ? v.toFixed(1) : Math.round(v)}枚/日`, '成約'] as [string, string]
                if (name === 'ma7') return [`¥${Math.round(v).toLocaleString()}`, `${MA_SHORT}日平均`] as [string, string]
                if (name === 'ma30') return [`¥${Math.round(v).toLocaleString()}`, `${MA_LONG}日平均`] as [string, string]
                return [`¥${v.toLocaleString()}`, tab === 'raw' ? '相場' : 'PSA10'] as [string, string]
              }}
            />
            {refLines && (
              <>
                <ReferenceLine
                  yAxisId="price"
                  y={refLines.high}
                  stroke="var(--up)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.75}
                  label={{ value: '最高', position: 'insideTopLeft', fill: 'var(--up)', fontSize: 10, fontFamily: 'var(--mono)' }}
                />
                <ReferenceLine
                  yAxisId="price"
                  y={refLines.low}
                  stroke="var(--down)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.75}
                  label={{ value: '最安', position: 'insideBottomLeft', fill: 'var(--down)', fontSize: 10, fontFamily: 'var(--mono)' }}
                />
              </>
            )}
            {/* 出来高は価格の下に敷く。先に描くと線が上に来る */}
            {hasVolume && (
              <Bar
                yAxisId="vol"
                dataKey="vol"
                fill="var(--ink-faint)"
                fillOpacity={0.32}
                isAnimationActive={false}
                maxBarSize={14}
              />
            )}
            {showMa30 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma30"
                stroke="var(--ink-faint)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {showMa7 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma7"
                stroke="var(--ink-dim)"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="value"
              stroke={accent}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: accent, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* ── 凡例 ── */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          fontSize: '11px',
          color: 'var(--ink-dim)',
          fontFamily: 'var(--mono)',
          marginTop: '4px',
        }}
      >
        {legendItem(accent, tab === 'raw' ? '通常相場（取引平均）' : 'PSA10（スニダン平均）')}
        {showMa7 && legendItem('var(--ink-dim)', `${MA_SHORT}日平均`)}
        {showMa30 && legendItem('var(--ink-faint)', `${MA_LONG}日平均`, true)}
        {hasVolume && (
          <span>
            <span
              style={{
                display: 'inline-block',
                width: '9px',
                height: '10px',
                background: 'var(--ink-faint)',
                opacity: 0.32,
                marginRight: '5px',
                verticalAlign: 'middle',
              }}
            />
            成約枚数（メルカリ・1日あたり）
          </span>
        )}
      </div>
    </div>
  )
}
