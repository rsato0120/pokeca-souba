import type { Box, PriceRecord } from '@/types/pokeca'
import { midOf } from '@/lib/extremes'

// 未開封BOXのランキング。カードのランキングはあるのにBOXには無く、
// 「どの弾が伸びているか」を横並びで見る場所が無かった。
//
// ⚠ 代表値に使う系列の優先順は **シュリンクあり → シュリンクなし → 混在**（2026-08-30に変更）。
//   以前は「なし」優先だった。理由は「開封目的で買う人が見る値であり、BOX開封期待値(box-ev)も
//   同じ基準を使っているから」。だがその前提は2つとも崩れている:
//     ・box-ev は選択中のシュリンク状態に追従するようになった（固定の基準ではなくなった）
//     ・BOX詳細ページ(BoxMarketSection)の既定タブは**シュリンクあり**
//   このためトップと詳細で価格が食い違っていた（ポケモンカード151: トップ¥45,500 / 詳細¥54,500）。
//
//   さらに出品数を価格と同じ系列にそろえた結果、「なし」の薄い件数がそのまま表に出ていた。
//   未開封BOXの出品はシュリンク付きが主流で、実測(2026-08-30)では桁が違う:
//     ポケモンカード151  あり43件 / なし  1件
//     MEGAドリームex     あり115件 / なし 13件
//     クレイバースト      あり44件 / なし  1件
//   「1件」は品薄なのではなく**その状態の出品がほぼ無い**だけで、読み手を誤らせる。
//   詳細ページの既定に合わせて「あり」を先頭にすると、価格・出品数の両方が実勢に乗る。
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
 * 出品件数は **価格を採ったのと同じ系列**から採る。
 *
 * ⚠ 2026-08-30 に変更。それまでは価格＝シュリンクなし優先／出品＝シュリンクあり優先と
 *   **わざと系列を変えていた**（在庫の厚みは未開封保管の「あり」の方が意味を持つ、という理由）。
 *   だが実測のとおり系列で件数が桁違いになるため、同じ行に別々の市場の数字が並び
 *   「¥12,185 なのに出品115件」のような読み方のできない表示になっていた:
 *     アビスアイ      あり  7件 / なし 118件
 *     ストームエメラルダ あり171件 / なし  96件
 *     テラスタルフェスex あり 54件 / なし   5件
 *   1行の中では**価格・変化率・出品数をすべて同じ系列にそろえる**。
 *   その系列に出品数が無い場合は他系列で埋めず null（画面は「—」）にする。
 */
function pickOnSale(
  history: PriceRecord[] | null,
  variant: BoxRankRow['variant'],
): Pick<BoxRankRow, 'onSale' | 'onSaleCapped' | 'onSaleVariant'> {
  const r = history?.[0]
  if (r?.on_sale != null) {
    return { onSale: Number(r.on_sale), onSaleCapped: r.on_sale_capped === true, onSaleVariant: variant }
  }
  return { onSale: null, onSaleCapped: false, onSaleVariant: null }
}

export function buildBoxRanking(inputs: BoxRankingInput[]): BoxRankRow[] {
  const rows: BoxRankRow[] = []

  for (const { box, noshrink, mixed, shrink } of inputs) {
    if (box.certainty !== 'released' || box.packs_per_box == null) continue

    // BOX詳細ページ(BoxMarketSection)の既定タブと同じ順にする。ここを変えると
    // トップと詳細で違う金額が並ぶので、必ず両方そろえること。
    const picked: [PriceRecord[] | null, BoxRankRow['variant']][] = [
      [shrink, 'shrink'],
      [noshrink, 'noshrink'],
      [mixed, 'mixed'],
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
      ...pickOnSale(history, variant),
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
