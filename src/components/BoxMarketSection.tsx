'use client'

import { useState } from 'react'
import PriceHistoryChart from './PriceHistoryChart'
import BoxExpectedValue from './BoxExpectedValue'
import { boxSignal, type BoxVariantId, type BoxVariantView } from '@/lib/box-variant'
import type { PriceRecord } from '@/types/pokeca'

// 未開封BOXの相場・開封期待値・Xシェアを **1つのシュリンク選択** で束ねるセクション。
//
// ⚠ 以前はタブが BoxPricePanel の内部状態にあり、開封期待値（noshrink固定）と
//   Xシェア文（shrink固定）はその選択を見ていなかった。同じ画面で3つの系列が
//   同時に表示される事故（MEGAドリームex）の再発を防ぐため、状態はここ1箇所だけに置く。
// ⚠ 選択中の系列にデータが無いとき、他系列の値で埋めない。「データ不足」と出す。

interface Props {
  /** タブとして出す系列。あり/なしが1つでもあれば混在は含めない（同じ相場が2度出て選択が濁るため） */
  variants: BoxVariantView[]
  /** グラフだけの代替に使う混在系列。**数値の代替には使わない** */
  mixedForChart?: { history: PriceRecord[] | null; salesByDay?: Record<string, number> }
  msrp: number | null
  packsPerBox?: number
  packPrice?: number
  boxId: string
  boxName: string
  /** 購入リンクやバナーなど、相場の下・期待値の上に挟むもの */
  children?: React.ReactNode
}

const labelMono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }

export default function BoxMarketSection({ variants, mixedForChart, msrp, packsPerBox, packPrice, boxId, boxName, children }: Props) {
  // 初期選択はデータがある系列を優先（配列の順＝あり→なし→混在）
  const firstWithData = variants.find(v => v.history && v.history.length > 0)?.id ?? variants[0]?.id ?? 'mixed'
  const [tab, setTab] = useState<BoxVariantId>(firstWithData)

  const active = variants.find(v => v.id === tab) ?? variants[0]
  if (!active) return null

  const hasChoice = variants.length > 1
  const signal = boxSignal(active.premiumPct, active.weekPct)
  const hasData = active.history != null && active.history.length > 0

  // グラフは3点未満だと折れ線にならない。混在系列で代用する場合は**必ず明記**する
  // （数値は代用しない。ここだけは「見えない」より「別物と断って見せる」方が良い）。
  const MIN_CHART_POINTS = 3
  const mixed = mixedForChart
  const chart =
    active.history && active.history.length >= MIN_CHART_POINTS
      ? { history: active.history, label: active.label, fallback: false, sales: active.salesByDay }
      : mixed?.history && mixed.history.length >= MIN_CHART_POINTS && active.id !== 'mixed'
        ? { history: mixed.history, label: '全体・シュリンク混在', fallback: true, sales: mixed.salesByDay }
        : active.history && active.history.length > 0
          ? { history: active.history, label: active.label, fallback: false, sales: active.salesByDay }
          : null

  const tabBtn = (id: BoxVariantId): React.CSSProperties => ({
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

  // Xシェア文も**選択中の系列**から作る。文中の系列名を必ず添えて、どの相場の話か分かるようにする
  const tweetText = [
    `【BOX相場】${boxName}（${active.label}）`,
    hasData ? `現在 ¥${active.low?.toLocaleString()}〜¥${active.high?.toLocaleString()}${active.premiumPct != null ? `（定価比${active.premiumPct >= 0 ? `+${active.premiumPct}` : `${active.premiumPct}`}%）` : ''}` : '',
    active.ev && active.ev.ev > 0 && active.ev.recoveryPct != null
      ? `開封の期待値 ¥${active.ev.ev.toLocaleString()}以上（回収率${active.ev.recoveryPct}%）`
      : '',
    `#ポケカ #ポケカ相場`,
    `https://pokeca-souba.vercel.app/boxes/${boxId}`,
  ].filter(Boolean).join('\n')

  return (
    <>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--hair)', borderRadius: '10px', padding: '20px 24px', marginBottom: '28px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '12px' }}>
          BOX · 未開封ボックス相場（メルカリ実勢）
        </div>

        {hasChoice && (
          <div role="tablist" aria-label="シュリンクの状態" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {variants.map(v => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={tab === v.id}
                onClick={() => setTab(v.id)}
                style={tabBtn(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {!hasData ? (
          <div style={{ padding: '18px 0', fontSize: '13px', color: 'var(--ink-faint)', lineHeight: 1.7 }}>
            「{active.label}」の相場はデータ不足です（成約が確認できていません）。
            {hasChoice && <><br />他の状態のタブに切り替えると相場が出る場合があります。別の状態の金額をここに混ぜて表示することはしません。</>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={labelMono}>現在相場（{active.label}）</div>
                <div style={{ fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>
                  ¥{active.low?.toLocaleString()}
                  <span style={{ fontSize: '16px', color: 'var(--ink-dim)' }}>〜</span>
                  ¥{active.high?.toLocaleString()}
                </div>
              </div>

              {msrp != null && (
                <div>
                  <div style={labelMono}>定価比（¥{msrp.toLocaleString()} 基準）</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: active.premiumPct == null ? 'var(--ink-faint)' : active.premiumPct > 0 ? 'var(--up)' : active.premiumPct < 0 ? 'var(--down)' : 'var(--flat)' }}>
                    {active.premiumPct == null ? '—' : (
                      <>
                        {active.premiumPct > 0 ? `+${active.premiumPct}%` : `${active.premiumPct}%`}
                        <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--ink-faint)', marginLeft: '6px' }}>
                          {active.premiumPct > 0 ? 'プレミア' : active.premiumPct < 0 ? 'ディスカウント' : '定価並み'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div style={labelMono}>7日間推移</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: active.weekPct == null ? 'var(--ink-faint)' : active.weekPct > 2 ? 'var(--up)' : active.weekPct < -2 ? 'var(--down)' : 'var(--flat)' }}>
                  {active.weekPct == null ? '—' : active.weekPct > 0 ? `↑ +${active.weekPct}%` : active.weekPct < 0 ? `↓ ${active.weekPct}%` : '→ 横ばい'}
                </div>
              </div>

              <div>
                <div style={labelMono}>出品中（{active.label}）</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: active.onSale == null ? 'var(--ink-faint)' : 'var(--ink-dim)' }}>
                  {active.onSale == null ? '—' : `${active.onSale.toLocaleString()}件`}
                </div>
              </div>
            </div>

            {msrp != null && packsPerBox != null && packPrice != null && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px' }}>
                定価: {packsPerBox}パック × ¥{packPrice} = ¥{msrp.toLocaleString()}
              </div>
            )}

            {signal && (
              <div style={{ marginTop: '20px', borderLeft: `3px solid ${signal.color}`, paddingLeft: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>{signal.dot}</span>
                  <span style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700, color: signal.color }}>{signal.label}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>{signal.desc}</div>
              </div>
            )}

            {chart && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.1em', marginBottom: '10px' }}>
                  PRICE HISTORY · 未開封BOX価格推移（{chart.label}）
                </div>
                {chart.fallback && (
                  <div style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.6, marginBottom: '10px' }}>
                    「{active.label}」の推移は蓄積中のため、<strong>グラフだけ</strong>シュリンクあり／なしを合わせた全体の推移を表示しています。上の数値は「{active.label}」のものです。
                  </div>
                )}
                <PriceHistoryChart history={chart.history} unit="箱" salesByDay={chart.sales} />
              </div>
            )}
          </>
        )}

        {children}

        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 16px', borderRadius: '20px',
            border: '1px solid #aaa',
            color: 'var(--ink-dim)', fontSize: '12px', fontFamily: 'var(--mono)',
            letterSpacing: '0.03em', marginTop: '12px',
          }}
        >
          𝕏 でシェア
        </a>
      </div>

      {/* 開封期待値も**選択中の系列**の BOX相場で計算したものを出す */}
      {active.ev && active.ev.ev > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--hair)', borderRadius: '10px', padding: '20px 24px', marginBottom: '28px' }}>
          <BoxExpectedValue ev={active.ev} boxName={boxName} variantLabel={active.label} />
        </div>
      )}
    </>
  )
}
