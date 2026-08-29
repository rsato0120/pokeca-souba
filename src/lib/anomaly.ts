import type { Card, PriceRecord } from '@/types/pokeca'
import { isDeckUtilityCard } from '@/lib/card-kind'
import { onSaleChangeOverDays } from '@/lib/on-sale'

// AI異変検知 — **価格がまだ動いていないのに、その手前の量が動いている**カードを拾う。
//
// 値上がりランキングは「もう動いた後」しか映さない。ここはその一歩手前を出すのが役目なので、
// 価格変化そのものはスコアに**入れない**（大きく動いた銘柄は急騰ランキングの担当）。
//
// ⚠ 使えるシグナルは実データがあるものだけに限る。仕様として挙がっていた
//   「海外価格差」「検索量」は**このサイトにデータ源が無い**（海外相場も検索ボリュームも
//   一切取得していない）ので実装しない。飾りで置くと、数字が動いていないのに
//   動いているように見える枠になる。取得経路を足した時にここへ signal を1つ増やせばよい。
//
// 実測(2026-08-28・カード556系列)での材料の揃い方:
//   出品数が2点以上ある … 449 (81%)   → 在庫の増減が読める
//   PSA10価格がある     … 405 (73%)   → 鑑定品との価格差が読める
//   直近7日に成約日あり … 213 (38%)   → 取引件数が読める（スニダン売買履歴のあるカードのみ）
//   成約数が取れない銘柄は**その signal を欠測として外す**。0件として扱うと
//   「取引が無い」と「観測できない」が混ざる。

export interface AnomalyInput {
  card: Card
  slug: string
  /** 新しい順 */
  history: PriceRecord[]
  /** 日付 -> 成約件数。スニダン売買履歴由来。無い銘柄は undefined */
  salesByDay?: Record<string, number>
  /** サイト全体の最新日（YYYY-MM-DD）。窓の起点に使う */
  latestDate: string
}

export type AnomalyLevel = 0 | 1 | 2 | 3

/** 段階ラベル。0=通常 は画面に出さない */
export const ANOMALY_LEVELS: Record<AnomalyLevel, { label: string; emoji: string; stars: number }> = {
  0: { label: '通常', emoji: '', stars: 0 },
  1: { label: '気配あり', emoji: '👀', stars: 2 },
  2: { label: '異変', emoji: '🔥', stars: 3 },
  3: { label: '強い異変', emoji: '⚡', stars: 4 },
}

export interface AnomalySignal {
  key: 'supply' | 'volume' | 'psa' | 'volatility'
  label: string
  /** 変化率(%)。方向は「異変寄りが正」に揃えてある（出品数は減少が正） */
  pct: number
  /** 画面に出す短い説明 */
  detail: string
  points: number
}

export interface AnomalyCard {
  card: Card
  slug: string
  mid: number
  /** 価格自体の変化(%)。まだ動いていないことを示すために出す */
  pricePct: number | null
  score: number
  level: AnomalyLevel
  signals: AnomalySignal[]
  /** 欠測で評価できなかったシグナル名（画面に「対象外」と出すため） */
  missing: string[]
}

const DAY = 24 * 60 * 60 * 1000

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

/** date から n 日前以降のレコードのうち最も古いもの（＝窓の起点） */
function baseRecord(history: PriceRecord[], latestDate: string, days: number): PriceRecord | null {
  const cutoff = Date.parse(latestDate) - days * DAY
  let base: PriceRecord | null = null
  for (const r of history) {
    if (Date.parse(r.date) >= cutoff) base = r
    else break
  }
  return base
}

/** 窓内の成約件数の合計 */
function salesIn(sales: Record<string, number>, latestDate: string, fromDays: number, toDays: number): number {
  const hi = Date.parse(latestDate) - toDays * DAY
  const lo = Date.parse(latestDate) - fromDays * DAY
  let n = 0
  for (const [d, c] of Object.entries(sales)) {
    const t = Date.parse(d)
    if (t > lo && t <= hi) n += c
  }
  return n
}

export function detectAnomaly(input: AnomalyInput): AnomalyCard | null {
  const { card, slug, history, salesByDay, latestDate } = input
  if (isDeckUtilityCard(card)) return null
  if (history.length < 2) return null

  const today = history[0]
  const mid = midOf(today)
  if (!(mid > 0)) return null

  const signals: AnomalySignal[] = []
  const missing: string[] = []

  // ── ① 出品数の急減（在庫が吸われている） ──
  // 打ち切り・出所違いの判定は src/lib/on-sale.ts に集約している
  // （スニダンの実数とメルカリの集計は桁が違うので引き算してはいけない）
  const sale = onSaleChangeOverDays(history, 7)
  if (sale != null) {
    const pct = -sale.changePct   // 減少を正にする
    if (pct >= 20) {
      signals.push({
        key: 'supply',
        label: '出品数',
        pct: -Math.abs(pct),   // 表示は「-34%」の向き
        detail: `${sale.prev}件 → ${sale.now}件`,
        points: pct >= 50 ? 3 : pct >= 35 ? 2 : 1,
      })
    }
  } else {
    missing.push('出品数（観測不足・打ち切り・出所の切替のいずれか）')
  }

  // ── ② 取引件数の急増 ──
  // 直近3日 vs その前の7日（1日あたりに直して比較）。スニダン売買履歴のある銘柄のみ。
  if (salesByDay && Object.keys(salesByDay).length > 0) {
    const recentTotal = salesIn(salesByDay, latestDate, 3, 0)
    const priorTotal = salesIn(salesByDay, latestDate, 10, 3)
    const recent = recentTotal / 3
    const prior = priorTotal / 7
    // ⚠ 母数の下限を置く。置かないと「前週0.1件/日 → 直近0.7件/日」が +367% として
    //   最上位に並ぶ。実件数では週1件が3日で2件になっただけで、増加と呼べる量ではない。
    //   直近に実数3件以上、比較元も週1件以上あることを要求する。
    const ENOUGH_RECENT = 3
    const ENOUGH_PRIOR = 1
    if (prior > 0 && recentTotal >= ENOUGH_RECENT && priorTotal >= ENOUGH_PRIOR) {
      const pct = ((recent - prior) / prior) * 100
      if (pct >= 40) {
        signals.push({
          key: 'volume',
          label: '取引件数',
          pct,
          detail: `直近3日 ${recentTotal}件（前週 ${priorTotal}件）`,
          points: pct >= 120 ? 3 : pct >= 70 ? 2 : 1,
        })
      }
    } else {
      missing.push('取引件数（比較できる期間の取引が無い）')
    }
  } else {
    missing.push('取引件数（スニダン売買履歴なし）')
  }

  // ── ③ PSA10との価格差の拡大 ──
  // 鑑定品だけ先に買われるのは、素体が後から追う典型。倍率の変化で見る。
  const withPsa = history.filter(r => r.psa10 != null && midOf(r) > 0)
  if (withPsa.length >= 2) {
    const nowRatio = Number(withPsa[0].psa10) / midOf(withPsa[0])
    const base = baseRecord(withPsa, latestDate, 14) ?? withPsa[withPsa.length - 1]
    const wasRatio = Number(base.psa10) / midOf(base)
    if (wasRatio > 0 && base.date !== withPsa[0].date) {
      const pct = ((nowRatio - wasRatio) / wasRatio) * 100
      if (pct >= 12) {
        signals.push({
          key: 'psa',
          label: 'PSA10価格差',
          pct,
          detail: `素体比 ${wasRatio.toFixed(1)}倍 → ${nowRatio.toFixed(1)}倍`,
          points: pct >= 30 ? 2 : 1,
        })
      }
    }
  } else {
    missing.push('PSA10価格')
  }

  // ── ④ 値動きの荒さ（変動率の上昇） ──
  // 直近5日の日次変化の平均絶対値が、その前の10日より大きい＝どちらかに動き出す前触れ
  const mids = history.slice(0, 16).map(midOf).filter(v => v > 0)
  if (mids.length >= 12) {
    const dailyAbs = (from: number, to: number) => {
      const seg = mids.slice(from, to)
      let s = 0, n = 0
      for (let i = 1; i < seg.length; i++) {
        if (seg[i] > 0) { s += Math.abs((seg[i - 1] - seg[i]) / seg[i]) * 100; n++ }
      }
      return n > 0 ? s / n : null
    }
    const recent = dailyAbs(0, 6)
    const prior = dailyAbs(6, 16)
    if (recent != null && prior != null && prior > 0.2) {
      const pct = ((recent - prior) / prior) * 100
      if (pct >= 60 && recent >= 1) {
        signals.push({
          key: 'volatility',
          label: '値動きの荒さ',
          pct,
          detail: `日次 ${prior.toFixed(1)}% → ${recent.toFixed(1)}%`,
          points: pct >= 150 ? 2 : 1,
        })
      }
    }
  }

  if (signals.length === 0) return null

  // ── 価格自体の変化。まだ動いていないほど「予兆」としての価値が高い ──
  const base7 = baseRecord(history, latestDate, 7)
  const pricePct =
    base7 && base7.date !== today.date && midOf(base7) > 0
      ? ((mid - midOf(base7)) / midOf(base7)) * 100
      : null

  let score = signals.reduce((a, s) => a + s.points, 0)
  // 複数のシグナルが同時に立っている方が本物らしい
  if (signals.length >= 3) score += 2
  else if (signals.length === 2) score += 1
  // 既に大きく動いた銘柄は「予兆」ではないので減点する
  if (pricePct != null && Math.abs(pricePct) >= 10) score -= 2

  if (score <= 1) return null
  const level: AnomalyLevel = score >= 7 ? 3 : score >= 5 ? 2 : 1

  return { card, slug, mid: Math.round(mid), pricePct, score, level, signals, missing }
}

/** 上位を選ぶ。1弾に偏らないよう弾あたり上限を設ける（買い候補と同じ考え方） */
export function selectAnomalies(inputs: AnomalyInput[], limit = 6, maxPerBox = 2): AnomalyCard[] {
  const scored = inputs
    .map(detectAnomaly)
    .filter((c): c is AnomalyCard => c != null)
    .sort((a, b) => b.score - a.score || Math.abs(a.pricePct ?? 0) - Math.abs(b.pricePct ?? 0))

  const picked: AnomalyCard[] = []
  const perBox: Record<string, number> = {}
  for (const c of scored) {
    if (picked.length >= limit) break
    const b = c.card.box_id
    if ((perBox[b] ?? 0) < maxPerBox) {
      picked.push(c)
      perBox[b] = (perBox[b] ?? 0) + 1
    }
  }
  for (const c of scored) {
    if (picked.length >= limit) break
    if (!picked.includes(c)) picked.push(c)
  }
  return picked
}
