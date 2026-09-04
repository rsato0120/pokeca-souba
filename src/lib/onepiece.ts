import fs from 'node:fs'
import path from 'node:path'
import type { OnePieceCatalog, OnePiecePrices } from '@/types/onepiece'

export function getOnePieceCatalog(): OnePieceCatalog {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/catalog.json'), 'utf8'))
}
export function getOnePiecePrices(id: string): OnePiecePrices | null {
  if (!/^op\d{2}-\d+$/.test(id)) return null
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/onepiece/prices', `${id}.json`), 'utf8'))
  } catch { return null }
}
export function onePieceShortName(name: string): string {
  return name.split('[')[0].trim()
}
export function isOnePiecePriceStale(prices: OnePiecePrices | null): boolean {
  return !!prices?.history[0] && Date.parse(prices.fetched_at) - Date.parse(prices.history[0].date) > 30 * 86400000
}
