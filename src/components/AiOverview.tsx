import Link from 'next/link'
import SiteHeader from './SiteHeader'
import HeatPicks, { type HeatPick } from './HeatPicks'
import AccuracyStrip from './AccuracyStrip'
import { UP_VERDICT_PCT, type Verdict } from '@/lib/verdict'
import type { computeAccuracy } from '@/lib/accuracy'
import { marketCardHref } from '@/lib/market-links'
export interface ForecastRow { slug: string; name: string; rarity: string; upPct: number; verdict: Verdict; cur: number | null; m3Low: number; m3High: number }
export default function AiOverview({ picks, accuracy, forecastRows, accuracyHref = '/accuracy', movementPrioritized = false }: { picks: HeatPick[]; accuracy: ReturnType<typeof computeAccuracy>; forecastRows: ForecastRow[]; accuracyHref?: string; movementPrioritized?: boolean }) {
  return (
    <div className="wrap">
      <SiteHeader />

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '24px', fontWeight: 700, margin: '8px 0 6px' }}>AI予想</h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-faint)', lineHeight: 1.8, marginBottom: '28px' }}>
        AIは価格を取りにいきません。実際の成約データから作った数字を材料に、
        <strong style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>解釈だけ</strong>を担当します。
      </p>

      {picks.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
            <span className="sec-title">AIが見つけたカード</span>
            <span className="sec-sub">上昇確率{UP_VERDICT_PCT}%以上{movementPrioritized ? '・直近の動きを優先' : 'の銘柄だけ'}</span>
          </div>
          {movementPrioritized && <p style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.8, marginBottom: '12px' }}>
            直近の出品数減少・価格上昇・押し目からの反発を優先して掲載。動きがない候補は買い妙味の順に表示します。
          </p>}
          <HeatPicks picks={picks} />
        </section>
      )}

      <section className="sec" style={{ marginTop: '32px' }}>
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
          <span className="sec-title">AI予想の的中率</span>
          <span className="sec-sub">
            <Link prefetch={false} href={accuracyHref} style={{ color: 'var(--accent)' }}>詳しい実績を見る →</Link>
          </span>
        </div>
        <AccuracyStrip summary={accuracy} />
      </section>

      <section className="sec" style={{ marginTop: '32px' }}>
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
          <span className="sec-title">予想結果一覧</span>
          <span className="sec-sub">上昇確率の高い順・上位60件</span>
        </div>
        <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflowX: 'auto' }}>
          <div style={{ minWidth: '520px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px 84px 150px', gap: '10px', padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
              <span>カード</span>
              <span style={{ textAlign: 'right' }}>AI評価</span>
              <span style={{ textAlign: 'right' }}>上昇確率</span>
              <span style={{ textAlign: 'right' }}>現在 → 3ヶ月後</span>
            </div>
            {forecastRows.map((r) => (
              <Link prefetch={false}
                key={r.slug}
                href={marketCardHref(r.slug)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 92px 84px 150px', gap: '10px', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name} <span className="rare-badge">{r.rarity}</span>
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: r.verdict.color }}>
                  {r.verdict.label}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: 'var(--ink-dim)' }}>
                  {r.upPct}%
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: 'var(--ink-dim)' }}>
                  {r.cur == null ? '—' : `¥${r.cur.toLocaleString()}`} → ¥{r.m3Low.toLocaleString()}〜¥{r.m3High.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
