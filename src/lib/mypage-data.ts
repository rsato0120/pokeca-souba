import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { midOf } from '@/lib/market'
import type { ScreenerRow } from '@/components/ScreenerTable'

// ウォッチリストとマイページで**同じ行データ**を使うための組み立て。
//
// ⚠ 2026-08-30 に /watchlist のページ内から切り出した。マイページ（新設）でも同じ
//   ScreenerRow が要るので、コピーすると片方だけガード値が変わるといった食い違いが起きる。
//   どちらが登録されているかはビルド時に分からないため、全カードぶんを渡して
//   クライアント側（localStorage）で突き合わせる方式は従来どおり。

const DAY_GUARD = 20
const WEEK_GUARD = 35

export function buildScreenerRows(): ScreenerRow[] {
  const cards = getAllCards()
  const boxNames = new Map(getAllBoxes().map((b) => [b.box_id, b.box_name]))

  return cards.map((card) => {
    const slug = getCardSlug(card)
    const records = getPriceHistory(slug)?.history ?? []
    const today = records[0]
    const yesterday = records[1]
    const weekAgo = records[7]
    const extremes = getPriceExtremes(slug)
    const mid = today ? midOf(today) : 0

    const guard = (v: number | null, limit: number) => (v != null && Math.abs(v) <= limit ? v : null)

    return {
      id: slug,
      name: card.card_name,
      rarity: card.rarity,
      boxId: card.box_id,
      boxName: boxNames.get(card.box_id) ?? card.box_id,
      image: card.image_url ?? null,
      mid: Math.round(mid),
      dayChange: guard(
        today && yesterday && midOf(yesterday) > 0 ? ((mid - midOf(yesterday)) / midOf(yesterday)) * 100 : null,
        DAY_GUARD,
      ),
      weekChange: guard(
        today && weekAgo && midOf(weekAgo) > 0 ? ((mid - midOf(weekAgo)) / midOf(weekAgo)) * 100 : null,
        WEEK_GUARD,
      ),
      onSale: today?.on_sale ?? null,
      upPct: getForecast(slug)?.overall.up_pct ?? null,
      upsidePct: null,
      psa10: records.find((r) => r.psa10 != null)?.psa10 ?? null,
      offHigh: extremes && extremes.high.value > 0 && mid > 0
        ? Math.max(0, ((extremes.high.value - mid) / extremes.high.value) * 100)
        : null,
      rangePos: null,
    }
  })
}
