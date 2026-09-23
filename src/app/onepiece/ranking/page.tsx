import RankingTabs from '@/components/RankingTabs'
import TrendingCards from '@/components/TrendingCards'
import CommunityPicks from '@/components/CommunityPicks'
import VoteLeaderboard from '@/components/VoteLeaderboard'
import BargainListings from '@/components/BargainListings'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
import { getOnePieceDetailBargains } from '@/lib/detail-bargains'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import GameTabs from '@/components/GameTabs'
import OnePieceRankings from '@/components/OnePieceRankings'
import { getOnePieceCatalog, getOnePiecePrices, onePieceRarity, onePieceShortName } from '@/lib/onepiece'
import { buildOnePieceRanking } from '@/lib/onepiece-ranking'
import DailySalesShare from '@/components/DailySalesShare'

const shareImageVersion = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

export const metadata: Metadata = {
  title: 'ONE PIECEランキング — 売れ筋・値動き・BOX',
  description: 'ONE PIECEカードの売れ筋、値上がり、値下がり、高額カード、未開封BOXを実成約データで比較。収録弾や期間で絞り込めます。',
  openGraph: {
    title: 'ワンピカード 今日の成約数TOP3',
    description: 'スニダン実成約から、今日売れたONE PIECEカード上位3枚を集計。',
    url: '/onepiece/ranking',
    images: [{ url: `/api/ranking-share-image?game=onepiece&v=${shareImageVersion}`, width: 1200, height: 630, alt: 'ワンピカード 今日の成約数TOP3' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ワンピカード 今日の成約数TOP3',
    description: 'スニダン実成約から、今日売れたONE PIECEカード上位3枚を集計。',
    images: [`/api/ranking-share-image?game=onepiece&v=${shareImageVersion}`],
  },
}

export default function Page() {
  const market = buildOnePieceMarket()
  const { products, sets } = getOnePieceCatalog()
  const { rows, baseDate } = buildOnePieceRanking(products, Object.fromEntries(products.map(p => [p.id, getOnePiecePrices(p.id)])))
  const dailySalesTop = rows.filter(row => row.kind === 'card' && row.salesToday > 0)
    .sort((a, b) => b.salesToday - a.salesToday || b.sales7d - a.sales7d || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(row => ({ href: `/onepiece/products/${row.id}`, name: onePieceShortName(row.name), rarity: onePieceRarity(row), sales: row.salesToday }))
  return <main className="wrap home-wrap">
    <SiteHeader /><GameTabs game="onepiece" />
    <section className="home-panel" style={{ marginTop: 'var(--sp-5)' }}>
      <div className="home-panel-head"><div><span>MARKET RANKING</span><h1 style={{ fontSize: 'clamp(18px, 3vw, 26px)', lineHeight: 1.4, margin: '8px 0' }}>ONE PIECE ランキング</h1></div><Link prefetch={false} href="/onepiece/cards">カード一覧 →</Link></div>
      <p className="source-note">売れているカードと相場の動きを、実際の成約から。{baseDate ? `集計基準日 ${baseDate}` : 'データを集計中です。'}</p>
      <RankingTabs tabs={[
        { id: 'sales', label: '売れ筋', note: '集計基準日を含む直近7日間の実成約数順です。', node: <><DailySalesShare date={baseDate ?? ''} rows={dailySalesTop} game="onepiece" pageUrl="https://pokeca-souba.vercel.app/onepiece/ranking" /><OnePieceRankings rows={rows} sets={sets} initialTab="sales" showTabs={false} /></> },
        { id: 'up', label: '値上がり', note: '前日比または7日比の騰落率です。', node: <OnePieceRankings rows={rows} sets={sets} initialTab="up" showTabs={false} /> },
        { id: 'down', label: '値下がり', note: '前日比または7日比の騰落率です。', node: <OnePieceRankings rows={rows} sets={sets} initialTab="down" showTabs={false} /> },
        { id: 'price', label: '高額カード', note: '記録日の成約平均価格が高い順です。', node: <OnePieceRankings rows={rows} sets={sets} initialTab="price" showTabs={false} /> },
        { id: 'boxes', label: 'BOX', note: '未開封BOXの成約数または成約平均価格で比較できます。', node: <OnePieceRankings rows={rows} sets={sets} initialTab="boxes" showTabs={false} /> },
        { id: 'views', label: '閲覧', note: '実際の閲覧が蓄積するとランキングに表示されます。', node: <TrendingCards cards={market.rows.map(r => ({ id: r.id, name: r.name, rarity: r.rarity, image: r.image, price: r.mid, dayChange: r.dayChange }))} /> },
        { id: 'votes', label: 'みんなの予想', node: <><CommunityPicks cards={market.rows.map(r => ({ ...r, aiUp: r.upPct }))} /><VoteLeaderboard prices={market.matrix} baseDate={market.baseDate} /></> },
        { id: 'deals', label: 'お買い得', node: <BargainListings rows={products.flatMap(p => getOnePieceDetailBargains(p.id)).sort((a, b) => b.discountPct - a.discountPct).slice(0, 30)} /> },
      ]} />
    </section>
    <p className="disclaimer">掲載商品の取得範囲内のランキングです。カードは素体（状態A〜D）、BOXは1箱単価。成約件数は市場全体の取引数ではありません。相場は各記録日までの成約平均で、45日を超える古い価格は対象外です。</p>
  </main>
}
