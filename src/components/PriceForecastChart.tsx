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
  ReferenceLine,
} from 'recharts'
import type { PriceRecord, PriceForecast } from '@/types/pokeca'

interface Props {
  history: PriceRecord[]      // 新しい順（desc）
  forecast: PriceForecast     // 素体価格のAI予想
}

type Tab = 'raw' | 'psa10'

const DAY = 24 * 60 * 60 * 1000
const PAST_DAYS = 30
const FUTURE_DAYS = 90

// 軸ラベル用に ¥ 表記を圧縮。万は常に1桁小数（末尾.0は除去）にして
// 近接する目盛りが同じラベルに丸まって重複表示されるのを防ぐ
function yen(v: number): string {
  if (v >= 10000) return `¥${(v / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `¥${Math.round(v).toLocaleString()}`
}

interface Point {
  t: number              // 今日を0とした日数オフセット（-30〜+90）
  dateLabel: string      // M/D
  actual: number | null  // 実績（実線）
  forecast: number | null // AI予想（破線）
}

export default function PriceForecastChart({ history, forecast }: Props) {
  const [tab, setTab] = useState<Tab>('raw')
  // 履歴にPSA10価格が1つでもあればタブを出す（直近がnullでも過去にあれば拾う）
  const psaRecords = history.filter(r => r.psa10 != null)
  const latestPsa10 = psaRecords.length > 0 ? Number(psaRecords[0].psa10) : null
  const showPsa = latestPsa10 != null

  // 今日（最新レコードの日付）を基準にする（親が history.length>0 を保証）
  const todayMs = history.length > 0 ? new Date(history[0].date).getTime() : 0
  const fmtMD = (ms: number) => {
    const d = new Date(ms)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  // 素体予想の現在→各時点の成長率（PSA10はこの率を流用して近似）
  const curMid = (forecast.current_low + forecast.current_high) / 2
  const m1Mid = (forecast.m1_low + forecast.m1_high) / 2
  const m3Mid = (forecast.m3_low + forecast.m3_high) / 2
  const growthM1 = curMid > 0 ? m1Mid / curMid : 1
  const growthM3 = curMid > 0 ? m3Mid / curMid : 1
  const upPct = Math.round((growthM3 - 1) * 100)

  const { data, currentPrice, forecastPrice } = useMemo(() => {
    const pick = (r: PriceRecord): number | null =>
      tab === 'raw'
        ? (r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2)
        : (r.psa10 != null ? Number(r.psa10) : null)

    // ── 過去30日（実績・実線）──
    const cutoff = todayMs - PAST_DAYS * DAY
    const past = history
      .filter(r => new Date(r.date).getTime() >= cutoff)
      .slice()
      .reverse() // 古い順
      .map<Point>(r => {
        const ms = new Date(r.date).getTime()
        return {
          t: Math.round((ms - todayMs) / DAY),
          dateLabel: fmtMD(ms),
          actual: pick(r),
          forecast: null,
        }
      })

    // 境界（今日）の実績値 = 未来線の起点。実線と破線をここで接続する
    const base =
      tab === 'raw'
        ? (past.length ? past[past.length - 1].actual : null) ?? curMid
        : latestPsa10

    // ── 未来90日（AI予想・破線）──
    const future: Point[] = []
    if (base != null && base > 0) {
      for (let d = 0; d <= FUTURE_DAYS; d += 5) {
        // 0→30日は growthM1 へ、30→90日は growthM3 へ線形補間（%空間）
        const g =
          d <= 30
            ? 1 + (growthM1 - 1) * (d / 30)
            : growthM1 + (growthM3 - growthM1) * ((d - 30) / 60)
        future.push({
          t: d,
          dateLabel: fmtMD(todayMs + d * DAY),
          actual: d === 0 ? base : null, // 境界点だけ実績も持たせて線を繋ぐ
          forecast: Math.round(base * g),
        })
      }
    }

    // t=0 が past 末尾と future 先頭で重複するのでマージ
    const merged: Point[] = [...past]
    if (merged.length && future.length && merged[merged.length - 1].t === 0) {
      merged[merged.length - 1].forecast = future[0].forecast
      merged.push(...future.slice(1))
    } else {
      merged.push(...future)
    }

    const cur = base
    const fc = base != null ? Math.round(base * growthM3) : null
    return { data: merged, currentPrice: cur, forecastPrice: fc }
  }, [tab, history, todayMs, curMid, growthM1, growthM3, latestPsa10])

  const accent = upPct > 0 ? 'var(--up)' : upPct < 0 ? 'var(--down)' : 'var(--flat)'
  const actualColor = tab === 'raw' ? 'var(--gold)' : '#6c8ebf'

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
      {/* ── タブ（PSA10データがあるカードだけ表示） ── */}
      {showPsa && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('raw')} style={tabBtn('raw')}>
            素体
          </button>
          <button type="button" onClick={() => setTab('psa10')} style={tabBtn('psa10')}>
            PSA10
          </button>
        </div>
      )}

      {/* ── アクティブタブの大きな数値（投資アプリ風） ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          paddingLeft: '4px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '2px', letterSpacing: '0.06em' }}>
            現在価格
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '30px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
            {currentPrice != null ? `¥${currentPrice.toLocaleString()}` : '—'}
          </div>
        </div>
        <div style={{ fontSize: '22px', color: 'var(--ink-faint)', paddingBottom: '4px' }}>→</div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '2px', letterSpacing: '0.06em' }}>
            AI予想（3ヶ月後）
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '30px', fontWeight: 700, color: accent, lineHeight: 1 }}>
            {forecastPrice != null ? `¥${forecastPrice.toLocaleString()}` : '—'}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '18px',
            fontWeight: 700,
            color: accent,
            paddingBottom: '4px',
          }}
        >
          {upPct >= 0 ? '+' : ''}{upPct}%
        </div>
      </div>

      {/* ── チャート ── */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--hair)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[-PAST_DAYS, FUTURE_DAYS]}
            ticks={[-30, -15, 0, 30, 60, 90]}
            tickFormatter={(t: number) => (t === 0 ? '今日' : t > 0 ? `+${t}日` : `${-t}日前`)}
            tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }}
            stroke="var(--hair)"
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={yen}
            tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }}
            stroke="var(--hair)"
            width={52}
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
            formatter={(value, name) =>
              [`¥${Number(value).toLocaleString()}`, name === 'actual' ? '実績' : 'AI予想'] as [string, string]
            }
            labelFormatter={(t, payload) => {
              const p = payload?.[0]?.payload as Point | undefined
              const tn = Number(t)
              return p ? `${p.dateLabel}（${tn === 0 ? '今日' : tn > 0 ? `+${tn}日` : `${-tn}日前`}）` : ''
            }}
          />
          {/* 今日の境界線 */}
          <ReferenceLine x={0} stroke="var(--ink-faint)" strokeDasharray="3 3" />
          {/* 実績（実線）。データ点にドットを出し、疎なデータや単一点(PSA10)も
              「点」として読めるようにする */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={actualColor}
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: actualColor, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
          {/* AI予想（破線） */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={accent}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

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
          <span style={{ display: 'inline-block', width: '14px', borderTop: `2.5px solid ${actualColor}`, marginRight: '5px', verticalAlign: 'middle' }} />
          実績（過去30日）
        </span>
        <span>
          <span style={{ display: 'inline-block', width: '14px', borderTop: `2px dashed ${accent}`, marginRight: '5px', verticalAlign: 'middle' }} />
          AI予想（未来90日）
        </span>
      </div>
    </div>
  )
}
