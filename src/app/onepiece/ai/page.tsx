import AiOverview from '@/components/AiOverview'
import { buildOnePieceMarket } from '@/lib/onepiece-market'
import { onePieceMarketId } from '@/lib/market-links'
import { getOnePieceForecast, getOnePiecePredictionLog, onePieceRarity, onePieceShortName } from '@/lib/onepiece'
import { computeOnePieceScore } from '@/lib/onepiece-score'
import { computeAccuracy } from '@/lib/accuracy'
import { aiVerdict, UP_VERDICT_PCT } from '@/lib/verdict'
export const metadata = { title: 'ONE PIECE AI予想' }
export default function Page() {
  const { products, observations, ranking } = buildOnePieceMarket()
  const cards = products.filter(p => p.kind === 'card')
  const forecastRows = cards.flatMap(p => { const f = getOnePieceForecast(p.id); return f ? [{ slug: onePieceMarketId(p.id), name: onePieceShortName(p.name), rarity: onePieceRarity(p), upPct: f.overall.up_pct, verdict: aiVerdict(f.overall), cur: observations[p.id]?.history[0]?.avg ?? null, m3Low: f.price_forecast.m3_low, m3High: f.price_forecast.m3_high }] : [] }).sort((a,b) => b.upPct-a.upPct).slice(0,60)
  const picks = cards.flatMap(p => { const f=getOnePieceForecast(p.id), data=observations[p.id], score=computeOnePieceScore(data,f), r=ranking.rows.find(r=>r.id===p.id); return f && r && f.overall.up_pct >= UP_VERDICT_PCT ? [{ slug: onePieceMarketId(p.id), name: onePieceShortName(p.name), rarity: onePieceRarity(p), cardNo: p.card_no ?? '', image: p.image_url, mid: r.avg, dayPct: r.day, score: score?.total ?? null, upPct: f.overall.up_pct, m3Low: f.price_forecast.m3_low, m3High: f.price_forecast.m3_high, omens: [], cautions: [], thesis: f.overall.reason }] : [] }).sort((a,b)=>(b.score ?? -1)-(a.score ?? -1)).slice(0,9)
  const accuracy=computeAccuracy(cards.map(p=>({ id:onePieceMarketId(p.id),name:onePieceShortName(p.name),rarity:onePieceRarity(p),history:observations[p.id]?.history ?? [],log:getOnePiecePredictionLog(p.id) })))
  return <AiOverview picks={picks} accuracy={accuracy} forecastRows={forecastRows} accuracyHref="/onepiece/accuracy" />
}
