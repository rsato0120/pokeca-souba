export type Certainty = 'released' | 'announced' | 'rumored'
export type Rotation = 'soon' | 'upcoming' | 'far' | 'unknown'
export type CompetitiveUsage = 'high' | 'mid' | 'low' | 'none'
export type IllustratorPopularity = 'high' | 'mid' | 'unknown'
export type ArtworkType = 'original' | 'reused' | 'unknown'
export type ReprintStatus = 'none' | 'reprinted' | 'reprint_planned'
export type Scarcity = 'normal' | 'scarce' | 'out_of_print'
export type CharacterPopularity = 'high' | 'mid' | 'unknown'
export type Trend = 'up' | 'flat' | 'down'

export interface Box {
  box_id: string
  box_name: string
  code: string
  release_ym: string
  certainty: Certainty
  pack_price_yen: number
  packs_per_box?: number
  pack_image_url?: string
  note: string
}

export interface CardSpec {
  type: string
  stage: string
  hp: number
  note: string
}

export interface PlayerMaterials {
  regulation_mark: string
  rotation: Rotation
  competitive_usage: CompetitiveUsage
}

export interface CollectorMaterials {
  illustrator: string
  illustrator_popularity: IllustratorPopularity
  artwork_type: ArtworkType
  rarity: string
}

export interface CommonMaterials {
  reprint_status: ReprintStatus
  scarcity: Scarcity
  character_popularity: CharacterPopularity
}

export interface CardMaterials {
  player: PlayerMaterials
  collector: CollectorMaterials
  common: CommonMaterials
}

export interface EvidenceNotes {
  player: string
  collector: string
  source: string
}

export interface Card {
  id: string
  card_no: string
  rarity: string
  card_name: string
  box_id: string
  is_reprint: boolean
  image_url?: string
  card_spec: CardSpec
  materials: CardMaterials
  evidence_notes: EvidenceNotes
  note: string
}

export interface PokeData {
  boxes: Box[]
  cards: Card[]
}

export interface PriceRecord {
  date: string  // "2026-06-20"
  low: number
  high: number
  avg?: number          // メルカリ成約平均価格（sold_out・結果指標）
  on_sale?: number      // メルカリ出品中件数（供給圧）
  ask_low?: number      // 出品中の最安値帯（即購入できる床値・先行指標）
  ask_mid?: number      // 出品中の中央値
  psa10?: number | null // スニーカーダンク PSA10平均価格（null = 取引なし）
}

export interface PriceHistory {
  card_id: string
  history: PriceRecord[]
}

export interface ViewForecast {
  trend: Trend
  probability: number
  reason: string
}

export interface PriceForecast {
  current_low: number
  current_high: number
  m1_low: number    // 1ヶ月後 本線
  m1_high: number
  m3_low: number    // 3ヶ月後 本線
  m3_high: number
  m6_low: number    // 6ヶ月後 本線
  m6_high: number
  up_low: number    // 6ヶ月後 上振れ
  up_high: number
  down_low: number  // 6ヶ月後 下振れ
  down_high: number
}

export interface Forecast {
  card_no: string
  rarity: string
  generated_at: string
  player_view: ViewForecast
  collector_view: ViewForecast
  overall: {
    up_pct: number
    flat_pct: number
    down_pct: number
    reason: string
  }
  price_forecast: PriceForecast
  disclaimer: string
}
