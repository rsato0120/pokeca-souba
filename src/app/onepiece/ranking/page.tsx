import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import GameTabs from '@/components/GameTabs'
import OnePieceRankings from '@/components/OnePieceRankings'
import { getOnePieceCatalog, getOnePiecePrices } from '@/lib/onepiece'
import { buildOnePieceRanking } from '@/lib/onepiece-ranking'

export const metadata: Metadata = {
  title: 'ONE PIECEランキング — 売れ筋・値動き・BOX',
  description: 'ONE PIECEカードの売れ筋、値上がり、値下がり、高額カード、未開封BOXを実成約データで比較。収録弾や期間で絞り込めます。',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const { products, sets } = getOnePieceCatalog()
  const { rows, baseDate } = buildOnePieceRanking(products, Object.fromEntries(products.map(p => [p.id, getOnePiecePrices(p.id)])))
  return <main className="wrap home-wrap">
    <SiteHeader /><GameTabs game="onepiece" />
    <section className="home-panel" style={{ marginTop: 'var(--sp-5)' }}>
      <div className="home-panel-head"><div><span>MARKET RANKING</span><h1 style={{ fontSize: 'clamp(18px, 3vw, 26px)', lineHeight: 1.4, margin: '8px 0' }}>ONE PIECE ランキング</h1></div><Link href="/onepiece/cards">カード一覧 →</Link></div>
      <p className="source-note">売れているカードと相場の動きを、実際の成約から。{baseDate ? `集計基準日 ${baseDate}` : 'データを集計中です。'}</p>
      <OnePieceRankings key={tab ?? 'sales'} rows={rows} sets={sets} initialTab={tab} />
    </section>
    <p className="disclaimer">掲載商品の取得範囲内のランキングです。カードは状態A、BOXは1箱単価。成約件数は市場全体の取引数ではありません。相場は各記録日までの成約平均で、30日を超える古い価格は対象外です。</p>
  </main>
}
