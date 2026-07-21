import { getCardSlug, getPredictionLog, getPriceHistory } from './data'
import type { Card, PriceRecord } from '@/types/pokeca'

// 過去の自分の予想と実際の値動きを突き合わせ、「弾として強気/弱気に寄りすぎていないか」を測る。
// カード単位だと1枚のブレをそのままLLMに突きつけることになり過剰な逆張りを招くため、
// 弾（box）単位で平均した粗い粒度に留める。
//
// predictions ログには予想時点の mid が入っているので、当時の価格を引き直す必要はない。

const DAY = 24 * 60 * 60 * 1000
// 目標日からこの日数以内の予想レコードを対象にする（欠測日があっても拾えるように）
const TOLERANCE_DAYS = 7
// これ未満の枚数しか照合できない弾は統計として弱いので出さない
const MIN_CARDS = 3

export interface BoxCalibration {
  lookbackDays: number
  cards: number            // 照合できた枚数
  avgPredictedNet: number  // 平均 (up_pct - down_pct)。プラスなら強気予想
  avgActualPct: number     // 平均の実際の変化率(%)
}

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

export function computeBoxCalibration(cards: Card[], lookbackDays = 30): BoxCalibration | null {
  const targetMs = Date.now() - lookbackDays * DAY
  const nets: number[] = []
  const actuals: number[] = []

  for (const card of cards) {
    const cardId = getCardSlug(card)
    const log = getPredictionLog(cardId)
    const history = getPriceHistory(cardId)
    if (!log?.predictions?.length || !history?.history?.length) continue

    // 目標日に最も近い予想（許容範囲内）を1件選ぶ
    let picked: (typeof log.predictions)[number] | null = null
    let bestGap = Infinity
    for (const p of log.predictions) {
      const gap = Math.abs(new Date(p.date).getTime() - targetMs)
      if (gap < bestGap) { bestGap = gap; picked = p }
    }
    if (!picked || bestGap > TOLERANCE_DAYS * DAY) continue
    if (!picked.mid || picked.mid <= 0) continue

    const nowMid = midOf(history.history[0])
    if (!nowMid) continue

    nets.push(picked.up_pct - picked.down_pct)
    actuals.push(((nowMid - picked.mid) / picked.mid) * 100)
  }

  if (nets.length < MIN_CARDS) return null

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    lookbackDays,
    cards: nets.length,
    avgPredictedNet: Math.round(mean(nets)),
    avgActualPct: Math.round(mean(actuals) * 10) / 10,
  }
}
