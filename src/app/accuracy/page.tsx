import Link from 'next/link'
import type { Metadata } from 'next'
import { computeAccuracy, HORIZONS, type Dir } from '@/lib/accuracy'
import SiteHeader from "@/components/SiteHeader"

export const metadata: Metadata = {
  title: 'AI予想 的中実績',
  description: 'このサイトのAI相場予想が実際にどれだけ当たっているかの的中率・実績を公開しています。',
}

const DIR_LABEL: Record<Dir, string> = { up: '上昇', flat: '様子見', down: '下落' }
const DIR_COLOR: Record<Dir, string> = { up: 'var(--up)', flat: 'var(--flat)', down: 'var(--down)' }

function addDays(date: string, days: number): string {
  return new Date(new Date(date).getTime() + days * 86400000).toISOString().slice(0, 10)
}

export default function AccuracyPage() {
  const acc = computeAccuracy()
  const hasResolved = HORIZONS.some(h => acc.byHorizon[h].resolved > 0)
  const firstResultDate = acc.firstPredictionDate ? addDays(acc.firstPredictionDate, HORIZONS[0]) : null

  return (
    <div className="wrap" style={{ maxWidth: '760px' }}>
      <Link
        href="/"
        style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)', letterSpacing: '0.06em', display: 'inline-block', padding: '18px 0 10px' }}
      >
        ← トップへ戻る
      </Link>
      <SiteHeader />

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 800, margin: '24px 0 6px' }}>
        AI予想 的中実績
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, marginBottom: '28px' }}>
        このサイトのAIが出した相場予想を毎日記録し、後日の実際の相場と照合しています。
        「上昇」と予想して値上がり、「下落」で値下がり、「様子見」で横ばい（±10%以内）なら的中とカウントします。
      </p>

      {/* 的中率サマリー */}
      {hasResolved ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          {HORIZONS.map(h => {
            const s = acc.byHorizon[h]
            const color = s.rate >= 60 ? 'var(--up)' : s.rate >= 40 ? 'var(--accent)' : 'var(--down)'
            return (
              <div key={h} style={{ background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  {h}日後の的中率
                </div>
                {s.resolved > 0 ? (
                  <>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '34px', fontWeight: 700, color, lineHeight: 1 }}>
                      {s.rate}%
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '6px', fontFamily: 'var(--mono)' }}>
                      {s.hits} / {s.resolved} 件 的中
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '14px', color: 'var(--ink-faint)', paddingTop: '6px' }}>集計中</div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '12px', padding: '28px 20px', marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--mincho)', fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
            実績を集計中です
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8 }}>
            予想の記録を開始しました（{acc.firstPredictionDate ?? '—'} 〜）。
            <br />
            最初の判定（7日後予想）は <strong style={{ color: 'var(--accent)' }}>{firstResultDate ?? '—'}</strong> 頃から表示されます。
          </p>
          <p style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '12px', fontFamily: 'var(--mono)' }}>
            記録済み予想: {acc.totalPredictions.toLocaleString()} 件
          </p>
        </div>
      )}

      {/* 方向別の内訳 */}
      {hasResolved && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '12px' }}>
            BY DIRECTION · 予想方向ごとの的中率（30日後）
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {(['up', 'flat', 'down'] as Dir[]).map(d => {
              const b = acc.byHorizon[30].byDir[d]
              const rate = b.resolved > 0 ? Math.round((b.hits / b.resolved) * 100) : null
              return (
                <div key={d} style={{ background: 'var(--panel)', border: '1px solid var(--hair)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: DIR_COLOR[d], fontWeight: 700, marginBottom: '6px' }}>{DIR_LABEL[d]}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700 }}>
                    {rate != null ? `${rate}%` : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
                    {b.hits}/{b.resolved}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 最近の判定 */}
      {acc.recent.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '12px' }}>
            RECENT · 最近の判定
          </h2>
          <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflow: 'hidden' }}>
            {acc.recent.map((r, i) => (
              <Link
                key={`${r.cardId}-${r.horizon}-${r.predictedOn}-${i}`}
                href={`/cards/${r.cardId}`}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}
              >
                <span style={{ fontSize: '16px' }}>{r.hit ? '🟢' : '🔴'}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{r.cardName} </span>
                  <span className="rare-badge">{r.rarity}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                    {r.predictedOn}に「<span style={{ color: DIR_COLOR[r.dir] }}>{DIR_LABEL[r.dir]}</span>」予想・{r.horizon}日後判定
                  </span>
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--ink-dim)' }}>¥{r.midThen.toLocaleString()} → ¥{r.midActual.toLocaleString()}</span>
                  <span style={{ display: 'block', color: r.changePct > 0 ? 'var(--up)' : r.changePct < 0 ? 'var(--down)' : 'var(--ink-faint)' }}>
                    {r.changePct > 0 ? '+' : ''}{r.changePct}%
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--ink-faint)', lineHeight: 1.8 }}>
        ※ 的中率は予想を記録した日からの経過で順次確定します（未確定 {acc.pendingCount.toLocaleString()} 件）。
        相場はメルカリ等の実勢価格をもとに集計しています。本実績は参考情報であり、将来の予想精度を保証するものではありません。
      </p>

      <div className="disclaimer" style={{ marginTop: '20px' }}>
        本予想はAIが公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。売買の判断はご自身の責任で行ってください。
      </div>
    </div>
  )
}
