// 「BOX相場」欄で、パック未開封BOXではなく“セット商品”の相場を出す弾の定義。
//
// 例: ポケモンセンター限定ピカチュウは、拡張パックのBOXではなく
//   地域ごとの「スペシャルBOX」（ご当地ピカチュウ1枚封入）が実体。
//   カード単体価格はカード一覧にそのまま残し、BOX相場欄にはこの
//   セット商品（未開封スペシャルBOX）の相場を地域ごとに表示する。
//
// scripts/scrape-prices.ts がこの定義を読み、各セットを box-{boxId}-{setId}.json
// に保存する（scrapeBox の床値バンド方式を流用）。box ページはこの定義を読んで
// セット相場パネルを描く。query は Mercari の実タイトルに合わせて調整可。

export interface SetProduct {
  setId: string     // ファイル接尾辞（box-{boxId}-{setId}.json）
  label: string     // 表示名（例「トウホク」）
  cardId: string    // 対応するカードの slug（行から詳細へリンク）
  query: string     // Mercari 成約検索クエリ（未開封セット商品を狙う）
  listPrice?: number // 定価（円）。実勢が取れない時の下限表示に使う
}

// boxId -> セット商品一覧
export const SET_BOXES: Record<string, SetProduct[]> = {
  pokecen_pikachu: [
    {
      setId: 'tohoku',
      label: 'トウホク',
      cardId: 'pokecen-pikachu-tohoku',
      query: 'ポケモンセンター 東北 スペシャルBOX 未開封',
      listPrice: 2090,
    },
    {
      setId: 'hiroshima',
      label: 'ヒロシマ',
      cardId: 'pokecen-pikachu-hiroshima',
      query: 'ポケモンセンター 広島 スペシャルBOX 未開封',
      listPrice: 2090,
    },
    {
      setId: 'fukuoka',
      label: 'フクオカ',
      cardId: 'pokecen-pikachu-fukuoka',
      query: 'ポケモンセンター 福岡 スペシャルBOX 未開封',
      listPrice: 2090,
    },
  ],
}

export function getSetProducts(boxId: string): SetProduct[] | null {
  return SET_BOXES[boxId] ?? null
}
