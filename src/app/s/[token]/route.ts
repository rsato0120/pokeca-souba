import { getAllCards } from '@/lib/data'
import { cardShareToken } from '@/lib/share-links'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const card = /^[a-f0-9]{12}$/.test(token) ? getAllCards().find(card => cardShareToken(card.id) === token) : null
  if (!card) return new Response('リンクが見つかりません', { status: 404 })
  return Response.redirect(`https://pokeca-souba.vercel.app/cards/${card.id}`, 302)
}
