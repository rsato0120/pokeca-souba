import Link from 'next/link'
import SiteHeader from './SiteHeader'
import WatchlistView from './WatchlistView'
import type { ScreenerRow } from './ScreenerTable'
export default function MyPageOverview({ rows, index7d, game = 'pokemon' }: { rows: ScreenerRow[]; index7d: number | null; game?: 'pokemon' | 'onepiece' }) {
 const basePath = game === 'onepiece' ? '/onepiece' : ''
  const card: React.CSSProperties = {
    display: 'block',
    background: 'var(--bg2)',
    border: '1px solid var(--hair)',
    borderRadius: '12px',
    padding: '18px 20px',
    color: 'inherit',
  }

  return (
    <div className="wrap" style={{ maxWidth: '900px' }}>
      <SiteHeader />

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '24px', fontWeight: 800, margin: '8px 0 6px' }}>マイページ</h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: '10px' }}>
        ウォッチリストとコレクションの入口です。
      </p>
      <p style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.8, marginBottom: '26px', padding: '10px 14px', border: '1px solid var(--hair)', borderRadius: '8px' }}>
        ⚠ ウォッチリストとコレクションの内容は<strong style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>この端末のブラウザ（localStorage）にだけ保存</strong>されます。
        サーバーには送信していないため、別の端末やブラウザでは引き継がれません。閲覧データを消すと消えます。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        <Link prefetch={false} href={basePath + '/portfolio'} style={card}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>COLLECTION</div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>マイコレクション →</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.7 }}>
            持っているカード・未開封BOXの評価額、含み損益、AI予想の合計。
          </div>
        </Link>
        <Link prefetch={false} href={basePath + '/screener'} style={card}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>SCREENER</div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>詳細検索 →</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.7 }}>
            全カードを価格・変化率・レアリティ・弾で絞り込み、並べ替える。
          </div>
        </Link>
      </div>

      <section className="sec">
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
          <span className="sec-title">ウォッチリスト</span>
          <span className="sec-sub">
            <Link prefetch={false} href={basePath + '/watchlist'} style={{ color: 'var(--accent)' }}>単独ページで見る →</Link>
          </span>
        </div>
        <WatchlistView game={game} cards={rows} index7d={index7d} />
      </section>
    </div>
  )
}
