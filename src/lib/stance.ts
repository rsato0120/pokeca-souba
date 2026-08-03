// 「みんなの予想」の投票区分。AI予想（up_pct / flat_pct / down_pct）と同じ3シナリオに揃えてある。
// 表示順・色・ラベルを1箇所に集約しているのは、カード詳細の投票UI・トップの注目カード・
// 的中率ランキングの3画面で並びや色がズレると「AIと人の対比」という主眼が崩れるため。
//
// 値は 2026-08-04 に 'bull'/'bear' の2択から移行した（supabase/schema.sql に移送SQLあり）。

export const STANCES = ['up', 'flat', 'down'] as const

export type Stance = (typeof STANCES)[number]

export const STANCE_LABEL: Record<Stance, string> = {
  up: '上昇',
  flat: '横ばい',
  down: '下落',
}

export const STANCE_COLOR: Record<Stance, string> = {
  up: 'var(--up)',
  flat: 'var(--flat)',
  down: 'var(--down)',
}

// 的中判定は **AI予想の的中実績（src/lib/accuracy.ts）と同じ式**を使う。
// ここを独自基準にすると「AI 62% / みんな 55%」と並べたときに同じ土俵の数字でなくなり、
// 対比という機能の主眼が崩れる。accuracy.ts の FLAT_THRESHOLD と必ず揃えること。
export const FLAT_BAND_PCT = 10

/** 予想区分が当たっていたか。上昇/下落は符号だけ、横ばいは ±FLAT_BAND_PCT 以内で判定する */
export function isHit(stance: Stance, changePct: number): boolean {
  if (stance === 'up') return changePct > 0
  if (stance === 'down') return changePct < 0
  return Math.abs(changePct) <= FLAT_BAND_PCT
}
