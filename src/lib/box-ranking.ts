import type { Box, PriceRecord } from '@/types/pokeca'
import { midOf } from '@/lib/extremes'

// 未開封BOXのランキング。カードのランキングはあるのにBOXには無く、
// 「どの弾が伸びているか」を横並びで見る場所が無かった。
//
// ⚠ 代表値に使う系列の優先順は **シュリンクなし → 混在 → シュリンクあり**。
//   開封目的で買う人が見る値であり、BOX開封期待値(box-ev)も同じ基準を使っている。
//   ここだけ「あり」を優先すると、同じページ内で違うBOX価格が並ぶ。
//
// ⚠ 定価比は「発売時からどれだけ上がったか」ではなく **いまの実勢が定価の何倍か**。
//   絶版弾は桁が違う（タッグボルトは定価¥4,860 に対し実勢¥383,629＝約79倍）ので、
//   倍率で並べると常に古い弾が上位を独占する。並び替えの既定は**7日変化率**にして、
//   「いま動いている弾」が上に来るようにする。定価比は情報として添えるだけ。

const DAY = 24 * 60 * 60 * 1000

export interface BoxRankRow {
  boxId: string
  boxName: string
  code: string
  releaseYm: string
  packImage: string | null
  /** 代表値（シュリンクなし優先） */
  mid: number
  /** どの系列から取ったか */
  variant: 'noshrink' | 'mixed' | 'shrink'
  msrp: number | null
  /** 定価の何%増か。定価が分からなければ null */
  premiumPct: number | null
  /** 7日変化率(%)。比較できる観測が無ければ null */
  weekPct: number | null
  /** 出品件数。**シュリンクあり**の系列から採る（下のコメント参照）。打ち切りなら capped */
  onSale: number | null
  onSaleCapped: boolean
  /** 出品件数をどの系列から採ったか。価格の系列と違うことがあるので明示する */
  onSaleVariant: 'shrink' | 'noshrink' | 'mixed' | null
  latestDate: string
}

export interface BoxRankingInput {
  box: Box
  /** 系列ごとの履歴（新しい順）。無い系列は null */
  noshrink: PriceRecord[] | null
  mixed: PriceRecord[] | null
  shrink: PriceRecord[] | null
}

/**
 * 出品件数は **シュリンクあり** から採る。
 *
 * ⚠ 価格の代表値（シュリンクなし優先）と**わざと系列を変えている**。
 *   シュリンクなしは「開けるために買う人」が見る値なので価格の基準としては正しいが、
 *   在庫の厚みとしては未開封で保管されている「シュリンクあり」の方が意味を持つ。
 *   実測(2026-08-30)でも中身が大きく違う:
 *     アビスアイ      あり  7件 / なし 118件
 *     ストームエメラルダ あり171件 / なし  96件
 *     テラスタルフェスex あり 54件 / なし   5件
 *   どちらを出すかで「品薄に見えるか」が逆転するので、**どの系列の数字かを必ず添える**
 *   （onSaleVariant を返し、画面のラベルに出す）。
 * あり系列に件数が無い弾は なし → 混在 の順に落とす（0件と欠測を混同しない）。
 */
function pickOnSale(
  shrink: PriceRecord[] | null,
  noshrink: PriceRecord[] | null,
  mixed: PriceRecord[] | null,
): Pick<BoxRankRow, 'onSale' | 'onSaleCapped' | 'onSaleVariant'> {
  const order: [PriceRecord[] | null, BoxRankRow['onSaleVariant']][] = [
    [shrink, 'shrink'],
    [noshrink, 'noshrink'],
    [mixed, 'mixed'],
  ]
  for (const [hist, variant] of order) {
    const r = hist?.[0]
    if (r?.on_sale != null) {
      return { onSale: Number(r.on_sale), onSaleCapped: r.on_sale_capped === true, onSaleVariant: variant }
    }
  }
  return { onSale: null, onSaleCapped: false, onSaleVariant: null }
}

export function buildBoxRanking(inputs: BoxRankingInput[]): BoxRankRow[] {
  const rows: BoxRankRow[] = []

  for (const { box, noshrink, mixed, shrink } of inputs) {
    if (box.certainty !== 'released' || box.packs_per_box == null) continue

    const picked: [PriceRecord[] | null, BoxRankRow['variant']][] = [
      [noshrink, 'noshrink'],
      [mixed, 'mixed'],
      [shrink, 'shrink'],
    ]
    const hit = picked.find(([h]) => h != null && h.length > 0)
    if (!hit) continue
    const history = hit[0]!
    const variant = hit[1]

    const today = history[0]
    const mid = midOf(today)
    if (!(mid > 0)) continue

    const weekAgo = history.find(r => Date.parse(today.date) - Date.parse(r.date) >= 7 * DAY)
    const weekPct =
      weekAgo && midOf(weekAgo) > 0 && weekAgo.date !== today.date
        ? ((mid - midOf(weekAgo)) / midOf(weekAgo)) * 100
        : null

    const msrp = box.packs_per_box * box.pack_price_yen
    rows.push({
      boxId: box.box_id,
      boxName: box.box_name,
      code: box.code,
      releaseYm: box.release_ym,
      packImage: box.pack_image_url ?? null,
      mid: Math.round(mid),
      variant,
      msrp: msrp > 0 ? msrp : null,
      premiumPct: msrp > 0 ? Math.round((mid / msrp - 1) * 100) : null,
      weekPct,
      ...pickOnSale(shrink, noshrink, mixed),
      latestDate: today.date,
    })
  }

  // 既定は7日変化率の降順。取れない弾は末尾（0扱いにすると動いた弾より上に来てしまう）
  return rows.sort((a, b) => {
    if (a.weekPct == null && b.weekPct == null) return (b.premiumPct ?? 0) - (a.premiumPct ?? 0)
    if (a.weekPct == null) return 1
    if (b.weekPct == null) return -1
    return b.weekPct - a.weekPct
  })
}
