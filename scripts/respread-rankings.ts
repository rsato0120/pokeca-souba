import * as fs from 'fs'
import * as path from 'path'
import { adjustRankings } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'
import type { Forecast } from '@/types/pokeca'

// 既存の data/forecasts/*.json に、決定論的ランキングスプレッド（新 adjustRankings）を
// 当て直すワンショット。個別予想(Step 1)は再生成せずAPI消費ゼロ。up/flat/down のみ更新。

const forecastDir = path.join(process.cwd(), 'data', 'forecasts')

function main() {
  const cards = getAllCards()
  const items: Array<{ cardId: string; card: typeof cards[0]; forecast: Forecast }> = []

  for (const card of cards) {
    const cardId = getCardSlug(card)
    const fp = path.join(forecastDir, `${cardId}.json`)
    try {
      const forecast: Forecast = JSON.parse(fs.readFileSync(fp, 'utf-8'))
      items.push({ cardId, card, forecast })
    } catch {
      // 予想ファイルが無いカードはスキップ
    }
  }

  console.log(`${items.length}枚に決定論的スプレッドを適用します`)
  const rankMap = adjustRankings(items)

  let written = 0
  for (const { cardId, forecast } of items) {
    const adjusted = rankMap.get(cardId)
    if (!adjusted) continue
    forecast.overall.up_pct = adjusted.up_pct
    forecast.overall.flat_pct = adjusted.flat_pct
    forecast.overall.down_pct = adjusted.down_pct
    fs.writeFileSync(path.join(forecastDir, `${cardId}.json`), JSON.stringify(forecast, null, 2), 'utf-8')
    written++
  }

  const sorted = [...items].sort(
    (a, b) => (rankMap.get(b.cardId)?.up_pct ?? 0) - (rankMap.get(a.cardId)?.up_pct ?? 0)
  )
  console.log(`\n上位15枚:`)
  sorted.slice(0, 15).forEach(({ cardId, card }, i) => {
    const s = rankMap.get(cardId)
    console.log(`  ${String(i + 1).padStart(2)}. ↑${s?.up_pct}% →${s?.flat_pct}% ↓${s?.down_pct}%  ${card.card_name} ${card.rarity}`)
  })
  console.log(`\n完了: ${written}枚更新`)
}

main()
