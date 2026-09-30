import BoxCardList from './BoxCardList'
import { getOnePieceCatalog, getOnePieceForecast, getOnePiecePrices, onePieceRarity, onePieceShortName } from '@/lib/onepiece'
export default function OnePieceSetCards({ setId }: { setId: string }) {
 const products=getOnePieceCatalog().products.filter(p=>p.set_id===setId && p.kind==='card')
 return <BoxCardList cardsWithForecast={products.map(p=>({card:{id:'onepiece:'+p.id,card_name:onePieceShortName(p.name),card_no:p.card_no ?? '',rarity:onePieceRarity(p)},href:'/onepiece/products/'+p.id,forecast:getOnePieceForecast(p.id),currentPrice:getOnePiecePrices(p.id)?.history[0]?.avg ?? null}))} sparks={Object.fromEntries(products.map(p=>['onepiece:'+p.id,(getOnePiecePrices(p.id)?.history ?? []).slice(0,14).map(r=>r.avg ?? 0).reverse()]))} />
}
