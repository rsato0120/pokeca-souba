import type { PriceRecord } from '@/types/pokeca'
import type { BoxEv } from '@/lib/box-ev'

// 未開封BOXの「シュリンクあり／なし／混在」を**1つの選択**として扱うための型。
//
// ⚠ なぜ要るか（2026-08-30）:
//   これまで同じBOXページの中で3箇所が**別々に系列を選んで**いた。
//     ・BoxPricePanel   … クライアント内部のタブ状態（利用者が選ぶ）
//     ・開封期待値/回収率 … noshrink 優先で固定
//     ・Xシェア文/定価比  … shrink 優先で固定
//   結果、「シュリンクあり ¥13,555〜¥14,000」を見ている画面の下で、回収率だけが
//   シュリンクなし ¥12,185 を基準に計算されていた（MEGAドリームexで実際に発生）。
//   タブの状態がサーバーコンポーネントに届かないのが構造的な原因なので、
//   **系列ごとに必要な値を全部そろえてから**クライアントに渡し、選択は1つに集約する。
//
// ⚠ 欠測は他系列で埋めない。埋めると「あり」を選んでいるのに「なし」の数字が出るという
//   元の事故に戻る。無いものは null にして、画面は「データ不足」と出す。

export type BoxVariantId = 'shrink' | 'noshrink' | 'mixed'

export const VARIANT_LABEL: Record<BoxVariantId, string> = {
  shrink: 'シュリンクあり',
  noshrink: 'シュリンクなし',
  mixed: '未開封BOX',
}

export interface BoxVariantView {
  id: BoxVariantId
  label: string
  /** その系列の価格履歴（新しい順）。無ければ null */
  history: PriceRecord[] | null
  /** 日別の成約箱数（スニダン成約API） */
  salesByDay?: Record<string, number>
  /** 表示用の下限・上限。history が無ければ null */
  low: number | null
  high: number | null
  /** 代表値（中央値） */
  mid: number | null
  /** 定価比(%)。定価か相場が無ければ null */
  premiumPct: number | null
  /** 7日変化率(%)。7日前の観測が無ければ null */
  weekPct: number | null
  /** 出品中件数。**同じ系列のものだけ**を入れる */
  onSale: number | null
  /** 1BOX開封の期待値。boxPrice にこの系列の mid を使って算出済み */
  ev: BoxEv | null
}

/** history 1本から表示用の数値をまとめて作る。ここ以外で mid/premium を再計算しないこと */
export function summarizeVariant(
  id: BoxVariantId,
  history: PriceRecord[] | null,
  msrp: number | null,
  salesByDay?: Record<string, number>,
): Omit<BoxVariantView, 'ev'> {
  const base = { id, label: VARIANT_LABEL[id], history, salesByDay }
  const latest = history?.[0]
  if (!latest) {
    return { ...base, low: null, high: null, mid: null, premiumPct: null, weekPct: null, onSale: null }
  }
  // low===high の系列（avg しか取れなかった日）は ±10% を表示レンジにする。
  // BoxPricePanel の従来実装と同じ式。ここに集約して二重定義を避ける。
  const low = latest.low < latest.high ? latest.low : Math.round((latest.avg ?? latest.low) * 0.9)
  const high = latest.low < latest.high ? latest.high : Math.round((latest.avg ?? latest.low) * 1.1)
  const mid = Math.round((latest.low + latest.high) / 2)
  const premiumPct = msrp ? Math.round(((mid - msrp) / msrp) * 100) : null

  const prev = history?.[7] ?? null
  const prevMid = prev ? (prev.low + prev.high) / 2 : null
  const weekPct = prevMid ? Math.round(((mid - prevMid) / prevMid) * 100) : null

  return { ...base, low, high, mid, premiumPct, weekPct, onSale: latest.on_sale ?? null }
}

/** 買い時シグナル。定価比と7日推移から出す（従来 BoxPricePanel にあったものを移設） */
export function boxSignal(premiumPct: number | null, weekPct: number | null) {
  if (premiumPct == null) return null
  if (premiumPct < 20) return { label: '買い好機', dot: '🟢', color: 'var(--up)', desc: '定価に近い水準。コスト効率が高い購入タイミング。' }
  if (premiumPct > 80 && (weekPct == null || weekPct >= 0)) return { label: '高値注意', dot: '🔴', color: 'var(--down)', desc: '定価の大幅プレミア。相場が天井圏の可能性あり。' }
  if (premiumPct > 80 && weekPct != null && weekPct < -3) return { label: '調整中', dot: '🟡', color: 'var(--flat)', desc: '高値から下落傾向。もう少し待つと安く買える可能性。' }
  if (weekPct != null && weekPct < -5) return { label: '下落中', dot: '🟡', color: 'var(--flat)', desc: '価格が下落傾向。底値確認後の購入を検討。' }
  return { label: '様子見', dot: '🟡', color: 'var(--flat)', desc: '標準的なプレミア水準。急いで買う必要はない。' }
}
