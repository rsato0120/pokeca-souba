import type { Card } from '@/types/pokeca'

// カードを「コレクター相場で動くもの」と「デッキ実需で動くもの」に分ける。
//
// 基本/特殊エネルギー・グッズ・ポケモンのどうぐ・スタジアムは、ポケモンも人物も
// 描かれていない実用カード。AIの「買うべきカード」「注目カード」に並ぶと、
// コレクター相場を扱うサイトとして不自然に見えるため、推し出す枠からは外す。
// （カード詳細・収録弾一覧・検索には引き続き出る。2026-08-20: トップの価格ランキング
//   ＝急騰急落・ティッカー・高値安値更新・買われている/売られている からも外した。
//   「まだグッズが出ている」という指摘を受けて、順位を付けて推し出す枠は全て対象にした）
//
// 判定は card_spec を見る。card_name は使わない — 「エネルギー回収」のような
// グッズや、ワザ名にエネルギーを含むポケモンを誤爆するため。
// 特殊エネルギーだけは type が属性（草/炎/水）になるので stage 側で拾う。
// サポート（アセロラのいたずら等）はキャラ絵なのでコレクター枠として通す。
export function isDeckUtilityCard(card: Card): boolean {
  const spec = card.card_spec as { type?: string; stage?: string } | undefined
  if (!spec) return false
  const type = spec.type ?? ''
  const stage = spec.stage ?? ''
  if (type === 'エネルギー' || stage === 'エネルギー' || stage === '特殊エネルギー') return true
  if (type === 'グッズ' || stage === 'グッズ') return true
  if (type === 'ポケモンのどうぐ') return true
  if (type === 'スタジアム' || stage === 'スタジアム') return true
  return false
}
