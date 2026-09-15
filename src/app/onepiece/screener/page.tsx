import SiteHeader from '@/components/SiteHeader'
import ScreenerTable from '@/components/ScreenerTable'
import { buildOnePieceMarket } from '@/lib/onepiece-market'

export const metadata = { title: 'ONE PIECE 詳細検索・スクリーナー' }
export default function Page() {
  const { rows, sets, index7d } = buildOnePieceMarket()
  return <main className="wrap"><SiteHeader /><h1>ONE PIECE 詳細検索</h1>
    <p className="source-note">価格帯・収録弾・値動き・PSA10相場・AI予想で絞り込み、列の見出しで並べ替えできます。☆でウォッチリストに登録できます。</p>
    <ScreenerTable rows={rows} boxes={sets.map(s => ({ box_id: s.id, box_name: s.name }))} rarities={[...new Set(rows.map(r => r.rarity))]} index7d={index7d} />
  </main>
}
