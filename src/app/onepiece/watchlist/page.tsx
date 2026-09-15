import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import WatchlistView from '@/components/WatchlistView'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
export const metadata = { title: 'ONE PIECE ウォッチリスト', robots: { index: false, follow: true } }
export default function Page() {
  const { rows, index7d } = buildOnePieceMarket()
  return <main className="wrap"><SiteHeader /><h1>ONE PIECE ウォッチリスト</h1>
    <p className="source-note">登録時からの値動きを確認できます。登録はこのブラウザに保存されます。保有分は<Link href="/onepiece/portfolio">マイコレクション</Link>へ。</p>
    <WatchlistView game="onepiece" cards={rows} index7d={index7d} />
  </main>
}
