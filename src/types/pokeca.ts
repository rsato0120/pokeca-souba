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

// avg の出所。カードによってメルカリ成約とスニダン素体のどちらを採用するかが
// 取引件数で切り替わる（scripts/scrape-prices.ts の SNKRDUNK_MIN_SAMPLES 参照）ため、
// 画面で「どこの値か」を正しく出せるよう記録する。
export type PriceSource = 'mercari' | 'snkrdunk'

export interface PriceRecord {
  date: string  // "2026-06-20"
  low: number
  high: number
  avg?: number          // 成約平均価格（出所は source を参照）
  source?: PriceSource  // avg の出所（2026-07-18 以降のレコードのみ保持）
  sample_count?: number // avg の算出に使った取引件数（スニダン採用時のみ）
  sold_total?: number   // メルカリ成約済み総件数（累計）。前日との差が「1日に何枚売れたか」＝回転率になる
  on_sale?: number      // メルカリ出品中件数（供給圧）
  ask_low?: number      // 出品中の最安値帯（即購入できる床値・先行指標）
  ask_mid?: number      // 出品中の中央値
  psa10?: number | null // スニーカーダンク PSA10平均価格（null = 取引なし）
}

// PSA鑑定枚数（gemrate経由でPSAのPopulation Reportを集計したもの）。
// psa10 が少ないほど鑑定品の供給が硬く、gem_rate が低いほど10が出にくい＝プレミアが維持されやすい。
export interface PsaPop {
  psa10: number
  total: number      // 総鑑定枚数（全グレード合計）
  gem_rate: number   // PSA10率（0-100）
  parallel: string   // PSA側のレアリティ表記（例: Special Art Rare）。取り違え検証用
  name: string       // PSA側のカード名（英語）
  set_name: string
  fetched_at: string
}

export interface PriceHistory {
  card_id: string
  history: PriceRecord[]
}

// AI予想のスナップショット（的中実績の集計に使う）
export interface PredictionRecord {
  date: string        // 予想を記録した日（JST）
  mid: number         // 予想時点の中央値相場
  up_pct: number
  flat_pct: number
  down_pct: number
}

export interface PredictionLog {
  card_id: string
  predictions: PredictionRecord[]  // 新しい順
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
