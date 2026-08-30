import { getAllBoxes, getBoxPriceHistory, getCardSlug, getPriceHistory, getPsaPop } from './data'
import { computeBoxCalibration, type BoxCalibration } from './calibration'
import type { ForecastContext } from './forecast'
import type { Card, PriceRecord } from '@/types/pokeca'

// 予想プロンプトに渡す「カード単体では分からない文脈」を組み立てる。
// 弾情報・BOX相場・較正は弾ごとに1回だけ計算してキャッシュする（枚数分ファイルを読み直さない）。

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

export function createForecastContextBuilder(allCards: Card[]) {
  const boxes = new Map(getAllBoxes().map(b => [b.box_id, b]))
  const boxHistCache = new Map<string, PriceRecord[] | null>()
  const calCache = new Map<string, BoxCalibration | null>()
  const midCache = new Map<string, number | null>()

  const midFor = (card: Card): number | null => {
    const id = getCardSlug(card)
    if (!midCache.has(id)) {
      const h = getPriceHistory(id)
      midCache.set(id, h?.history?.length ? midOf(h.history[0]) : null)
    }
    return midCache.get(id) ?? null
  }

  // 弾内価格順位: 弾ごとに1回だけ「価格降順の card.id 配列」を作りキャッシュする
  const boxRankCache = new Map<string, string[]>()
  const rankListFor = (boxId: string): string[] => {
    if (!boxRankCache.has(boxId)) {
      const ranked = allCards
        .filter(c => c.box_id === boxId)
        .map(c => ({ id: c.id, mid: midFor(c) ?? -1 }))
        .filter(c => c.mid > 0)
        .sort((a, b) => b.mid - a.mid)
        .map(c => c.id)
      boxRankCache.set(boxId, ranked)
    }
    return boxRankCache.get(boxId)!
  }

  return (card: Card): ForecastContext => {
    const boxId = card.box_id

    if (!boxHistCache.has(boxId)) {
      boxHistCache.set(boxId, getBoxPriceHistory(boxId)?.history ?? null)
    }
    if (!calCache.has(boxId)) {
      calCache.set(boxId, computeBoxCalibration(allCards.filter(c => c.box_id === boxId)))
    }

    const rankList = rankListFor(boxId)
    const rankIdx = rankList.indexOf(card.id)
    const boxRank = rankIdx >= 0 ? { rank: rankIdx + 1, total: rankList.length } : null

    // 同名カードの別レアリティ（例: ゼクロムex の SR / SAR / BWR）
    const siblings = allCards
      .filter(c => c.box_id === boxId && c.card_name === card.card_name && c.id !== card.id)
      .map(c => ({ rarity: c.rarity, mid: midFor(c) }))
      .filter((s): s is { rarity: string; mid: number } => s.mid != null && s.mid > 0)

    return {
      box: boxes.get(boxId) ?? null,
      boxHistory: boxHistCache.get(boxId) ?? null,
      siblings,
      calibration: calCache.get(boxId) ?? null,
      psaPop: getPsaPop(getCardSlug(card)),
      boxRank,
      // スニダンの日別実成約件数。回転率シグナルの第一の出所（forecast.ts 参照）。
      // メルカリを省くカードでは sold_total が止まるので、これが無いと回転率が嘘になる。
      salesByDay: getPriceHistory(getCardSlug(card))?.sales_by_day ?? null,
    }
  }
}
