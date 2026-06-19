import { getAllCards, getCardSlug } from '@/lib/data'

export function GET() {
  const cards = getAllCards()
  const slugs = cards.map((c) => ({ id: c.id, slug: getCardSlug(c), name: c.card_name }))
  return Response.json({ count: cards.length, slugs })
}
