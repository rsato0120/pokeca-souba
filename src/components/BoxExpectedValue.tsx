import type { BoxEv } from '@/lib/box-ev'
import { evVerdict } from '@/lib/box-ev'

const labelMono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '4px' }
const cell: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right' }

// variantLabel … 回収率の分母に使った BOX相場が「シュリンクあり／なし」どちらのものか。
// ⚠ 以前はここが noshrink 固定で、上の相場パネルが「あり」を表示していても回収率だけ
//   「なし」の価格で計算されていた（MEGAドリームex）。呼び出し側と同じ系列を受け取り、
//   画面にも系列名を出して取り違えを防ぐ。
export default function BoxExpectedValue({ ev, boxName, variantLabel }: { ev: BoxEv; boxName: string; variantLabel?: string }) {
  const verdict = evVerdict(ev)
  const coveragePct = Math.round(ev.coverage * 100)
  const rows = ev.rows.filter(r => r.listed > 0)

  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '12px' }}>
        OPENING EV · 1BOX開封の期待値
      </div>

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={labelMono}>中身の期待値（1BOX）</div>
          <div style={{ fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>
            ¥{ev.ev.toLocaleString()}
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginLeft: '8px' }}>以上</span>
          </div>
        </div>

        {ev.boxPrice != null && (
          <div>
            <div style={labelMono}>BOX相場{variantLabel ? `（${variantLabel}）` : ''}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: 'var(--ink-dim)' }}>
              ¥{ev.boxPrice.toLocaleString()}
            </div>
          </div>
        )}

        {ev.recoveryPct != null && (
          <div>
            <div style={labelMono}>回収率（期待値 ÷ BOX相場{variantLabel ? `・${variantLabel}` : ''}）</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: ev.recoveryPct >= 100 ? 'var(--up)' : ev.recoveryPct >= 70 ? 'var(--flat)' : 'var(--down)' }}>
              {ev.recoveryPct}%
            </div>
          </div>
        )}

        {ev.msrpRecoveryPct != null && (
          <div>
            <div style={labelMono}>定価比（¥{ev.msrp?.toLocaleString()} 基準）</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: 'var(--ink-dim)' }}>
              {ev.msrpRecoveryPct}%
            </div>
          </div>
        )}
      </div>

      {verdict && (
        <div style={{ marginTop: '20px', borderLeft: `3px solid ${verdict.color}`, paddingLeft: '14px' }}>
          <div style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700, color: verdict.color, marginBottom: '4px' }}>
            {verdict.label}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>{verdict.desc}</div>
        </div>
      )}

      {/* 内訳 */}
      {rows.length > 0 && (
        <div style={{ marginTop: '24px', border: '1px solid var(--hair)', borderRadius: '8px', overflowX: 'auto' }}>
          <div style={{ minWidth: '460px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 88px 88px', gap: '10px', padding: '7px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
              <span>レアリティ</span>
              <span style={{ textAlign: 'right' }}>掲載/種類</span>
              <span style={{ textAlign: 'right' }}>封入率</span>
              <span style={{ textAlign: 'right' }}>平均相場</span>
              <span style={{ textAlign: 'right' }}>期待額</span>
            </div>
            {rows.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 88px 88px', gap: '10px', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--hair)' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{r.label}</span>
                <span style={{ ...cell, color: r.listed < r.kinds ? 'var(--ink-faint)' : 'var(--ink-dim)' }}>
                  {r.listed}/{r.kinds}
                </span>
                <span style={{ ...cell, color: 'var(--ink-faint)' }}>{(r.perCard * 100).toFixed(1)}%</span>
                <span style={{ ...cell, color: 'var(--ink-dim)' }}>¥{r.avgPrice.toLocaleString()}</span>
                <span style={{ ...cell, fontWeight: 700 }}>¥{r.ev.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 88px 88px', gap: '10px', alignItems: 'center', padding: '10px 14px', background: 'var(--bg2)' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>合計</span>
              <span style={{ ...cell, color: 'var(--ink-faint)' }}>{ev.listedKinds}/{ev.totalKinds}</span>
              <span />
              <span />
              <span style={{ ...cell, fontWeight: 700, color: 'var(--accent)' }}>¥{ev.ev.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--ink-faint)', lineHeight: 1.8 }}>
        <div>
          「封入率」は<strong style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>そのカード1枚が1BOXに入っている確率</strong>です。
          期待額＝封入率 × 現在相場 を、当サイトが相場を持っているカードぶんだけ足し上げています。
        </div>
        <div>
          {boxName}の掲載カバー率は <strong style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>{coveragePct}%</strong>（期待枚数ベース）。
          未掲載のカードと C/U/R/RR は<strong style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>0円として計算</strong>しているため、
          この期待値は実際の中身より必ず低く出る下限値です。
        </div>
        <div>
          封入率は公式非公表のため、有志の開封統計を採用しています（
          {ev.confidence === 'measured' ? '実測統計' : '同世代セットからの推定'}・出典:{' '}
          {ev.sourceUrl
            ? <a href={ev.sourceUrl} target="_blank" rel="nofollow noopener noreferrer" style={{ color: 'var(--ink-dim)' }}>{ev.source}</a>
            : ev.source}
          ）。実際の当たり枚数は運によって大きくブレます。
        </div>
      </div>
    </div>
  )
}
