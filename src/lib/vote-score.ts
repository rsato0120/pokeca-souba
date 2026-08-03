import { isHit, type Stance } from './stance'

// 「みんなの予想」の的中判定。UIから切り離してあるのは、採点の基準（期間・許容日数・
// 横ばいの幅）がランキングの見え方をそのまま決めるので、1箇所で読めるようにするため。
//
// 設計上の判断:
//  - 投票時の相場を**票の側に保存しない**。クライアントが送った値を信用すると
//    「安く投票したことにする」改竄が成立するし、そもそもサイトが持っている価格履歴
//    （data/prices/*.json）の方が正確。票からは日付だけを使い、価格は自前の履歴を引く。
//  - 判定は**投票から7日後**の固定ホライズンで統一する。「投票日〜今日」で測ると
//    古い票ほど有利／不利になり、的中率が票の古さで歪む。日数と的中の式は
//    AI予想の的中実績（src/lib/accuracy.ts の HORIZONS[0]=7 / FLAT_THRESHOLD=10）に合わせてある。
//    AIと人の的中率を同じ土俵で並べるのがこの機能の主眼なので、片方だけ基準を動かさないこと。
//  - 欠測日があるので、目標日から数日ぶんは手前に遡って探す（スクレイプはスキップが出る）。

/** 投票日から何日後の値動きで採点するか */
export const HORIZON_DAYS = 7
/** ランキングに含める票の新しさの上限（これより古い票は対象外＝ローリング集計） */
export const WINDOW_DAYS = 30
/** 価格の欠測を許す日数。目標日にレコードが無ければこの日数だけ手前に遡る */
const TOLERANCE_DAYS = 2
/** これ未満の採点済み予想しかない人はランキングに出さない（1勝0敗で100%を防ぐ） */
export const MIN_SCORED = 3

/**
 * カードごとの「N日前の代表値」を詰めた密な配列。index が日数（0=基準日/今日）。
 * 欠測日は null。ページに焼くデータ量を抑えるため日付文字列は持たせない。
 */
export type PriceMatrix = Record<string, (number | null)[]>

export interface RawVote {
  card_id: string
  user_id: string
  stance: Stance
  /** 票が最後に更新された時刻。投票し直しで created_at は動かないのでこちらを使う */
  updated_at: string
}

export interface ScoredUser {
  userId: string
  hits: number
  scored: number
  accuracyPct: number
}

/** 目標 index の価格を、欠測なら手前に遡って探す */
function priceAt(series: (number | null)[], index: number): number | null {
  if (index < 0) return null
  for (let i = index; i <= index + TOLERANCE_DAYS && i < series.length; i++) {
    const v = series[i]
    if (v != null && v > 0) return v
  }
  return null
}

/** 基準日（JSTのYYYY-MM-DD）から見て、その日付が何日前かを返す */
export function daysAgo(baseDate: string, iso: string): number {
  const base = Date.parse(`${baseDate}T00:00:00+09:00`)
  // 票の時刻はUTC。JSTの暦日に落としてから日数差を取る
  const voted = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000)
  const votedDay = Date.parse(`${voted.toISOString().slice(0, 10)}T00:00:00+09:00`)
  return Math.round((base - votedDay) / (24 * 60 * 60 * 1000))
}

/**
 * 1票を採点する。採点できない（新しすぎる/古すぎる/価格が無い）票は null。
 */
export function scoreVote(vote: RawVote, prices: PriceMatrix, baseDate: string): boolean | null {
  const age = daysAgo(baseDate, vote.updated_at)
  // 7日経っていない票はまだ結果が出ていない。WINDOW_DAYS より古い票は対象外
  if (age < HORIZON_DAYS || age > WINDOW_DAYS) return null

  const series = prices[vote.card_id]
  if (!series) return null

  const atVote = priceAt(series, age)
  const atHorizon = priceAt(series, age - HORIZON_DAYS)
  if (atVote == null || atHorizon == null) return null

  const changePct = ((atHorizon - atVote) / atVote) * 100
  return isHit(vote.stance, changePct)
}

/** 票の集合をユーザー単位の的中率に畳む。的中率降順→予想数降順で並べて返す */
export function rankUsers(votes: RawVote[], prices: PriceMatrix, baseDate: string): ScoredUser[] {
  const byUser = new Map<string, { hits: number; scored: number }>()

  for (const vote of votes) {
    const hit = scoreVote(vote, prices, baseDate)
    if (hit == null) continue
    const acc = byUser.get(vote.user_id) ?? { hits: 0, scored: 0 }
    acc.scored++
    if (hit) acc.hits++
    byUser.set(vote.user_id, acc)
  }

  return [...byUser.entries()]
    .filter(([, v]) => v.scored >= MIN_SCORED)
    .map(([userId, v]) => ({
      userId,
      hits: v.hits,
      scored: v.scored,
      accuracyPct: Math.round((v.hits / v.scored) * 100),
    }))
    // 的中率が同じなら予想数が多い方を上に（少数当てのまぐれを上位に置かない）
    .sort((a, b) => b.accuracyPct - a.accuracyPct || b.scored - a.scored)
}
