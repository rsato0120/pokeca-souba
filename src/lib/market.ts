import { getPredictionLog } from '@/lib/data'
import { midOf } from '@/lib/extremes'
import type { PriceRecord } from '@/types/pokeca'

// 画面に出す代表値。**実装は src/lib/extremes.ts の1本だけ**にして、ここは再輸出する。
//
// ⚠ 2026-08-28 まで、ここは (low+high)/2、extremes.ts は avg優先 と**2つに割れていた**。
//   low/high は成約の20/80パーセンタイル帯で、avg はその区間の刈り込み平均なので
//   メルカリ由来のレコードでは一致しない（スニダン由来は low/high を avg×0.9/×1.1 で
//   合成しているのでたまたま一致していた）。結果、同じカードで
//     トップ・スクリーナー・ウォッチリスト … 帯の中点
//     カード詳細の現在価格・極値・買い候補   … avg
//   と違う金額が出ていた。実測で **avgを持つ526枚中280枚(53%)が1%以上ズレ**、
//   最大26.7%（リーフィアVMAX SA: avg¥61,694 vs 帯中点¥45,245）。
//   レックウザVMAX SA では トップ¥600,150 / 詳細¥666,742 と11%食い違っていた。
//
//   採るのは avg。スクレイパーが代表値として算出し guardPrice が検証しているのは avg で、
//   予想の current_low/high もそこから作られている。帯の中点は「表示用の帯」の副産物にすぎない。
export { midOf }

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
