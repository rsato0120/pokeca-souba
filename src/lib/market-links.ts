/** 閲覧・投票・ウォッチのIDはゲーム間で衝突させない（コレクションは既存IDを維持）。 */
export const onePieceMarketId = (id: string) => `onepiece-${id}`
export function marketCardHref(id: string): string {
  return id.startsWith('onepiece-') ? `/onepiece/products/${id.slice('onepiece-'.length)}` : `/cards/${id}`
}
