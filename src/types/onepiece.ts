import type { PriceRecord, PriceExtremes } from './pokeca'

export interface OnePieceSet {
  id: string
  code: string
  name: string
  release_date: string
  official_url: string
  selection_url: string
}
export interface OnePieceProduct {
  id: string
  set_id: string
  kind: 'card' | 'box'
  name: string
  card_no: string | null
  snkrdunk_id: number
  image_url: string | null
  image_scale?: number
  source_url: string
}
export interface OnePieceCatalog {
  sets: OnePieceSet[]
  products: OnePieceProduct[]
}
export interface OnePiecePrices {
  raw_archived_extremes?: PriceExtremes | null
  psa10_history?: PriceRecord[]
  psa10_sales_by_day?: Record<string, number>
  psa10_archived_extremes?: PriceExtremes | null
  psa10_fetched_at?: string
  product_id: string
  fetched_at: string
  history: PriceRecord[]
  sales_by_day: Record<string, number>
  coverage_start: string | null
  complete: boolean
}
