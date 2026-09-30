import type { Metadata } from 'next'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'
import { buildScreenerRows } from '@/lib/mypage-data'
import WatchlistOverview from '@/components/WatchlistOverview'

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

  return <WatchlistOverview rows={rows} index7d={index7d} />
}
