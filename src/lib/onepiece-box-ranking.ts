import type { BoxRankRow } from './box-ranking'
import type { OnePieceRankingRow } from './onepiece-ranking'
import type { OnePieceSet, OnePiecePrices } from '@/types/onepiece'

export function onePieceBoxRows(rows: OnePieceRankingRow[], sets: OnePieceSet[], observations: Record<string, OnePiecePrices | null>): BoxRankRow[] {
  return rows.filter(p => p.kind === 'box').sort((a,b) => (b.week ?? -Infinity) - (a.week ?? -Infinity) || b.avg - a.avg).map(p => {
    const set = sets.find(s => s.id === p.set_id)
    return { boxId: p.id, href: '/onepiece/products/' + p.id, boxName: set?.name ?? p.name, code: set?.code ?? p.set_id,
      releaseYm: set?.release_date.slice(0,7) ?? '', packImage: p.image_url, mid: p.avg, variant: 'mixed', variantLabel: '未開封・1箱単価',
      msrp: null, premiumPct: null, weekPct: p.week, onSale: observations[p.id]?.history[0]?.on_sale ?? null,
      onSaleCapped: false, onSaleVariant: null, latestDate: p.date }
  })
}
