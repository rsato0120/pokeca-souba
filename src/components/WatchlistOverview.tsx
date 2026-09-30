import Link from 'next/link'
import SiteHeader from './SiteHeader'
import WatchlistView from './WatchlistView'
import type { ScreenerRow } from './ScreenerTable'
export default function WatchlistOverview({ rows, index7d, game = 'pokemon' }: { rows: ScreenerRow[]; index7d: number | null; game?: 'pokemon' | 'onepiece' }) {
 const basePath = game === 'onepiece' ? '/onepiece' : ''
  return (
    <div className="wrap" style={{ maxWidth: '860px' }}>
      <Link prefetch={false}
        href={basePath + '/mypage'}
        style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', color: 'var(--ink-faint)', letterSpacing: '0.06em', display: 'inline-block', padding: '18px 0 10px' }}
      >
        ← マイページへ戻る
      </Link>
      <SiteHeader />

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-xl)', fontWeight: 800, margin: 'var(--sp-5) 0 var(--sp-2)' }}>
        ウォッチリスト
      </h1>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: 'var(--sp-5)' }}>
        買うかどうか迷っているカードを登録しておく一覧です。
        持っているカードの評価額は<Link prefetch={false} href={basePath + '/portfolio'} style={{ color: 'var(--accent)' }}>マイコレクション</Link>で管理できます。
        登録内容はこの端末のブラウザにのみ保存されます。
      </p>

      <WatchlistView game={game} cards={rows} index7d={index7d} />
    </div>
  )
}
