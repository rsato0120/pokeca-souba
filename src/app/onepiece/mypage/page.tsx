import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import WatchlistView from '@/components/WatchlistView'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
export const metadata = { title: 'ONE PIECE マイページ', robots: { index: false, follow: true } }
export default function Page() {
  const { rows, index7d } = buildOnePieceMarket()
  return <main className="wrap"><SiteHeader /><h1>ONE PIECE マイページ</h1>
    <section className="home-panel"><div className="home-panel-head"><h2>マイコレクション</h2><Link prefetch={false} href="/onepiece/portfolio">保有資産を見る →</Link></div>
      <p>カード・PSA10・BOXの保有数と取得価格を記録し、評価額・損益・資産推移・AI予想を確認できます。</p></section>
    <section className="home-panel"><div className="home-panel-head"><h2>ウォッチリスト</h2><Link prefetch={false} href="/onepiece/screener">詳細検索で探す →</Link></div><WatchlistView game="onepiece" cards={rows} index7d={index7d} /></section>
    <p><Link prefetch={false} href="/onepiece/cards">カード一覧</Link> · <Link prefetch={false} href="/onepiece/boxes">BOX一覧</Link> · <Link prefetch={false} href="/onepiece/accuracy">AIの的中実績</Link></p>
  </main>
}
