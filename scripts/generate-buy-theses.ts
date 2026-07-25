import * as fs from 'fs'
import * as path from 'path'
import { generateBuyThesis, type BuyThesisInput } from '@/lib/forecast'
import { getAllCards, getCardSlug, getForecast, getPriceHistory, getPriceExtremes, getBoxById } from '@/lib/data'
import { selectBuyCandidates, type BuyInput } from '@/lib/buy-signals'
import type { BuyThesis, PriceRecord } from '@/types/pokeca'

// 「AIが買うべきカード」欄の厚い論拠を生成する。
// 選定は決定論（buy-signals.ts）。上位候補だけ Gemini で論拠を作るので API 消費は数枚分だけ。
// scrape-prices.ts → update-forecasts.ts の後に実行する（最新の予想・価格が前提）。

const OUT_FILE = path.join(process.cwd(), 'data', 'buy-theses.json')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_DELAY_MS = 4000
// 論拠を生成する枚数。デフォルト6。引数で変更可（例: npx tsx scripts/generate-buy-theses.ts 8）
const LIMIT = Number(process.argv[2]) || 6

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

async function main() {
  const cards = getAllCards()

  const inputs: BuyInput[] = cards.map(card => {
    const slug = getCardSlug(card)
    return {
      card,
      slug,
      forecast: getForecast(slug),
      history: getPriceHistory(slug)?.history ?? [],
      extremes: getPriceExtremes(slug),
    }
  })

  const candidates = selectBuyCandidates(inputs, LIMIT, 2)
  console.log(`買い候補 ${candidates.length}枚の論拠を生成します\n`)

  const theses: Record<string, BuyThesis> = {}
  let apiCallCount = 0
  let failed = 0

  for (const c of candidates) {
    process.stdout.write(`  [${c.card.card_name} ${c.card.rarity}] `)

    const history = getPriceHistory(c.slug)?.history ?? []
    const forecast = getForecast(c.slug)
    if (!forecast) { console.log('予想なし — スキップ'); failed++; continue }

    const today = history[0]
    const psa10 = today?.psa10 != null ? Number(today.psa10) : null
    const psaMultiple = psa10 != null && c.mid > 0 ? psa10 / c.mid : null
    const withSale = history.filter(r => r.on_sale != null)
    const onSale = withSale[0]?.on_sale ?? null
    const supplyTightening = withSale.length >= 2 && withSale[0].on_sale != null && withSale[1].on_sale != null
      ? withSale[0].on_sale! < withSale[1].on_sale! * 0.95
      : false
    const ex = getPriceExtremes(c.slug)
    const box = getBoxById(c.card.box_id)

    const input: BuyThesisInput = {
      card: c.card,
      forecast,
      mid: c.mid || (today ? midOf(today) : 0),
      upsidePct: c.upsidePct,
      pricePosition: c.pricePosition,
      weekChange: c.weekChange,
      psa10,
      psaMultiple,
      onSale,
      supplyTightening,
      extremesLow: ex?.low.value ?? null,
      extremesHigh: ex?.high.value ?? null,
      boxName: box?.box_name,
      releaseYm: box?.release_ym,
    }

    if (apiCallCount > 0) await sleep(API_DELAY_MS)
    try {
      const thesis = await generateBuyThesis(input)
      apiCallCount++
      theses[c.card.id] = thesis
      console.log(`完了 [${thesis.conviction}] ${thesis.headline}`)
    } catch (e) {
      apiCallCount++
      console.log('失敗')
      console.error('    エラー:', e instanceof Error ? e.message : e)
      failed++
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(theses, null, 2) + '\n', 'utf-8')
  console.log(`\n完了: ${Object.keys(theses).length}枚の論拠を ${path.relative(process.cwd(), OUT_FILE)} に保存（${failed}枚失敗）`)
}

main()
