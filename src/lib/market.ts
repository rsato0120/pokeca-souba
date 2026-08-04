import { getPredictionLog } from '@/lib/data'
import type { PriceRecord } from '@/types/pokeca'

// 画面に出す代表値。トップ/BOXページの既存計算と同じ (low+high)/2 に揃える。
// ここを avg 基準に変えると表示価格が一斉にずれるので変えないこと。
export function midOf(r: Pick<PriceRecord, 'low' | 'high'>): number {
  return (Number(r.low) + Number(r.high)) / 2
}

// スパークライン用の系列。records は新しい順なので、直近 points 点を古い順にして返す。
//
// 日付軸ではなく「直近N点」の折れ線であることに注意（欠測日は詰まる）。
// 薄商いのカードは記録が飛ぶので日付軸にすると点が偏って読めなくなる。
// 形だけ見せる用途なので詰める方を採った。
export function sparkSeries(records: PriceRecord[], points = 7): number[] {
  return records
    .slice(0, points)
    .map(midOf)
    .filter((v) => v > 0)
    .reverse()
}

export function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// 1つ前のAI予想（up_pct）。
//
// ⚠ 「今日より前の記録」で引いてはいけない。data/predictions の先頭は
//   **いま画面に出ている予想そのもの**（日次バッチが予想を作った直後に記録するため）で、
//   その日付は今日とは限らない（バッチは前日の夜に走っていることもある）。
//   暦の今日を基準にすると先頭＝現行値を「前回」として拾い、変動が常に0になる。
//   なので基準は暦ではなく「先頭より1つ古い記録」にする。
export function prevUpPct(cardId: string): number | null {
  const log = getPredictionLog(cardId)
  const recs = log?.predictions ?? []      // 新しい順
  if (recs.length < 2) return null
  const latestDate = recs[0].date
  return recs.find((p) => p.date < latestDate)?.up_pct ?? null
}

// 順位表: up_pct の降順に並べて 1 始まりの順位を振る。
// 同値が多い（決定論スプレッド前の生値など）場合に順位が飛ばないよう、
// 同値は同順位にして次を詰める（1,1,3 ではなく 1,1,2）。
export function rankByUpPct(entries: { id: string; up: number }[]): Record<string, number> {
  const sorted = [...entries].sort((a, b) => b.up - a.up || a.id.localeCompare(b.id))
  const rank: Record<string, number> = {}
  let r = 0
  let prev: number | null = null
  for (const e of sorted) {
    if (prev == null || e.up !== prev) r += 1
    rank[e.id] = r
    prev = e.up
  }
  return rank
}
