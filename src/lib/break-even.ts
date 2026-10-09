export interface SaleCosts {
  purchase: number
  expenses: number
  shipping: number
  feePct: number
}

/** 1枚を売却する場合。手数料を円単位で切り上げる保守的な概算。 */
export function calculateBreakEven(costs: SaleCosts, salePrice: number | null) {
  const { purchase, expenses, shipping, feePct } = costs
  if (![purchase, expenses, shipping, feePct].every(Number.isFinite)
    || purchase < 0 || expenses < 0 || shipping < 0 || feePct < 0 || feePct >= 100) return null
  const totalCost = purchase + expenses
  const breakEven = Math.ceil((totalCost + shipping) / (1 - feePct / 100))
  const validPrice = salePrice != null && Number.isFinite(salePrice) && salePrice > 0
  const proceeds = validPrice ? salePrice - Math.ceil(salePrice * feePct / 100) - shipping : null
  return { breakEven, proceeds, profit: proceeds == null ? null : proceeds - totalCost }
}
