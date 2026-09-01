export const BARGAIN_MIN_LISTING_PRICE = 3000
export const BARGAIN_MIN_DISCOUNT_PCT = 15
export const BARGAIN_MAX_DISCOUNT_PCT = 40

function minimumSavings(marketPrice: number): number {
  if (marketPrice < 10_000) return 1000
  if (marketPrice < 50_000) return 3000
  return 5000
}

export interface BargainAssessment {
  savings: number
  discountPct: number
}

/** 相場との差が十分に大きい、購入可能な単品出品だけを通す。 */
export function assessBargain(listingPrice: number, marketPrice: number): BargainAssessment | null {
  if (!(listingPrice >= BARGAIN_MIN_LISTING_PRICE) || !(marketPrice > listingPrice)) return null
  const savings = Math.round(marketPrice - listingPrice)
  const discountPct = (savings / marketPrice) * 100
  if (discountPct < BARGAIN_MIN_DISCOUNT_PCT || discountPct > BARGAIN_MAX_DISCOUNT_PCT || savings < minimumSavings(marketPrice)) return null
  return { savings, discountPct }
}
