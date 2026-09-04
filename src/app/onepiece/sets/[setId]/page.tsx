import { notFound } from 'next/navigation'
import OnePieceHome from '@/components/OnePieceHome'
import { getOnePieceCatalog } from '@/lib/onepiece'
export const dynamicParams = false
export function generateStaticParams() { return getOnePieceCatalog().sets.map(s => ({ setId: s.id })) }
export async function generateMetadata({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return { title: `${getOnePieceCatalog().sets.find(s => s.id === setId)?.name ?? '収録弾'} — ONE PIECE相場` }
}
export default async function Page({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  if (!getOnePieceCatalog().sets.some(s => s.id === setId)) notFound()
  return <OnePieceHome setId={setId} />
}
