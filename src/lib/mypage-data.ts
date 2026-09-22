import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { priceChangePctForDays } from './price-change'
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
    const extremes = getPriceExtremes(slug)
    const mid = today ? midOf(today) : 0


    return {
      id: slug,
      name: card.card_name,
      rarity: card.rarity,
      boxId: card.box_id,
      boxName: boxNames.get(card.box_id) ?? card.box_id,
      image: card.image_url ?? null,
      mid: Math.round(mid),
      dayChange: priceChangePctForDays(records, 1, 1, DAY_GUARD, 6),
      weekChange: priceChangePctForDays(records, 6, 8, WEEK_GUARD, 6),
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
