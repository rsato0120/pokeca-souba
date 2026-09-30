import { computeAccuracy } from '@/lib/accuracy'
import AccuracyOverview from '@/components/AccuracyOverview'
export const metadata = { title: 'AI予想 的中実績', description: 'AI相場予想の的中率・実績を公開しています。' }
export default function Page() { return <AccuracyOverview acc={computeAccuracy()} /> }
