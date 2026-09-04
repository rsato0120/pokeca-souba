import type { Metadata } from 'next'
import OnePieceHome from '@/components/OnePieceHome'
export const metadata: Metadata = { title: 'ONE PIECEカード・BOX相場', description: 'OP-13〜OP-17の高額カードと未開封BOXのスニダン成約相場・価格推移。' }
export default function Page() { return <OnePieceHome /> }
