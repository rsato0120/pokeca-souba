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
import SalesRanking from '@/components/SalesRanking'
import MoversList from '@/components/MoversList'
import BoxRanking from '@/components/BoxRanking'
import { onePieceBoxRows } from '@/lib/onepiece-box-ranking'
import { onePieceMarketId } from '@/lib/market-links'
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
  const cards = rows.filter(p => p.kind === 'card')
  const movers = cards.filter(p => (p.day ?? p.week) != null && p.avg >= 1000).map(p => ({ slug: onePieceMarketId(p.id), name: onePieceShortName(p.name), rarity: onePieceRarity(p), image: p.image_url, mid: p.avg, changePct: (p.day ?? p.week)!, changeLabel: p.day != null ? '前日比' : '7日比' }))
  return <main className="wrap" style={{ maxWidth: '860px' }}>
    <SiteHeader />
    <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '24px', fontWeight: 800, margin: '8px 0 6px' }}>ランキング</h1>
    <p style={{ fontSize: '13px', color: 'var(--ink-faint)', lineHeight: 1.8, marginBottom: '20px' }}>すべて実際の成約データから算出しています。判定の基準は<Link prefetch={false} href="/onepiece/accuracy" style={{ color: 'var(--accent)' }}>AI予想の的中実績</Link>と揃えてあります。</p>
    <RankingTabs tabs={[
      { id: 'sales', label: '売れ筋', note: '直近7日間の実成約数順。集計基準日 ' + (baseDate ?? '集計中'), node: <><DailySalesShare date={baseDate ?? ''} rows={dailySalesTop} game="onepiece" pageUrl="https://pokeca-souba.vercel.app/onepiece/ranking" /><SalesRanking rows={cards.filter(p => p.sales7d > 0).sort((a,b) => b.sales7d-a.sales7d).slice(0,30).map(p => ({ slug: onePieceMarketId(p.id), name: onePieceShortName(p.name), rarity: onePieceRarity(p), image: p.image_url, mid: p.avg, sales7d: p.sales7d, salesToday: p.salesToday, onSale: market.observations[p.id]?.history[0]?.on_sale ?? null, onSaleCapped: false, listings: [] }))} /></> },
      { id: 'bargains', label: 'お買い得', note: '取得できた出品を成約相場と比較しています。', node: <BargainListings rows={products.flatMap(p => getOnePieceDetailBargains(p.id)).sort((a,b) => b.discountPct-a.discountPct).slice(0,30)} /> },
      { id: 'movers', label: '値動き', note: '相場¥1,000以上のカード。前日比が取れないカードは7日比で比較します。', node: <MoversList surge={movers.filter(p => p.changePct > 0).sort((a,b) => b.changePct-a.changePct).slice(0,10)} drop={movers.filter(p => p.changePct < 0).sort((a,b) => a.changePct-b.changePct).slice(0,10)} /> },
      { id: 'views', label: '閲覧', note: '直近で見られているカード。', node: <TrendingCards cards={market.rows.filter(r => cards.some(p => onePieceMarketId(p.id) === r.id)).map(r => ({ id: r.id, name: r.name, rarity: r.rarity, image: r.image, price: r.mid, dayChange: r.dayChange }))} /> },
      { id: 'votes', label: 'みんなの予想', node: <><CommunityPicks cards={market.rows.map(r => ({ ...r, aiUp: r.upPct }))} /><VoteLeaderboard prices={market.matrix} baseDate={market.baseDate} /></> },
      { id: 'boxes', label: 'BOX', note: '未開封BOXの7日変化率順。価格は1箱単価です。', node: <BoxRanking rows={onePieceBoxRows(rows, sets, market.observations).slice(0,20)} /> },
    ]} />
  </main>
}
