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
  // 出品**件数**を数えるときにタイトルへ要求する語（いずれか1つ含めばよい）。
  // 検索の曖昧一致で他地域・単品まで件数に乗るのを防ぐ（フクオカが839件になっていた）。
  // 表記ゆれがあるので漢字とカナの両方を並べる。
  titleAny?: string[]
  // 出品**件数**と成約の両方でタイトルに必ず要る語（全部含むこと）。
  // ⚠ titleAny（地域名）＋「BOX」だけだと、その店で買った**別商品**のBOXが全部通る。
  //   「ポケモンセンターフクオカ産 シュリンク付きBOX」のような出品が数に乗り、
  //   フクオカだけ809件（東北10・広島9）に膨らんでいた（2026-08-15 修正）。
  //   商品名そのものを要求して初めて同一商品の件数になる。
  titleAll?: string[]
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
      titleAll: ['スペシャル'],
      titleAny: ['東北', 'トウホク'],
    },
    {
      setId: 'hiroshima',
      label: 'ヒロシマ',
      cardId: 'pokecen-pikachu-hiroshima',
      query: 'ポケモンセンター 広島 スペシャルBOX 未開封',
      listPrice: 2090,
      titleAll: ['スペシャル'],
      titleAny: ['広島', 'ヒロシマ'],
    },
    {
      setId: 'fukuoka',
      label: 'フクオカ',
      cardId: 'pokecen-pikachu-fukuoka',
      query: 'ポケモンセンター 福岡 スペシャルBOX 未開封',
      listPrice: 2090,
      titleAll: ['スペシャル'],
      titleAny: ['福岡', 'フクオカ'],
    },
  ],
}

export function getSetProducts(boxId: string): SetProduct[] | null {
  return SET_BOXES[boxId] ?? null
}
