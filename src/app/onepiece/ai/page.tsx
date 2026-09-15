import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import ScreenerTable from '@/components/ScreenerTable'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
import { marketCardHref } from '@/lib/market-links'
export const metadata = { title: 'ONE PIECE AI相場予想' }
export default function Page() {
  const { rows, sets, index7d } = buildOnePieceMarket()
  const forecastRows = rows.filter(r => r.upPct != null)
  const candidates = forecastRows.filter(r => (r.upsidePct ?? 0) > 0).sort((a, b) => b.upsidePct! - a.upsidePct!).slice(0, 5)
  return <main className="wrap"><SiteHeader /><h1>ONE PIECE AI予想</h1>
    <p className="source-note">スニダンの実成約価格・取引件数・価格推移をもとに、1・3・6か月後の相場を分析します。<Link href="/onepiece/accuracy">的中実績を見る →</Link></p>
    <section className="home-panel"><h2>AIが上昇を予想する候補</h2>{candidates.map(r => <Link className="home-market-row" key={r.id} href={marketCardHref(r.id)}><span><strong>{r.name}</strong><small>{r.boxName} · ¥{r.mid.toLocaleString()}</small></span><em className="is-up">3か月後 +{r.upsidePct!.toFixed(1)}%</em></Link>)}{!candidates.length && <p>予想を準備中です。</p>}</section>
    <ScreenerTable rows={forecastRows} boxes={sets.map(s => ({ box_id: s.id, box_name: s.name }))} rarities={[...new Set(forecastRows.map(r => r.rarity))]} index7d={index7d} />
    <p className="source-note">相場データが不足している商品は生成対象外です。AI予想は将来の価格を保証しません。</p>
  </main>
}
