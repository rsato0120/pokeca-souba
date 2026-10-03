import MercariLink from '@/components/MercariLink'
import Link from 'next/link'
import type { BargainRow } from './BargainListings'
import { mercariAffiliateUrl } from '@/lib/bargains'
export default function HomeDeals({ rows, rankingHref }: { rows: BargainRow[]; rankingHref: string }) {
 if (!rows.length) return null
 return <section className="home-panel home-bargain-panel"><div className="home-panel-head"><div><span>MARKET DEALS</span><h2>相場より安い出品</h2></div><Link prefetch={false} href={rankingHref + '?tab=bargains'}>お買い得をもっと見る →</Link></div><div className="home-bargain-grid">{rows.slice(0,5).map(r=><MercariLink key={r.listingId} href={mercariAffiliateUrl(r.url)} target="_blank" rel="sponsored nofollow noreferrer" className="home-bargain-card" aria-label={r.name+'の出品をメルカリで見る'}><span className="home-bargain-info">{r.listingImage || r.cardImage ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={r.listingImage ?? r.cardImage ?? ''} alt="" />) : <span className="home-bargain-image-ph">{r.rarity}</span>}<span><strong>{r.name}</strong><small>相場 ¥{r.marketPrice.toLocaleString()}</small><b>¥{r.listingPrice.toLocaleString()}</b></span></span><div className="home-bargain-foot"><span>{r.discountPct.toFixed(1)}%安い <small>−¥{r.savings.toLocaleString()}</small></span><strong>メルカリで見る →</strong></div></MercariLink>)}</div></section>
}
