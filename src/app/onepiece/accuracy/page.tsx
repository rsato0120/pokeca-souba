import AccuracyOverview from '@/components/AccuracyOverview'
import { computeAccuracy } from '@/lib/accuracy'
import { getOnePieceCatalog, getOnePiecePrices, getOnePiecePredictionLog, onePieceShortName, onePieceRarity } from '@/lib/onepiece'
import { onePieceMarketId } from '@/lib/market-links'
export const metadata = { title: 'ONE PIECE AI予想の的中実績' }
export default function Page() {
 const acc=computeAccuracy(getOnePieceCatalog().products.filter(p=>p.kind==='card').map(p=>({id:onePieceMarketId(p.id),name:onePieceShortName(p.name),rarity:onePieceRarity(p),history:getOnePiecePrices(p.id)?.history ?? [],log:getOnePiecePredictionLog(p.id)})))
 return <AccuracyOverview acc={acc} homeHref="/onepiece" />
}
