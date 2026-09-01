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
  // avg に採用した成約のうち最も古いものが何日前か（メルカリ由来のみ）。薄商い銘柄では成約が
  // 数ヶ月〜1年に散らばるため、「いつの取引で出した値か」を残さないと古い相場と区別できない
  oldest_sale_days?: number
  on_sale?: number      // メルカリ出品中件数（供給圧）＝除外・番号照合を通した実数
  /** on_sale がページ上限での打ち切り＝下限値であることを示す（画面は「N件以上」と出す） */
  on_sale_capped?: boolean
  ask_low?: number      // 出品中の最安値帯（即購入できる床値・先行指標）
  ask_mid?: number      // 出品中の中央値
  /**
   * ask の出所。avg(source) と違う市場のことがあるので別に持つ。
   * 'snkrdunk' … その商品ページの状態別最安値。曖昧一致が起きないので正確
   * 'mercari'  … 出品検索から番号照合を通して集計したもの
   */
  ask_source?: 'mercari' | 'snkrdunk'
  /** on_sale の出所。'snkrdunk' はその商品固有の実数、'mercari' は出品検索の集計（打ち切りあり） */
  on_sale_source?: 'mercari' | 'snkrdunk'
  psa10?: number | null // スニーカーダンク PSA10平均価格（null = 取引なし）
}

// 全期間の高値・安値。価格履歴は90日ローリングで消えるため、極値だけ別ファイルに積み上げる。
export interface ExtremePoint {
  value: number
  date: string
  source?: PriceSource
  sample_count?: number
}

export interface PriceExtremes {
  high: ExtremePoint
  low: ExtremePoint
  since: string       // 計測開始日（この日より前は分からない）
  records: number     // 極値判定に採用したレコード数
  updated_at: string
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
  // スニダンの売買履歴から数えた**実際の成約件数**（日付 -> 件数）。
  // sold_total（メルカリ numFound）の前日差と違い、個別の取引を数えているので減らないし歯抜けにもならない。
  // ページに載る履歴は十数件〜数十件で打ち切られるため、毎日の観測を日ごとに max で積み上げる
  // （見えなかった日は前の観測が残る／見え方が増えた日は増えた側を採る）。
  /** 成約APIを最後に引いた日（YYYY-MM-DD）。周期実行の判定に使う */
  sales_fetched_at?: string
  sales_by_day?: Record<string, number>        // 素体（状態A〜D）
  psa10_sales_by_day?: Record<string, number>  // PSA10
}

export interface MarketListing {
  id: string
  title: string
  price: number
  url: string
  image_url?: string
}

export interface MarketListingCard {
  card_id: string
  fetched_at: string
  listings: MarketListing[]
}

export interface MarketListings {
  updated_at: string
  base_date: string
  cards: Record<string, MarketListingCard>
}

// 日次バッチの実行スタンプ（scripts/write-update-stamp.ts が書く）。
// kind='full' は価格＋AI予想、'prices' は価格だけ更新した回。
export interface LastUpdate {
  updated_at: string   // ISO8601（UTC）
  kind: 'full' | 'prices'
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

// BOX開封の期待値（data/pull-rates.json）。封入率は公式非公表なので有志の開封統計を出典として持つ。
export type PullConfidence = 'measured' | 'estimated'

export interface PullGroup {
  id: string
  label: string
  rarity: string
  stages?: string[]      // card_spec.stage がこのいずれかならこのグループ
  stages_not?: string[]  // card_spec.stage がこのいずれでもなければこのグループ
  kinds: number          // セット全体の収録種類数（当サイトの掲載枚数ではない）
  per_card: number       // 狙いのカード1枚が1BOXに封入される確率＝1枚あたりのBOX期待枚数
}

export interface BoxPullRates {
  confidence: PullConfidence
  source: string
  source_url?: string
  groups: PullGroup[]
}

// 「AIが買うべきカード」欄の厚い論拠（scripts/generate-buy-theses.ts が Gemini で生成）。
// 選定自体は src/lib/buy-signals.ts が決定論的に行い、上位候補だけこの論拠を持つ。
export type Conviction = 'high' | 'mid' | 'low'

export interface BuyThesis {
  card_id: string
  generated_at: string
  mid: number            // 生成時点の中央値相場（鮮度確認用）
  headline: string       // 一言サマリー（例「絵師人気×品薄で下値が固い押し目」）
  valuation: string      // 割安根拠（現値が値幅のどこか・PSA比 など）
  timing: string         // 買い時根拠（押し目・在庫減・回転 など）
  catalyst: string       // 上昇材料（絶版・キャラ人気・描き下ろし など）
  risk: string           // 下落リスク（再録・供給過多・薄商い など）
  conviction: Conviction // 確信度
}
