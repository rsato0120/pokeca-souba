import type { PriceRecord } from '@/types/pokeca'

// 出品件数の比較を安全に行うための共通処理。
//
// on_sale の出所は2つある（PriceRecord.on_sale_source）:
//   'snkrdunk' … その商品固有の実数（usedListingCount）。丸めも打ち切りも無い
//   'mercari'  … 出品検索の集計。曖昧一致と3ページ打ち切りがあり、打ち切ると下限値
// 桁がまるごと違う（実測: ブラッキーex SAR はメルカリ71件 / スニダン344件、
// メガリザードンXex MA は189件 / 816件）。
//
// ⚠ **出所の違う2点を引き算してはいけない**。同じカードでも出所が切り替わった日に
//   「+380%」のような偽の増減が出る。価格側でまったく同じ事故を起こしている
//   （出所フリップによる -61% の崖 → guardPrice R2 / R0 で対処済み）。
// ⚠ 打ち切り(on_sale_capped)の値は「N件以上」の下限なので、これも差分に使わない。

export interface OnSalePair {
  now: number
  prev: number
  /** 変化率(%)。減少が負 */
  changePct: number
  source: 'mercari' | 'snkrdunk' | 'unknown'
}

/** 比較に使えるレコードか（件数があり、打ち切りでない） */
function usable(r: PriceRecord | undefined | null): r is PriceRecord {
  return r != null && r.on_sale != null && r.on_sale_capped !== true
}

const srcOf = (r: PriceRecord): 'mercari' | 'snkrdunk' | 'unknown' =>
  r.on_sale_source ?? 'unknown'

/**
 * 直近と、その比較相手（既定は1つ前の観測）から出品数の変化を出す。
 * 出所が違う・打ち切り・件数なし の場合は null（＝「分からない」を返す。0扱いにしない）。
 *
 * @param olderIndex 比較相手の位置。1 = 1つ前の観測
 */
export function onSaleChange(history: PriceRecord[], olderIndex = 1): OnSalePair | null {
  const withSale = history.filter(usable)
  const now = withSale[0]
  const prev = withSale[olderIndex]
  if (!now || !prev) return null
  if (srcOf(now) !== srcOf(prev)) return null   // ★出所が違う2点は引き算しない
  const n = Number(now.on_sale)
  const p = Number(prev.on_sale)
  if (!(p > 0)) return null
  return { now: n, prev: p, changePct: ((n - p) / p) * 100, source: srcOf(now) }
}

/** 指定日数より前の観測を相手にした変化（異変検知の7日窓など） */
export function onSaleChangeOverDays(history: PriceRecord[], days: number): OnSalePair | null {
  const withSale = history.filter(usable)
  const now = withSale[0]
  if (!now) return null
  const cutoff = Date.parse(now.date) - days * 86400000
  const prev = withSale.find(r => Date.parse(r.date) <= cutoff) ?? withSale[withSale.length - 1]
  if (!prev || prev.date === now.date) return null
  if (srcOf(now) !== srcOf(prev)) return null
  const n = Number(now.on_sale)
  const p = Number(prev.on_sale)
  if (!(p > 0)) return null
  return { now: n, prev: p, changePct: ((n - p) / p) * 100, source: srcOf(now) }
}
