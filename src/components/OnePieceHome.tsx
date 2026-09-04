import Link from 'next/link'
import SiteHeader from './SiteHeader'
import GameTabs from './GameTabs'
import OnePieceCatalog from './OnePieceCatalog'
import { getOnePieceCatalog, getOnePiecePrices, isOnePiecePriceStale } from '@/lib/onepiece'

export default function OnePieceHome({ kind = 'all', setId = '' }: { kind?: 'all' | 'card' | 'box'; setId?: string }) {
  const { sets, products } = getOnePieceCatalog()
  const listings = products.map(p => { const prices = getOnePiecePrices(p.id); const price = prices?.history[0]; return {
    ...p, avg: price?.avg ?? null, date: price?.date ?? null, count: price?.sample_count ?? null,
    stale: isOnePiecePriceStale(prices),
  } })
  const set = sets.find(s => s.id === setId)
  const lastDate = listings.flatMap(p => p.date ? [p.date] : []).sort().at(-1)
  return <main className="wrap op-page">
    <SiteHeader /><GameTabs game="onepiece" />
    <section className="home-hero" aria-labelledby="onepiece-title">
      <p id="onepiece-title">{set ? `${set.name}の相場を、すばやく確認` : kind === 'box' ? 'ONE PIECEのBOX相場を、すばやく確認' : 'ONE PIECEカードの相場を、すばやく確認'}</p>
      {set && <p className="op-muted">{set.code} · {set.release_date}発売 <a href={set.official_url} target="_blank" rel="noreferrer">公式商品情報 ↗</a></p>}
    </section>
    <div className="op-section-heading"><h2>収録弾から探す</h2><span className="op-muted">最新成約日 {lastDate ?? '取得待ち'}</span></div>
    <div className="op-set-grid">{sets.map(s => {
      const box = listings.find(p => p.set_id === s.id && p.kind === 'box')
      return <Link href={`/onepiece/sets/${s.id}`} className="op-set-card" key={s.id} aria-current={setId === s.id ? 'page' : undefined}>
        <span className="op-eyebrow">{s.code} <span>{s.release_date.replaceAll('-', '.')}</span></span><h3>{s.name}</h3>
        <span className="op-muted">未開封BOX</span><strong>{box?.avg == null ? 'データ不足' : `¥${box.avg.toLocaleString('ja-JP')}`}</strong>
      </Link>
    })}</div>
    <div className="op-section-heading"><h2>{set ? `${set.name}の商品` : 'カード・BOX一覧'}</h2></div>
    <OnePieceCatalog key={`${kind}-${setId}`} products={listings} sets={sets} initialKind={kind} initialSet={setId} />
    <p className="op-footnote">対象は通常ブースターOP-13〜OP-17の高額カードを中心とした選抜商品です。相場は各記録日までの30日以内の成約から、新しい日順に20件を目安に集計した平均（最低3件）。取引がない日は新しい価格を作りません。</p>
  </main>
}
