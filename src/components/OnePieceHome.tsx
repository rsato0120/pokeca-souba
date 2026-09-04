import Link from 'next/link'
import SiteHeader from './SiteHeader'
import GameTabs from './GameTabs'
import SearchBar from './SearchBar'
import BoxSelector from './BoxSelector'
import UpdateClock from './UpdateClock'
import OnePieceCatalog from './OnePieceCatalog'
import OnePieceImage from './OnePieceImage'
import { getOnePieceCatalog, getOnePiecePrices, isOnePiecePriceStale, onePieceShortName } from '@/lib/onepiece'

export default function OnePieceHome({ kind = 'all', setId = '' }: { kind?: 'all' | 'card' | 'box'; setId?: string }) {
  const { sets, products } = getOnePieceCatalog()
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
  const today = fetchedAt ? new Date(Date.parse(fetchedAt) + 9 * 3600000).toISOString().slice(0, 10) : ''
  const cutoff = Date.parse(today) - 6 * 86400000
  const salesLeaders = listings.filter(p => p.kind === 'card' && p.avg != null && !p.stale).map(p => ({
    ...p, sales: Object.entries(observations.get(p.id)?.sales_by_day ?? {}).reduce((sum, [date, count]) => Date.parse(date) >= cutoff && date <= today ? sum + count : sum, 0),
  })).filter(p => p.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 5)
  const moves = listings.filter(p => p.kind === 'card' && p.date === today).flatMap(p => {
    const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)
    const previous = observations.get(p.id)?.history.find(r => r.date === yesterday)
    return p.avg != null && previous?.avg ? [{ ...p, change: (p.avg / previous.avg - 1) * 100 }] : []
  })
  const surge = moves.filter(p => p.change > 0).sort((a, b) => b.change - a.change).slice(0, 3)
  const drop = moves.filter(p => p.change < 0).sort((a, b) => a.change - b.change).slice(0, 3)
  const boxes = listings.filter(p => p.kind === 'box')
  const yen = (value: number | null) => value == null ? 'データ不足' : `¥${value.toLocaleString('ja-JP')}`
  return <main className="wrap home-wrap">
    <SiteHeader /><GameTabs game="onepiece" />
    <section className="home-hero" aria-labelledby="onepiece-title">
      <p id="onepiece-title">{set ? `${set.name}の相場を、すばやく確認` : kind === 'box' ? 'ONE PIECEのBOX相場を、すばやく確認' : 'ONE PIECEカードの相場を、すばやく確認'}</p>
      <SearchBar basePath="/onepiece/products" cards={products.map(p => ({ slug: p.id, card_name: onePieceShortName(p.name), rarity: p.card_no ?? 'BOX', box_name: sets.find(s => s.id === p.set_id)?.name ?? '', up_pct: null }))} />
      <BoxSelector basePath="/onepiece/sets" current={setId || undefined} marginTop={12} marginBottom={0} boxes={sets.map(s => ({ box_id: s.id, box_name: s.name, release_ym: s.release_date.slice(0, 7) }))} />
    </section>
    <div className="home-update-row"><UpdateClock updatedLabel={updatedLabel} minute={30} /><span>価格はスニダン実取引から毎日更新</span></div>
    {isHome ? <>
      <section className="home-panel home-sales-panel">
        <div className="home-panel-head"><div><span>BEST SELLERS</span><h2>いま売れているカード</h2></div><Link href="/onepiece/cards">カードをすべて見る →</Link></div>
        <div className="home-sales-grid">{salesLeaders.map((p, i) => <Link key={p.id} href={`/onepiece/products/${p.id}`} className="home-sales-card">
          <span className="home-sales-rank">{i + 1}</span><OnePieceImage product={p} className="home-sales-image-ph" />
          <span className="home-sales-copy"><strong>{onePieceShortName(p.name)}</strong><small>{p.card_no} · {yen(p.avg)}</small><b>7日間 {p.sales}件成約</b><small>状態A · {p.date}</small></span>
        </Link>)}</div>
        {!salesLeaders.length && <p className="source-note">直近7日の成約データを集計中です。</p>}
      </section>
      <div className="home-dashboard-grid">
        <section className="home-panel">
          <div className="home-panel-head"><div><span>MARKET MOVES</span><h2>今日の値動き</h2></div><Link href="/onepiece/cards">すべて見る →</Link></div>
          <div className="rank-cols home-rank-cols">{[{ rows: surge, tone: 'is-up', label: '▲ 急騰' }, { rows: drop, tone: 'is-down', label: '▼ 急落' }].map(group => <div key={group.tone}>
            <div className={`home-rank-label ${group.tone}`}>{group.label}</div>
            {group.rows.map(p => <Link key={p.id} className="home-market-row" href={`/onepiece/products/${p.id}`}>
              <OnePieceImage product={p} className="home-thumb-ph" /><span><strong>{onePieceShortName(p.name)}</strong><small>{p.card_no} · {yen(p.avg)}</small></span><em className={group.tone}>{p.change > 0 ? '+' : ''}{p.change.toFixed(1)}%</em>
            </Link>)}
            {!group.rows.length && <p className="source-note">該当する記録がありません。</p>}
          </div>)}</div><p className="source-note">{today}時点。当日と前日の両方に成約相場があるカードを比較。</p>
        </section>
        <section className="home-panel">
          <div className="home-panel-head"><div><span>SEALED BOX</span><h2>未開封BOX</h2></div><Link href="/onepiece/boxes">すべて見る →</Link></div>
          <div className="boxrank">{boxes.map((p, i) => <Link key={p.id} href={`/onepiece/products/${p.id}`} className="boxrank-row">
            <span className="boxrank-no">{i + 1}</span><OnePieceImage product={p} className="boxrank-thumb" />
            <span className="boxrank-main"><span className="boxrank-name">{sets.find(s => s.id === p.set_id)?.name}</span><span className="boxrank-meta">{p.set_id.toUpperCase().replace('OP', 'OP-')} · {p.date ?? '未取得'} · 1箱単価</span></span>
            <span className="boxrank-price"><span className="boxrank-mid">{yen(p.avg)}</span></span>
          </Link>)}</div>
        </section>
      </div>
    </> : <section className="home-panel" style={{ marginTop: 'var(--sp-5)' }}>
      <div className="home-panel-head"><div><span>{kind === 'box' ? 'SEALED BOX' : 'CARD MARKET'}</span><h2>{set ? `${set.name}の商品` : kind === 'box' ? '未開封BOX一覧' : 'カード一覧'}</h2></div><Link href="/onepiece">ホーム →</Link></div>
      <OnePieceCatalog key={`${kind}-${setId}`} products={listings} sets={sets} initialKind={kind} initialSet={setId} />
      {set && <p className="source-note"><a href={set.official_url} target="_blank" rel="noreferrer">公式商品情報 ↗</a></p>}
    </section>}
    <p className="disclaimer">対象はOP-13〜OP-17の選抜商品です。カードは状態A、BOXは1箱単価。相場は各記録日までの30日以内から新しい日順に20件を目安に集計（最低3件）。成約件数は取得範囲内の参考値です。</p>
  </main>
}
