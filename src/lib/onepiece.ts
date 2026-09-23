import fs from 'node:fs'
import path from 'node:path'
import type { OnePieceCatalog, OnePiecePrices, OnePieceProduct } from '@/types/onepiece'
import type { Forecast, PredictionLog } from '@/types/pokeca'
export { onePieceShortName } from './onepiece-name'

export function getOnePieceCatalog(): OnePieceCatalog {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/catalog.json'), 'utf8'))
}
export function getOnePiecePrices(id: string): OnePiecePrices | null {
  if (!/^(?:op\d{2}|promo)-\d+$/.test(id)) return null
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/prices', `${id}.json`), 'utf8'))
  } catch { return null }
}
export function onePieceRarity(product: Pick<OnePieceProduct, 'kind' | 'name'>): string {
  if (product.kind === 'box') return 'BOX'
  // ONE PIECE uses suffixes to distinguish parallel variants (for example
  // SR-SPC, SEC-RSP and L-SP). Returning only the base rarity makes different
  // products look identical in rankings and shared images.
  return product.name.match(/\b(?:SEC|SR|R|UC|C|L|P)(?:-(?:RSP|GSP|SPC|SP|P))?\b/)?.[0] ?? 'カード'
}
export function isOnePiecePriceStale(prices: OnePiecePrices | null): boolean {
  return !!prices?.history[0] && Date.parse(prices.fetched_at) - Date.parse(prices.history[0].date) > 30 * 86400000
}

export function getOnePieceForecast(id: string): Forecast | null {
  if (!/^(?:op\d{2}|promo)-\d+$/.test(id)) return null
  try {
    const forecast: Forecast = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/forecasts', `${id}.json`), 'utf8'))
    const current = getOnePiecePrices(id)?.history[0]
    if (current) {
      forecast.price_forecast.current_low = current.low
      forecast.price_forecast.current_high = current.high
    }
    return forecast
  } catch { return null }
}

export function getOnePiecePredictionLog(id: string): PredictionLog | null {
  if (!/^(?:op\d{2}|promo)-\d+$/.test(id)) return null
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/predictions', `${id}.json`), 'utf8')) }
  catch { return null }
}
