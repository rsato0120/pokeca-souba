import type { Box, MarketListing, PriceRecord } from '@/types/pokeca'
import { summarizeVariant, type BoxVariantId } from '@/lib/box-variant'

export type DealBoxVariant = Exclude<BoxVariantId, 'mixed'>
export interface BoxListingGroup {
  box_id: string
  variant: DealBoxVariant
  fetched_at: string
  listings: MarketListing[]
}
export interface BoxMarketListings {
  updated_at: string
  groups: BoxListingGroup[]
}

const normalize = (s: string) => s.normalize('NFKC').toUpperCase().replace(/[\s・･]/g, '')

/** タイトルから同一商品・単箱・シュリンク状態を確認できる出品だけを採用する。 */
export function matchesSingleBox(title: string, box: Box, variant: DealBoxVariant, boxes: Box[]): boolean {
  const text = normalize(title)
  if (!text.includes(normalize(box.box_name))) return false
  if (boxes.some(other => other.box_id !== box.box_id && text.includes(normalize(other.box_name)))) return false
  if (/空箱|空き箱|箱のみ|箱だけ|中身なし|開封済|開封品|再シュリンク|リシュリンク|サーチ|パック|セット|まとめ|カートン|ケース|オリパ|福袋|ジャンク|訳あり|難あり|傷|凹|潰|破れ|海外|英語|中国|韓国|レプリカ|プロモ|専用|予約|購入不可|売り切れ/.test(text)) return false
  const counts = [...text.matchAll(/(\d+)(?:BOX|ボックス|箱)/g)]
  if (counts.length !== 1 || Number(counts[0][1]) !== 1) return false
  if (/[×✕+＋]|(?:BOX|ボックス|箱)[×✕xX]?\d|[二三四五六七八九十複数]+(?:BOX|ボックス|箱)/.test(text)) return false
  const noShrink = /シュリンク(?:なし|無し|無|レス)/.test(text)
  const hasShrink = /シュリンク(?:あり|有り|有|付き|付)/.test(text)
  return variant === 'shrink' ? hasShrink && !noShrink : noShrink && !hasShrink && /未開封|ペリペリ付き|ペリペリあり/.test(text)
}

export function assessBoxBargain(price: number, market: number) {
  if (!Number.isFinite(price) || !Number.isFinite(market) || price < 3000 || market <= price) return null
  const savings = market - price
  const discountPct = savings / market * 100
  return savings >= 500 && discountPct >= 5 && discountPct <= 40 ? { savings, discountPct } : null
}

export function boxMarketPrice(record: PriceRecord | undefined, now = Date.now()): number | null {
  if (!record) return null
  const age = now - Date.parse(`${record.date}T00:00:00+09:00`)
  if (!Number.isFinite(age) || age < 0 || age > 4 * 86400000) return null
  return summarizeVariant('shrink', [record], null).mid
}

export function buildBoxDeals(data: BoxMarketListings | null, boxes: Box[], getLatest: (id: string, variant: DealBoxVariant) => PriceRecord | undefined, now = Date.now()) {
  const seen = new Set<string>()
  return (data?.groups ?? []).flatMap(group => {
    const age = now - Date.parse(group.fetched_at)
    const box = boxes.find(b => b.box_id === group.box_id && b.certainty === 'released' && b.packs_per_box)
    if (!box || !Number.isFinite(age) || age < 0 || age > 24 * 3600000) return []
    const marketPrice = boxMarketPrice(getLatest(box.box_id, group.variant), now)
    if (!marketPrice) return []
    return group.listings.flatMap(listing => {
      if (seen.has(listing.id) || !/^https:\/\/jp\.mercari\.com\/item\/m\d+$/.test(listing.url) || !matchesSingleBox(listing.title, box, group.variant, boxes)) return []
      const deal = assessBoxBargain(listing.price, marketPrice)
      if (!deal) return []
      seen.add(listing.id)
      return [{ box, variant: group.variant, listing, marketPrice, fetchedAt: group.fetched_at, ...deal }]
    })
  }).sort((a, b) => b.discountPct - a.discountPct || b.savings - a.savings)
}
