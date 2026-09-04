import type { Metadata } from 'next'
import OnePieceHome from '@/components/OnePieceHome'
export const metadata: Metadata = { title: 'ONE PIECE 高額カード相場' }
export default function Page() { return <OnePieceHome kind="card" /> }
