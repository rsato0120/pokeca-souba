import WatchlistOverview from '@/components/WatchlistOverview'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
export const metadata = { title: 'ONE PIECE ウォッチリスト', robots: { index: false, follow: true } }
export default function Page() { const { rows, index7d } = buildOnePieceMarket(); return <WatchlistOverview rows={rows} index7d={index7d} game="onepiece" /> }
