import Link from 'next/link'
import type { ReactNode } from 'react'
import BoxRanking from './BoxRanking'
import type { BoxRankRow } from '@/lib/box-ranking'

export interface HomeMarketItem { id: string; href: string; name: string; rarity: string; mid: number; image: ReactNode; sales?: number; onSale?: number | null; change?: number }
export default function HomeMarketPanels({ sales, surge, drop, boxes, rankingHref, deals }: { sales: HomeMarketItem[]; surge: HomeMarketItem[]; drop: HomeMarketItem[]; boxes: BoxRankRow[]; rankingHref: string; deals?: ReactNode }) {
  return <>
    <section className="home-panel home-sales-panel">
      <div className="home-panel-head"><div><span>BEST SELLERS</span><h2>いま売れているカード</h2></div><Link prefetch={false} href={rankingHref}>売れ筋ランキング →</Link></div>
      <div className="home-sales-grid">{sales.slice(0,5).map((p,i) => <Link prefetch={false} key={p.id} href={p.href} className="home-sales-card">
        <span className="home-sales-rank">{i+1}</span>{p.image}<span className="home-sales-copy"><strong>{p.name}</strong><small>{p.rarity} · ¥{Math.round(p.mid).toLocaleString()}</small><b>7日間 {p.sales}件成約</b><small>出品 {p.onSale == null ? '—' : p.onSale.toLocaleString() + '件'}</small></span>
      </Link>)}</div>{!sales.length && <p className="source-note">成約データを集計中です。</p>}
    </section>
    {deals}
    <div className="home-dashboard-grid">
      <section className="home-panel"><div className="home-panel-head"><div><span>MARKET MOVES</span><h2>今日の値動き</h2></div><Link prefetch={false} href={rankingHref + '?tab=movers'}>値動きランキング →</Link></div>
        <div className="rank-cols home-rank-cols">{[{ rows: surge, tone: 'is-up', label: '▲ 急騰' },{ rows: drop, tone: 'is-down', label: '▼ 急落' }].map(g => <div key={g.tone}><div className={'home-rank-label ' + g.tone}>{g.label}</div>{g.rows.slice(0,3).map(p => <Link prefetch={false} key={p.id} href={p.href} className="home-market-row">{p.image}<span><strong>{p.name}</strong><small>{p.rarity} · ¥{Math.round(p.mid).toLocaleString()}</small></span><em className={g.tone}>{(p.change ?? 0) > 0 ? '+' : ''}{p.change?.toFixed(1)}%</em></Link>)}{!g.rows.length && <p className="source-note">データ不足</p>}</div>)}</div>
      </section>
      <section className="home-panel"><div className="home-panel-head"><div><span>SEALED BOX</span><h2>未開封BOX</h2></div><Link prefetch={false} href={rankingHref + '?tab=boxes'}>すべて見る →</Link></div><BoxRanking rows={boxes.slice(0,3)} />{!boxes.length && <p className="source-note">データ不足</p>}</section>
    </div>
  </>
}
