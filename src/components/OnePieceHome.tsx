import HomeDeals from './HomeDeals'
import { getOnePieceDetailBargains } from '@/lib/detail-bargains'
import VisitorStrip from './VisitorStrip'
import OripaBanner from './OripaBanner'
import HomeMarketPanels from './HomeMarketPanels'
import MarketPulse from './MarketPulse'
import { computeMarketTemp } from '@/lib/market-temp'
import { onePieceBoxRows } from '@/lib/onepiece-box-ranking'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
import { getOnePieceForecast } from '@/lib/onepiece'
import Link from 'next/link'
import { buildOnePieceRanking } from '@/lib/onepiece-ranking'
import SiteHeader from './SiteHeader'
import GameTabs from './GameTabs'
import SearchBar from './SearchBar'
import BoxSelector from './BoxSelector'
import UpdateClock from './UpdateClock'
import OnePieceCatalog from './OnePieceCatalog'
import OnePieceImage from './OnePieceImage'
import { getOnePieceCatalog, getOnePiecePrices, isOnePiecePriceStale, onePieceShortName, onePieceRarity } from '@/lib/onepiece'

export default function OnePieceHome({ kind = 'all', setId = '' }: { kind?: 'all' | 'card' | 'box'; setId?: string }) {
  const { sets, products } = getOnePieceCatalog()
  const market = buildOnePieceMarket()
  const observations = new Map(products.map(p => [p.id, getOnePiecePrices(p.id)]))
  const listings = products.map(p => {
    const prices = observations.get(p.id) ?? null
    const price = prices?.history[0]
    return { ...p, avg: price?.avg ?? null, date: price?.date ?? null, count: price?.sample_count ?? null, stale: isOnePiecePriceStale(prices) }
  })
  const set = sets.find(s => s.id === setId)
  const isHome = kind === 'all' && !setId
  const fetchedAt = [...observations.values()].flatMap(p => p ? [p.fetched_at] : []).sort().at(-1)
  const updatedLabel = fetchedAt ? new Date(fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
  const ranking = buildOnePieceRanking(products, Object.fromEntries(observations))
  const forecasts = products.filter(p => p.kind === 'card').flatMap(p => { const f = getOnePieceForecast(p.id); return f ? [f.overall] : [] })
  const pulse = { advancers: ranking.rows.filter(p => p.kind === 'card' && (p.day ?? p.week ?? 0) > 0).length, decliners: ranking.rows.filter(p => p.kind === 'card' && (p.day ?? p.week ?? 0) < 0).length,
    bullish: forecasts.filter(f => f.up_pct > f.down_pct).length, bearish: forecasts.filter(f => f.up_pct < f.down_pct).length, indexWeekPct: market.index7d }
  const latestIndex = market.index.series.at(-1)
  const salesLeaders = ranking.rows.filter(p => p.kind === 'card' && p.sales7d > 0)
    .sort((a, b) => b.sales7d - a.sales7d || a.id.localeCompare(b.id)).slice(0, 5).map(p => ({ ...p, sales: p.sales7d }))
  const moves = ranking.rows.filter(p => p.kind === 'card' && (p.day ?? p.week) != null).map(p => ({ ...p, change: (p.day ?? p.week)! }))
  const surge = moves.filter(p => p.change > 0).sort((a, b) => b.change - a.change).slice(0, 3)
  const drop = moves.filter(p => p.change < 0).sort((a, b) => a.change - b.change).slice(0, 3)
  const boxes = onePieceBoxRows(ranking.rows, sets, Object.fromEntries(observations))
  const item = (p: typeof ranking.rows[number], size: 'sales' | 'move') => ({ id: p.id, href: '/onepiece/products/' + p.id, name: onePieceShortName(p.name), rarity: onePieceRarity(p), mid: p.avg, sales: p.sales7d, onSale: observations.get(p.id)?.history[0]?.on_sale ?? null, change: p.day ?? p.week ?? undefined, image: <OnePieceImage product={p} className={size === 'sales' ? 'home-sales-image-ph' : 'home-thumb-ph'} /> })
  return <main className="wrap home-wrap">
    <SiteHeader /><GameTabs game="onepiece" />
    <section className="home-hero" aria-labelledby="onepiece-title">
      <p id="onepiece-title">{set ? `${set.name}の相場を、すばやく確認` : kind === 'box' ? 'ONE PIECEのBOX相場を、すばやく確認' : 'ONE PIECEカードの相場を、すばやく確認'}</p>
      <SearchBar basePath="/onepiece/products" cards={products.map(p => ({ slug: p.id, card_name: onePieceShortName(p.name), rarity: p.card_no ?? 'BOX', box_name: sets.find(s => s.id === p.set_id)?.name ?? '', up_pct: getOnePieceForecast(p.id)?.overall.up_pct ?? null }))} />
      <BoxSelector basePath="/onepiece/sets" current={setId || undefined} marginTop={12} marginBottom={0} boxes={sets.map(s => ({ box_id: s.id, box_name: s.name, release_ym: s.release_date.slice(0, 7) }))} />
    </section>
    <div className="home-update-row"><UpdateClock updatedLabel={updatedLabel} minute={30} /><span>価格はスニダン実取引から毎日更新</span></div>
    {isHome ? <>
      <div className="home-pulse"><MarketPulse index={latestIndex?.value ?? null} indexDate={latestIndex?.date ?? null} indexDayPct={market.indexDayPct} temp={computeMarketTemp(pulse)} {...pulse} /></div>
      <VisitorStrip portfolioHref="/onepiece/portfolio" storageKey="onepiece-visit-v1" cards={ranking.rows.filter(p=>p.kind==='card').map(p=>({id:'onepiece:'+p.id,href:'/onepiece/products/'+p.id,name:onePieceShortName(p.name),rarity:onePieceRarity(p),mid:p.avg,prevMid:p.day != null ? p.avg/(1+p.day/100) : null,psa10:observations.get(p.id)?.psa10_history?.[0]?.psa10 ?? null,prevPsa10:null,seriesKey:'snkrdunk'}))} />
      <HomeMarketPanels deals={<HomeDeals rankingHref="/onepiece/ranking" rows={products.filter(p=>p.kind==='card').flatMap(p=>getOnePieceDetailBargains(p.id)).sort((a,b)=>b.discountPct-a.discountPct)} />} rankingHref="/onepiece/ranking" sales={salesLeaders.map(p => item(p, 'sales'))} surge={surge.map(p => item(p, 'move'))} drop={drop.map(p => item(p, 'move'))} boxes={boxes} />
      <section className="home-panel home-bargain-panel"><div className="home-panel-head"><div><span>BOX DEALS · PR</span><h2>BOXの相場より安い出品</h2></div></div><p className="home-empty">比較できるBOXの出品情報を集計中です。</p></section>
      <div className="home-pr"><OripaBanner marginY={4} /></div>
    </> : <section className="home-panel" style={{ marginTop: 'var(--sp-5)' }}>
      <div className="home-panel-head"><div><span>{kind === 'box' ? 'SEALED BOX' : 'CARD MARKET'}</span><h2>{set ? `${set.name}の商品` : kind === 'box' ? '未開封BOX一覧' : 'カード一覧'}</h2></div><Link prefetch={false} href="/onepiece">ホーム →</Link></div>
      <OnePieceCatalog key={`${kind}-${setId}`} products={listings} sets={sets} initialKind={kind} initialSet={setId} />
      {set && <p className="source-note"><a href={set.official_url} target="_blank" rel="noreferrer">公式商品情報 ↗</a></p>}
    </section>}
    <p className="disclaimer">掲載商品は選抜したカード・BOX・プロモです。カードは状態A、BOXは1箱単価。相場は各記録日までの30日以内から新しい日順に20件を目安に集計（最低3件）。成約件数は取得範囲内の参考値です。</p>
  </main>
}
