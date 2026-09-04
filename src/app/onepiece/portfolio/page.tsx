import SiteHeader from '@/components/SiteHeader'
import PortfolioView, { type PortfolioCardData } from '@/components/PortfolioView'
import { getOnePieceCatalog, getOnePiecePrices, onePieceShortName } from '@/lib/onepiece'

export const metadata = { title: 'ONE PIECE マイコレクション' }
export default function Page() {
  const { products, sets } = getOnePieceCatalog()
  const cards: PortfolioCardData[] = products.map(p => {
    const records = getOnePiecePrices(p.id)?.history ?? []
    const latest = records[0]
    return {
      id: `onepiece:${p.id}`, card_name: onePieceShortName(p.name),
      rarity: p.kind === 'box' ? '未開封BOX' : 'カード', card_no: p.card_no ?? '',
      box_name: sets.find(s => s.id === p.set_id)?.name ?? '', image_url: p.image_url,
      currentLow: latest?.low ?? 0, currentHigh: latest?.high ?? 0, currentMid: latest?.avg ?? 0,
      m3Low: null, m3High: null, psa10Current: null, psa10History: [],
      history: records.slice(0, 90).map(r => ({ date: r.date, mid: r.avg ?? (r.low + r.high) / 2 })).reverse(),
      href: `/onepiece/products/${p.id}`,
    }
  })
  return <main className="wrap"><SiteHeader /><PortfolioView game="onepiece" cards={cards} boxes={sets.map(s => ({ box_id: s.id, box_name: s.name }))} /></main>
}
