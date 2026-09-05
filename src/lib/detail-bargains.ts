import type { BargainRow } from '@/components/BargainListings'
import fs from 'fs'
import path from 'path'
import { assessBargain } from './bargains'
import { getAllCards, getCardSlug, getMarketListings, getPriceHistory } from './data'
import { midOf } from './market'

export function getPokemonDetailBargains(cardSlug: string): BargainRow[] {
  const listings = getMarketListings()
  if (!listings) return []
  return getAllCards().flatMap(card => {
    const slug = getCardSlug(card)
    if (slug !== cardSlug) return []
    const latest = getPriceHistory(slug)?.history[0]
    if (!latest || latest.date < listings.base_date) return []
    const marketPrice = Math.round(midOf(latest))
    return (listings.cards[slug]?.listings ?? []).flatMap(listing => {
      const deal = assessBargain(listing.price, marketPrice)
      return deal ? [{
        listingId: listing.id, slug, name: card.card_name, rarity: card.rarity,
        cardImage: card.image_url ?? null, listingImage: listing.image_url ?? null,
        title: listing.title, listingPrice: listing.price, marketPrice,
        savings: deal.savings, discountPct: deal.discountPct, url: listing.url,
      }] : []
    })
  }).sort((a, b) => b.discountPct - a.discountPct || b.savings - a.savings)
}

export function getOnePieceDetailBargains(productId: string): BargainRow[] {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/market-listings.json'), 'utf8')) as { rows: Array<BargainRow & { productId: string }> }
    return data.rows.filter(row => row.productId === productId)
      .sort((a, b) => b.discountPct - a.discountPct || b.savings - a.savings)
  } catch { return [] }
}
