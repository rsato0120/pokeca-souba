'use client'

import { useState } from 'react'
import type { PriceRecord } from '@/types/pokeca'
import PriceHistoryChart from './PriceHistoryChart'

// 未開封BOX相場のタブ表示（シュリンクあり/なし）。
// 変異ファイル（box-{id}-shrink / -noshrink）がまだ無い弾は、従来の混在系列を
// 「全体」タブとしてそのまま出す（再スクレイプ前でも表示が崩れない）。

interface Props {
  shrink: PriceRecord[] | null
  noshrink: PriceRecord[] | null
  mixed: PriceRecord[] | null      // 後方互換の混在系列（フォールバック）
  /** スニダン成約APIで数えた**日別の成約箱数**。系列ごとに別物なのでタブと対応させる。
   *  ⚠ 出来高の棒はこれが無いと出ない（メルカリのnumFound差分は 2026-08-30 に廃止）。*/
  salesByDay?: {
    shrink?: Record<string, number>
    noshrink?: Record<string, number>
    mixed?: Record<string, number>
  }
  msrp: number | null
  packsPerBox?: number
  packPrice?: number
}

type VariantId = 'shrink' | 'noshrink' | 'all'

interface Stats {
  displayLow: number | null
  displayHigh: number | null
  premiumPct: number | null
  priceTrend: number | null
  onSale: number | null
  signal: { label: string; dot: string; color: string; desc: string } | null
}

function computeStats(history: PriceRecord[] | null, msrp: number | null): Stats | null {
  if (!history || history.length === 0) return null
  const latest = history[0]
  const prev = history[7] ?? null

  const displayLow = latest.low < latest.high ? latest.low : Math.round((latest.avg ?? latest.low) * 0.9)
  const displayHigh = latest.low < latest.high ? latest.high : Math.round((latest.avg ?? latest.low) * 1.1)
  const boxMid = Math.round((latest.low + latest.high) / 2)
  const premiumPct = msrp ? Math.round(((boxMid - msrp) / msrp) * 100) : null
  const priceTrend = prev
    ? Math.round(((latest.low + latest.high) / 2 - (prev.low + prev.high) / 2) / ((prev.low + prev.high) / 2) * 100)
    : null

  let signal: Stats['signal'] = null
  if (premiumPct != null) {
    if (premiumPct < 20) signal = { label: '買い好機', dot: '🟢', color: 'var(--up)', desc: '定価に近い水準。コスト効率が高い購入タイミング。' }
    else if (premiumPct > 80 && (priceTrend == null || priceTrend >= 0)) signal = { label: '高値注意', dot: '🔴', color: 'var(--down)', desc: '定価の大幅プレミア。相場が天井圏の可能性あり。' }
    else if (premiumPct > 80 && priceTrend != null && priceTrend < -3) signal = { label: '調整中', dot: '🟡', color: 'var(--flat)', desc: '高値から下落傾向。もう少し待つと安く買える可能性。' }
    else if (priceTrend != null && priceTrend < -5) signal = { label: '下落中', dot: '🟡', color: 'var(--flat)', desc: '価格が下落傾向。底値確認後の購入を検討。' }
    else signal = { label: '様子見', dot: '🟡', color: 'var(--flat)', desc: '標準的なプレミア水準。急いで買う必要はない。' }
  }

  return { displayLow, displayHigh, premiumPct, priceTrend, onSale: latest.on_sale ?? null, signal }
}

const labelMono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }

export default function BoxPricePanel({ shrink, noshrink, mixed, msrp, packsPerBox, packPrice, salesByDay }: Props) {
  const hasVariant = (shrink && shrink.length > 0) || (noshrink && noshrink.length > 0)

  const tabs: { id: VariantId; label: string; history: PriceRecord[] | null }[] = hasVariant
    ? [
        { id: 'shrink', label: 'シュリンクあり', history: shrink },
        { id: 'noshrink', label: 'シュリンクなし', history: noshrink },
      ]
    : [{ id: 'all', label: '未開封BOX', history: mixed }]

  // 初期タブ: データがある方を優先（シュリンクあり→なし→全体）
  const firstWithData = tabs.find(t => t.history && t.history.length > 0)?.id ?? tabs[0].id
  const [tab, setTab] = useState<VariantId>(firstWithData)

  const active = tabs.find(t => t.id === tab) ?? tabs[0]
  const stats = computeStats(active.history, msrp)

  // シュリンク別の系列は 2026-07-26 開始で履歴がほぼ無い。1〜2点では折れ線にならず
  // 「値段が取れていない」ように見えるので、点が足りない間は混在系列のグラフを出す。
  // 現在相場・定価比などの数値は選択中のタブのものを使う（グラフだけのフォールバック）。
  const MIN_CHART_POINTS = 3
  // ⚠ 出来高は**実際にグラフ化した系列**のものを渡す。フォールバックで混在系列を描いて
  //   いるのにシュリンクありの成約箱数を重ねると、価格と棒で別の市場を並べることになる。
  //   （出所を混ぜた引き算・重ね合わせはこのプロジェクトで繰り返している事故なので固定する）
  const salesFor = (id: VariantId) =>
    id === 'shrink' ? salesByDay?.shrink
      : id === 'noshrink' ? salesByDay?.noshrink
        : salesByDay?.mixed
  const chart: { history: PriceRecord[]; label: string; fallback: boolean; sales?: Record<string, number> } | null =
    active.history && active.history.length >= MIN_CHART_POINTS
      ? { history: active.history, label: active.label, fallback: false, sales: salesFor(active.id) }
      : mixed && mixed.length >= MIN_CHART_POINTS
        ? { history: mixed, label: '全体・シュリンク混在', fallback: true, sales: salesByDay?.mixed }
        : active.history && active.history.length > 0
          ? { history: active.history, label: active.label, fallback: false, sales: salesFor(active.id) }
          : null

  const tabBtn = (id: VariantId): React.CSSProperties => ({
    flex: '0 0 auto',
    padding: '8px 16px',
    borderRadius: '8px',
    border: `1px solid ${tab === id ? 'var(--accent)' : 'var(--ink-faint)'}`,
    background: tab === id ? 'var(--panel)' : 'transparent',
    color: tab === id ? 'var(--ink)' : 'var(--ink-dim)',
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    fontWeight: tab === id ? 700 : 500,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  })

  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '12px' }}>
        BOX · 未開封ボックス相場（メルカリ実勢）
      </div>

      {/* シュリンク別タブ（変異データがある弾のみ） */}
      {hasVariant && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={tabBtn(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!stats ? (
        <div style={{ padding: '18px 0', fontSize: '13px', color: 'var(--ink-faint)' }}>
          この条件の相場はまだ蓄積中です（毎日自動更新）。
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={labelMono}>現在相場</div>
              <div style={{ fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>
                ¥{stats.displayLow?.toLocaleString()}
                <span style={{ fontSize: '16px', color: 'var(--ink-dim)' }}>〜</span>
                ¥{stats.displayHigh?.toLocaleString()}
              </div>
            </div>

            {msrp != null && stats.premiumPct != null && (
              <div>
                <div style={labelMono}>定価比（¥{msrp.toLocaleString()} 基準）</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: stats.premiumPct > 0 ? 'var(--up)' : stats.premiumPct < 0 ? 'var(--down)' : 'var(--flat)' }}>
                  {stats.premiumPct > 0 ? `+${stats.premiumPct}%` : `${stats.premiumPct}%`}
                  <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--ink-faint)', marginLeft: '6px' }}>
                    {stats.premiumPct > 0 ? 'プレミア' : stats.premiumPct < 0 ? 'ディスカウント' : '定価並み'}
                  </span>
                </div>
              </div>
            )}

            {stats.priceTrend != null && (
              <div>
                <div style={labelMono}>7日間推移</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: stats.priceTrend > 2 ? 'var(--up)' : stats.priceTrend < -2 ? 'var(--down)' : 'var(--flat)' }}>
                  {stats.priceTrend > 0 ? `↑ +${stats.priceTrend}%` : stats.priceTrend < 0 ? `↓ ${stats.priceTrend}%` : '→ 横ばい'}
                </div>
              </div>
            )}

            {stats.onSale != null && (
              <div>
                <div style={labelMono}>出品中</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: 'var(--ink-dim)' }}>
                  {stats.onSale.toLocaleString()}件
                </div>
              </div>
            )}
          </div>

          {msrp != null && packsPerBox != null && packPrice != null && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px' }}>
              定価: {packsPerBox}パック × ¥{packPrice} = ¥{msrp.toLocaleString()}
            </div>
          )}

          {stats.signal && (
            <div style={{ marginTop: '20px', borderLeft: `3px solid ${stats.signal.color}`, paddingLeft: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px' }}>{stats.signal.dot}</span>
                <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700, color: stats.signal.color }}>
                  {stats.signal.label}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>{stats.signal.desc}</div>
            </div>
          )}

          {chart && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.1em', marginBottom: '10px' }}>
                PRICE HISTORY · 未開封BOX価格推移（{chart.label}）
              </div>
              {chart.fallback && (
                <div style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.6, marginBottom: '10px' }}>
                  「{active.label}」の推移は蓄積中のため、グラフはシュリンクあり／なしを合わせた全体の推移を表示しています。
                </div>
              )}
              <PriceHistoryChart history={chart.history} unit="箱" salesByDay={chart.sales} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
