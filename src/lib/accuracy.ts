import { getAllCards, getCardSlug, getPredictionLog, getPriceHistory } from './data'
import type { PriceRecord } from '@/types/pokeca'

export const HORIZONS = [7, 30] as const
export type Horizon = (typeof HORIZONS)[number]

// 「様子見（拮抗）」を的中とみなす横ばい幅
const FLAT_THRESHOLD = 10
// up/down の判定マージン（up_pct と down_pct の差がこれ以上で方向ありとみなす）
const DIR_MARGIN = 10
// 目標日からこの日数以内の実績レコードまでを判定対象にする（データ欠損許容）
const TARGET_TOLERANCE_DAYS = 14
const DAY = 24 * 60 * 60 * 1000

export type Dir = 'up' | 'down' | 'flat'

export interface ResolvedItem {
  cardId: string
  cardName: string
  rarity: string
  horizon: number
  predictedOn: string
  targetDate: string
  dir: Dir
  midThen: number
  midActual: number
  changePct: number
  hit: boolean
}

export interface HorizonStat {
  resolved: number
  hits: number
  rate: number  // 0-100
  byDir: Record<Dir, { resolved: number; hits: number }>
}

export interface AccuracySummary {
  byHorizon: Record<number, HorizonStat>
  pendingCount: number
  recent: ResolvedItem[]
  firstPredictionDate: string | null
  totalPredictions: number
}

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

function dirOf(up: number, down: number): Dir {
  if (up - down >= DIR_MARGIN) return 'up'
  if (down - up >= DIR_MARGIN) return 'down'
  return 'flat'
}

// 目標日(以降)に最も近い実績レコードを探す。許容日数を超える場合は未確定。
function actualAt(historyAsc: { date: string; mid: number }[], targetDate: string): number | null {
  const targetMs = new Date(targetDate).getTime()
  let best: { date: string; mid: number } | null = null
  for (const h of historyAsc) {
    const ms = new Date(h.date).getTime()
    if (ms >= targetMs) { best = h; break }
  }
  if (!best) return null
  if (new Date(best.date).getTime() - targetMs > TARGET_TOLERANCE_DAYS * DAY) return null
  return best.mid
}

export function computeAccuracy(): AccuracySummary {
  const cards = getAllCards()
  const nameMap = new Map(cards.map(c => [getCardSlug(c), { name: c.card_name, rarity: c.rarity }]))

  const emptyDir = (): Record<Dir, { resolved: number; hits: number }> => ({
    up: { resolved: 0, hits: 0 }, down: { resolved: 0, hits: 0 }, flat: { resolved: 0, hits: 0 },
  })
  const byHorizon: Record<number, HorizonStat> = {}
  for (const h of HORIZONS) byHorizon[h] = { resolved: 0, hits: 0, rate: 0, byDir: emptyDir() }

  const resolvedItems: ResolvedItem[] = []
  let pendingCount = 0
  let totalPredictions = 0
  let firstPredictionDate: string | null = null

  for (const card of cards) {
    const cardId = getCardSlug(card)
    const log = getPredictionLog(cardId)
    if (!log || log.predictions.length === 0) continue
    const history = getPriceHistory(cardId)
    const historyAsc = (history?.history ?? [])
      .map(r => ({ date: r.date, mid: midOf(r) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    for (const p of log.predictions) {
      totalPredictions++
      if (!firstPredictionDate || p.date < firstPredictionDate) firstPredictionDate = p.date
      const dir = dirOf(p.up_pct, p.down_pct)

      for (const H of HORIZONS) {
        const targetDate = new Date(new Date(p.date).getTime() + H * DAY).toISOString().slice(0, 10)
        const actual = actualAt(historyAsc, targetDate)
        if (actual == null || p.mid <= 0) { pendingCount++; continue }
        const changePct = ((actual - p.mid) / p.mid) * 100
        const hit = dir === 'up' ? changePct > 0 : dir === 'down' ? changePct < 0 : Math.abs(changePct) <= FLAT_THRESHOLD

        const stat = byHorizon[H]
        stat.resolved++; if (hit) stat.hits++
        stat.byDir[dir].resolved++; if (hit) stat.byDir[dir].hits++

        const info = nameMap.get(cardId)
        resolvedItems.push({
          cardId, cardName: info?.name ?? cardId, rarity: info?.rarity ?? '',
          horizon: H, predictedOn: p.date, targetDate, dir,
          midThen: Math.round(p.mid), midActual: Math.round(actual),
          changePct: Math.round(changePct), hit,
        })
      }
    }
  }

  for (const h of HORIZONS) {
    const s = byHorizon[h]
    s.rate = s.resolved > 0 ? Math.round((s.hits / s.resolved) * 100) : 0
  }

  // 最近判定された順（目標日が新しい順）
  resolvedItems.sort((a, b) => b.targetDate.localeCompare(a.targetDate))

  return {
    byHorizon,
    pendingCount,
    recent: resolvedItems.slice(0, 30),
    firstPredictionDate,
    totalPredictions,
  }
}
