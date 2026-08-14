import type { Card } from '@/types/pokeca'

// 「同じカードの別バージョン」を拾う。
//
// 相場を見に来る人がいちばん比べたいのは、同じ絵柄・同じポケモンの別レアリティ
// （レックウザV SR ¥9,969 / レックウザVMAX SA ¥666,666 のような桁違い）なので、
// カード詳細の空いた左カラムでそこへ飛べるようにする。

// ポケモン名に付く接頭辞・接尾辞を落として「素の名前」に寄せる。
//   レックウザV / レックウザVMAX / メガレックウザex → レックウザ
// ⚠ VMAX を V より先に判定すること（V を先に消すと VMAX が「…VMA」になる）。
const SUFFIXES = ['V-UNION', 'VSTAR', 'VMAX', 'GX', 'EX', 'ex', 'V']

export function basePokemonName(name: string): string {
  let n = name.trim()
  if (n.startsWith('メガ')) n = n.slice(2)
  for (const s of SUFFIXES) {
    if (n.endsWith(s) && n.length > s.length) {
      n = n.slice(0, -s.length)
      break
    }
  }
  return n.trim()
}

/**
 * 関連カードを近い順に返す。
 *  1. カード名が完全一致（同じカードのSR/SAR/HR違い・サポートの別レアリティ）
 *  2. 素の名前が一致（V / VMAX / メガex など進化・形態違い）
 * 各グループ内は priceOf の降順。高い版から並べた方が「どれが本命か」が分かる。
 */
export function pickRelated(
  target: Card,
  all: Card[],
  priceOf: (card: Card) => number,
  limit = 6
): Card[] {
  const base = basePokemonName(target.card_name)
  const sameName: Card[] = []
  const samePokemon: Card[] = []

  for (const c of all) {
    if (c.id === target.id) continue
    if (c.card_name === target.card_name) sameName.push(c)
    // 1文字の素名（切り詰めすぎ）は誤爆するので拾わない
    else if (base.length >= 2 && basePokemonName(c.card_name) === base) samePokemon.push(c)
  }

  const byPrice = (a: Card, b: Card) => priceOf(b) - priceOf(a)
  sameName.sort(byPrice)
  samePokemon.sort(byPrice)

  return [...sameName, ...samePokemon].slice(0, limit)
}
