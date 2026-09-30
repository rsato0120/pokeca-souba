import type { Metadata } from 'next'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'
import { buildScreenerRows } from '@/lib/mypage-data'
import MyPageOverview from '@/components/MyPageOverview'

// マイページ。ウォッチリストとコレクションの入口をここにまとめる。
//
// ⚠ 既存URLは消していない。/watchlist・/portfolio・/screener はそのまま生きていて、
//   このページはその上位の入口として置いている（SEOと既存ブックマークを壊さない）。
// ⚠ 端末ごとの中身なので noindex。

export const metadata: Metadata = {
  title: 'マイページ',
  description: 'ウォッチリストと持っているカード・BOXの評価額をまとめて確認できます。',
  robots: { index: false, follow: true },
}

export default function MyPage() {
  const rows = buildScreenerRows()
  const allIndex = getMarketIndex('all')
  const index7d = allIndex ? indexChangePct(allIndex, 7) : null

  return <MyPageOverview rows={rows} index7d={index7d} />
}
