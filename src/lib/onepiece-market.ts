import { getOnePieceCatalog, getOnePiecePrices, getOnePieceForecast, onePieceRarity, onePieceShortName } from './onepiece'
import { onePieceMarketId } from './market-links'
import { buildOnePieceRanking } from './onepiece-ranking'
import { computeObservedExtremes } from './psa10-extremes'
import { chainLink, indexChangePct, type MarketIndex } from './index-series'
import type { ScreenerRow } from '../components/ScreenerTable'
import type { OnePiecePrices } from '../types/onepiece'
import type { IndexWire } from '../components/MarketIndexChart'
import type { PriceMatrix } from './vote-score'
import { WINDOW_DAYS } from './vote-score'

export function onePieceRawExtremes(prices: OnePiecePrices | null) {
  return prices ? computeObservedExtremes(prices.history, prices.raw_archived_extremes, r => r.avg) : null
}

export function buildOnePieceMarket() {
  const { products, sets } = getOnePieceCatalog()
  const observations = Object.fromEntries(products.map(p => [p.id, getOnePiecePrices(p.id)]))
  const ranking = buildOnePieceRanking(products, observations)
  const ranks = new Map(ranking.rows.map(r => [r.id, r]))
  const rows: ScreenerRow[] = products.map(p => {
    const data = observations[p.id], latest = data?.history[0], rank = ranks.get(p.id)
    const ex = onePieceRawExtremes(data), forecast = getOnePieceForecast(p.id)
    const mid = latest?.avg ?? 0, pf = forecast?.price_forecast
    return { id: onePieceMarketId(p.id), name: onePieceShortName(p.name), rarity: onePieceRarity(p), boxId: p.set_id,
      boxName: sets.find(s => s.id === p.set_id)?.name ?? p.set_id, image: p.image_url, mid,
      dayChange: rank?.day ?? null, weekChange: rank?.week ?? null, onSale: latest?.on_sale ?? null,
      upPct: forecast?.overall.up_pct ?? null, upsidePct: pf && mid > 0 ? ((pf.m3_low + pf.m3_high) / 2 / mid - 1) * 100 : null,
      psa10: data?.psa10_history?.[0]?.psa10 ?? null,
      offHigh: ex && mid > 0 ? Math.max(0, (1 - mid / ex.high.value) * 100) : null,
      rangePos: ex && mid > 0 && ex.high.value > ex.low.value ? Math.max(0, Math.min(100, (mid - ex.low.value) / (ex.high.value - ex.low.value) * 100)) : null }
  })
  const indexMembers = products.filter(p => p.kind === 'card' && observations[p.id]?.history.length)
  const series = chainLink(indexMembers.map(p => new Map(observations[p.id]!.history.filter(r => (r.avg ?? 0) > 0).map(r => [r.date, { value: r.avg!, source: r.source }]))))
  const index: MarketIndex = { key: 'onepiece', label: 'ONE PIECE 相場指数', members: indexMembers.length, series }
  const indices: IndexWire[] = series.length > 1 ? [{ key: index.key, label: index.label, members: index.members, points: series.map(p => [p.date, p.value]) }] : []
  const baseDate = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const matrix: PriceMatrix = {}
  for (const product of products) {
    const values: (number | null)[] = new Array(WINDOW_DAYS + 3).fill(null)
    for (const r of observations[product.id]?.history ?? []) {
      const offset = Math.round((Date.parse(baseDate) - Date.parse(r.date)) / 86400000)
      if (offset >= 0 && offset < values.length && (r.avg ?? 0) > 0) values[offset] = r.avg!
    }
    matrix[onePieceMarketId(product.id)] = values
  }
  return { products, sets, observations, ranking, rows, indices, index7d: indexChangePct(index, 7), matrix, baseDate }
}
