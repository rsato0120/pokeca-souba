import MyPageOverview from '@/components/MyPageOverview'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
export const metadata = { title: 'ONE PIECE マイページ', robots: { index: false, follow: true } }
export default function Page() { const { rows, index7d } = buildOnePieceMarket(); return <MyPageOverview rows={rows} index7d={index7d} game="onepiece" /> }
