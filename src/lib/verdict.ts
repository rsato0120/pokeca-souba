import type { Forecast } from '@/types/pokeca'

// 「AI評価」のラベルを決める**唯一の場所**。
//
// ⚠ なぜ切り出したか（2026-08-30）:
//   カード詳細は up_pct >= 45 で「買い」を出す一方、トップの買い候補選定（buy-signals.ts）は
//   netUp = up_pct - down_pct > 0 だけを見ていた。基準が違うので、
//   「AI評価: 様子見・上昇確率33%」のカードが「AIが見つけた、まだ上がっていないカード」の
//   上位に並ぶという矛盾が起きていた。しきい値をここ1箇所に集約して両者を同じ物差しにする。
//
// ⚠ ここを変えるときは必ず両方の画面を確認すること。買い候補の母数が変わるので、
//   「AI高騰気配」のパーセンタイル分布も動く。

/** これ以上なら「買い」。買い候補に入れる下限でもある */
export const UP_VERDICT_PCT = 45
/** これ以上なら「値下がり注意」 */
export const DOWN_VERDICT_PCT = 45

export type VerdictLabel = '買い' | '様子見' | '値下がり注意'

export interface Verdict {
  label: VerdictLabel
  dot: string
  color: string
  /** 画面の注記に使う短い説明 */
  desc: string
}

export function aiVerdict(overall: Forecast['overall']): Verdict {
  if (overall.up_pct >= UP_VERDICT_PCT) {
    return { label: '買い', dot: '🟢', color: 'var(--up)', desc: `AIが3ヶ月後の上昇を${overall.up_pct}%と見ている水準です。` }
  }
  if (overall.down_pct >= DOWN_VERDICT_PCT) {
    return { label: '値下がり注意', dot: '🔴', color: 'var(--down)', desc: `AIが3ヶ月後の下落を${overall.down_pct}%と見ている水準です。` }
  }
  return { label: '様子見', dot: '🟡', color: 'var(--flat)', desc: '上昇・下落のどちらにも寄り切っていない水準です。買い候補には入れていません。' }
}
