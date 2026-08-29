import type { PriceRecord } from '@/types/pokeca'

// 売り板の厚み。株の板情報にあたる欄。
//
// 成約平均は「いくらで売れたか」＝過去。出品中の最安値は「いま出せばいくらで買えるか」＝現在。
// この2つがズレている時が売買の機会なので、並べて差を見せる。
// 出品件数の増減は供給圧そのもの（増えている＝売りたい人が増えている）。

interface Props {
  latest: PriceRecord
  /** ひとつ前の観測。出品件数の増減を出すのに使う */
  prev?: PriceRecord | null
}

function pctDiff(a: number, b: number): number {
  return ((a - b) / b) * 100
}

export default function OrderBook({ latest, prev = null }: Props) {
  const askLow = latest.ask_low != null ? Number(latest.ask_low) : null
  const askMid = latest.ask_mid != null ? Number(latest.ask_mid) : null
  const onSale = latest.on_sale != null ? Number(latest.on_sale) : null
  const traded = latest.avg != null ? Number(latest.avg) : (Number(latest.low) + Number(latest.high)) / 2

  // 板の情報が何も無いカードでは枠ごと出さない（空欄が並ぶより無い方がよい）
  if (askLow == null && askMid == null && onSale == null) return null

  const prevOnSale = prev?.on_sale != null ? Number(prev.on_sale) : null
  // 打ち切りに達した件数は「N件以上」の下限値。下限どうしの引き算は増減として読めないので
  // （どちらも本当の件数が分からない）、前回比は片方でも打ち切りなら出さない
  const capped = latest.on_sale_capped === true
  const prevCapped = prev?.on_sale_capped === true
  const onSaleDiff =
    onSale != null && prevOnSale != null && !capped && !prevCapped ? onSale - prevOnSale : null

  // 最安出品と成約平均の乖離。ここが読みどころなので言葉にして添える
  const gap = askLow != null && traded > 0 ? pctDiff(askLow, traded) : null
  const reading = (() => {
    if (gap == null) return null
    if (gap <= -8) return { text: '成約より安い出品が出ています（拾える余地あり）', color: 'var(--up)' }
    if (gap >= 12) return { text: '売り手が強気で、成約より高い値付けが並んでいます', color: 'var(--down)' }
    return { text: '出品値と成約値がほぼ一致しています（相場が固まっている状態）', color: 'var(--ink-dim)' }
  })()

  const cell = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-md)', fontWeight: 700, lineHeight: 1.3 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )

  return (
    <div className="panel" style={{ background: 'var(--bg2)', marginBottom: 'var(--sp-4)' }}>
      <div className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>ORDER BOOK · 売り板</div>

      <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {cell(
          '最安出品（いま買える値）',
          askLow != null
            ? <span style={{ color: 'var(--accent)' }}>¥{Math.round(askLow).toLocaleString()}</span>
            : <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>,
          gap != null ? `成約平均比 ${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%` : undefined,
        )}
        {cell(
          '出品の中央値',
          askMid != null
            ? <span style={{ color: 'var(--ink-dim)' }}>¥{Math.round(askMid).toLocaleString()}</span>
            : <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>,
        )}
        {cell(
          '出品中',
          onSale != null
            ? <span style={{ color: 'var(--ink-dim)' }}>{onSale}件{capped && '以上'}</span>
            : <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>,
          onSaleDiff != null && onSaleDiff !== 0 ? (
            <span style={{ color: onSaleDiff > 0 ? 'var(--down)' : 'var(--up)' }}>
              前回比 {onSaleDiff > 0 ? '+' : ''}{onSaleDiff}件{onSaleDiff > 0 ? '（売り圧増）' : '（捌けている）'}
            </span>
          ) : undefined,
        )}
      </div>

      {reading && (
        <div style={{ fontSize: 'var(--fs-base)', color: reading.color, lineHeight: 1.7, marginTop: 'var(--sp-3)' }}>
          {reading.text}
        </div>
      )}

      <div className="source-note">
        {latest.ask_source === 'snkrdunk'
          ? '最安出品・中央値はスニーカーダンクの状態別価格、出品件数はメルカリの出品中データです。成約平均が「いくらで売れたか（過去）」なのに対し、最安出品は「いま出せばいくらで買えるか（現在）」です。'
          : 'メルカリの出品中データ。成約平均が「いくらで売れたか（過去）」なのに対し、最安出品は「いま出せばいくらで買えるか（現在）」です。'}
      </div>
    </div>
  )
}
