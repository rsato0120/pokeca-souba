import fs from 'fs'
import path from 'path'
import type { PokeData, Card, Box, Forecast, PriceHistory, PredictionLog, PriceExtremes, PsaPop, BuyThesis, BoxPullRates, LastUpdate, MarketListings } from '@/types/pokeca'

function readPokeData(): PokeData {
  const filePath = path.join(process.cwd(), 'data', 'pokeca_data.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

export function getAllCards(): Card[] {
  return readPokeData().cards
}

export function getAllBoxes(): Box[] {
  return readPokeData().boxes
}

export function getBoxById(box_id: string): Box | undefined {
  return getAllBoxes().find((b) => b.box_id === box_id)
}

// URLスラッグ: card.id フィールド（ASCII-only, kebab-case）を使用
export function getCardSlug(card: Card): string {
  return card.id
}

export function getCardBySlug(slug: string): Card | undefined {
  return getAllCards().find((c) => c.id === slug)
}

export function getForecast(cardId: string): Forecast | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'forecasts', `${cardId}.json`)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    // 旧形式（base_low）は新形式（m1_low）に未対応なのでnullを返しstubにフォールバック
    if (data.price_forecast?.m1_low === undefined) return null
    return data as Forecast
  } catch {
    return null
  }
}

export function getPriceHistory(cardId: string): PriceHistory | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'prices', `${cardId}.json`)
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getMarketListings(): MarketListings | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'market-listings.json')
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MarketListings
  } catch {
    return null
  }
}

export function getPredictionLog(cardId: string): PredictionLog | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'predictions', `${cardId}.json`)
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 全期間の高値・安値（scripts/scrape-prices.ts が更新）。全カード分が1ファイル。
let extremesCache: Record<string, PriceExtremes> | null = null

export function getPriceExtremes(cardId: string): PriceExtremes | null {
  if (extremesCache == null) {
    try {
      const filePath = path.join(process.cwd(), 'data', 'price-extremes.json')
      extremesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      extremesCache = {}
    }
  }
  return extremesCache?.[cardId] ?? null
}

// PSA鑑定枚数（scripts/scrape-psa-pop.ts が生成）。全カード分が1ファイルなので読み込みをキャッシュする。
let psaPopCache: Record<string, PsaPop> | null = null

export function getPsaPop(cardId: string): PsaPop | null {
  if (psaPopCache == null) {
    try {
      const filePath = path.join(process.cwd(), 'data', 'psa-pop.json')
      psaPopCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      psaPopCache = {}
    }
  }
  return psaPopCache?.[cardId] ?? null
}

export function getBoxPriceHistory(boxId: string): PriceHistory | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'prices', `box-${boxId}.json`)
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 変異系列（シュリンクあり/なし、セット商品の地域別など）。
// ファイル名は box-{boxId}-{suffix}.json。無ければ null。
export function getBoxPriceVariant(boxId: string, suffix: string): PriceHistory | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'prices', `box-${boxId}-${suffix}.json`)
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// BOX開封の期待値に使う封入率テーブル。設定のある弾だけ期待値セクションを出す。
let pullRatesCache: Record<string, BoxPullRates> | null = null

export function getPullRates(boxId: string): BoxPullRates | null {
  if (pullRatesCache == null) {
    try {
      const filePath = path.join(process.cwd(), 'data', 'pull-rates.json')
      pullRatesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8')).boxes ?? {}
    } catch {
      pullRatesCache = {}
    }
  }
  return pullRatesCache?.[boxId] ?? null
}

// 日次バッチの実行スタンプ（scripts/write-update-stamp.ts が書く）。
// 無い場合（初回デプロイ・ローカル）は null を返し、画面側は「最終更新」を出さない。
export function getLastUpdate(): LastUpdate | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'last-update.json')
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LastUpdate
  } catch {
    return null
  }
}

// 「AIが買うべきカード」欄の論拠（scripts/generate-buy-theses.ts が生成）。全カード分が1ファイル。
let buyThesesCache: Record<string, BuyThesis> | null = null

export function getBuyTheses(): Record<string, BuyThesis> {
  if (buyThesesCache == null) {
    try {
      const filePath = path.join(process.cwd(), 'data', 'buy-theses.json')
      buyThesesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      buyThesesCache = {}
    }
  }
  return buyThesesCache ?? {}
}
