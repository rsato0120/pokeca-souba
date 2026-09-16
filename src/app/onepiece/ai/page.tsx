import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import ScreenerTable from '@/components/ScreenerTable'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
import { marketCardHref, onePieceMarketId } from '@/lib/market-links'
import { getOnePieceForecast } from '@/lib/onepiece'
import { computeOnePieceScore } from '@/lib/onepiece-score'
export const metadata = { title: 'ONE PIECE AI投資スコア' }
export default function Page() {
  const { rows, sets, index7d, products, observations } = buildOnePieceMarket()
  const forecastRows = rows.filter(r => r.upPct != null)
  const candidates = products.map(product => {
    const row = rows.find(r => r.id === onePieceMarketId(product.id))
    const score = computeOnePieceScore(observations[product.id], getOnePieceForecast(product.id))
    return row && score ? { row, score: score.total } : null
  }).filter((item): item is NonNullable<typeof item> => item != null).sort((a, b) => b.score - a.score).slice(0, 8)
  return <main className="wrap"><SiteHeader /><h1>ONE PIECE AI投資スコア</h1>
    <p className="source-note">スニダンの実成約価格・価格推移・PSA10相場・AI見通しから、実データがある項目だけで100点満点のスコアを算出します。<Link href="/onepiece/accuracy">的中実績を見る →</Link></p>
    <section className="home-panel"><h2>AI投資スコア上位</h2>{candidates.map(({ row, score }) => <Link className="home-market-row" key={row.id} href={marketCardHref(row.id)}><span><strong>{row.name}</strong><small>{row.boxName} · ¥{row.mid.toLocaleString()}</small></span><em className="is-up">AI投資スコア {score} / 100</em></Link>)}{!candidates.length && <p>スコアを計算できる相場データがありません。</p>}</section>
    <ScreenerTable rows={forecastRows} boxes={sets.map(s => ({ box_id: s.id, box_name: s.name }))} rarities={[...new Set(forecastRows.map(r => r.rarity))]} index7d={index7d} />
    <p className="source-note">相場データが不足している商品は生成対象外です。AI予想は将来の価格を保証しません。</p>
  </main>
}
