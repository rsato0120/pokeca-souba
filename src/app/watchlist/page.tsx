import Link from 'next/link'
import type { Metadata } from 'next'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'
import { buildScreenerRows } from '@/lib/mypage-data'
import WatchlistView from '@/components/WatchlistView'
import SiteHeader from "@/components/SiteHeader"

export const metadata: Metadata = {
  title: 'ウォッチリスト',
  description: '気になるポケモンカードを登録して、登録時からの値動きを追いかけられます。大きく動いた日には通知も受け取れます。',
  // 端末ごとの中身なので検索結果に出しても意味がない
  robots: { index: false, follow: true },
}

export default function WatchlistPage() {
  // どのカードが登録されているかはビルド時には分からないので、スクリーナーと同じ行データを
  // 丸ごと渡してクライアント側で突き合わせる。
  // ⚠ 組み立ては src/lib/mypage-data.ts に集約した（マイページと共有。コピーするとガード値が
  //   片方だけ変わって同じカードの前日比が2画面で食い違う）。
  const rows = buildScreenerRows()

  const allIndex = getMarketIndex('all')
  const index7d = allIndex ? indexChangePct(allIndex, 7) : null

  return (
    <div className="wrap" style={{ maxWidth: '860px' }}>
      <Link
        href="/mypage"
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
        持っているカードの評価額は<Link href="/portfolio" style={{ color: 'var(--accent)' }}>マイコレクション</Link>で管理できます。
        登録内容はこの端末のブラウザにのみ保存されます。
      </p>

      <WatchlistView cards={rows} index7d={index7d} />
    </div>
  )
}
