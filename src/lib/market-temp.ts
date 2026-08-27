// 市場温度 — SOUBA INDEX の数値を直感で読める形に翻訳する**表示レイヤー**。
//
// ⚠ 指数そのものの計算（src/lib/index-series.ts）には一切触らない。あちらは等ウェイトの
//   連鎖指数で、基準日を100とした水準を出す。「90.37」と言われても市場が熱いのか冷えて
//   いるのかは分からない（基準日から下がっただけで、今日買われているかは別の話）。
//   ここはその読み替えだけを担当する。指数の定義を変えたくなってもこのファイルで完結させること。
//
// 【温度の作り方】0〜100。3つの実測を合成する。**どれもデータで裏が取れる量だけを使う**。
//   ① 騰落レシオ  … 上げた銘柄 / (上げ + 下げ)。今日の需給そのもの。重み 50%
//   ② 指数の7日率 … 市場全体が上向きか。±3% を上下限として正規化。重み 30%
//   ③ AIの強弱   … 強気カード / (強気 + 弱気)。先行きの見立て。重み 20%
//   欠測した指標は重みごと外して残りで正規化する（0扱いにすると全部が「冷え」に倒れる）。

export const TEMP_BANDS = [
  { max: 20, emoji: '🧊', label: '氷河期' },
  { max: 40, emoji: '🥶', label: '冷え' },
  { max: 60, emoji: '😐', label: '普通' },
  { max: 80, emoji: '🔥', label: '活況' },
  { max: 101, emoji: '🚀', label: '過熱' },
] as const

export interface MarketTempInput {
  /** 前日比（無い銘柄は7日比）が プラス / マイナス だった銘柄数 */
  advancers: number
  decliners: number
  /** 指数の7日変化率(%)。取れなければ null */
  indexWeekPct: number | null
  /** AI予想が強気 / 弱気 のカード枚数 */
  bullish: number
  bearish: number
}

export interface MarketTemp {
  /** 0〜100 */
  temp: number
  emoji: string
  label: string
  /** 内訳。画面に「なぜこの温度か」を出すために使う */
  parts: { key: string; label: string; pct: number | null; weight: number }[]
}

/** 0〜1 に丸めた比率。分母が0なら null */
function ratio(a: number, b: number): number | null {
  const t = a + b
  return t > 0 ? a / t : null
}

export function computeMarketTemp(input: MarketTempInput): MarketTemp {
  const advRatio = ratio(input.advancers, input.decliners)
  const bullRatio = ratio(input.bullish, input.bearish)

  // 指数の7日率は ±3% で頭打ちにする。ポケカ市場全体が1週間で3%動けば十分に大きい
  const WEEK_CAP = 3
  const weekNorm =
    input.indexWeekPct == null
      ? null
      : Math.max(0, Math.min(1, (input.indexWeekPct + WEEK_CAP) / (WEEK_CAP * 2)))

  const parts = [
    { key: 'adv', label: '騰落レシオ', pct: advRatio, weight: 0.5 },
    { key: 'week', label: '指数の7日変化', pct: weekNorm, weight: 0.3 },
    { key: 'ai', label: 'AIの強弱', pct: bullRatio, weight: 0.2 },
  ]

  // 欠測は重みごと外す。残りが1つも無ければ「普通(50)」に倒す
  const live = parts.filter((p): p is typeof p & { pct: number } => p.pct != null)
  const wSum = live.reduce((a, p) => a + p.weight, 0)
  const temp = wSum > 0
    ? Math.round(live.reduce((a, p) => a + p.pct * p.weight, 0) / wSum * 100)
    : 50

  const band = TEMP_BANDS.find(b => temp < b.max) ?? TEMP_BANDS[TEMP_BANDS.length - 1]
  return { temp, emoji: band.emoji, label: band.label, parts }
}
