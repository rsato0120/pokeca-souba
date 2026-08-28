import * as fs from 'fs'
import * as path from 'path'
import { generateForecast } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'
import { createForecastContextBuilder } from '@/lib/forecast-context'
import type { Forecast, PriceHistory, PriceRecord } from '@/types/pokeca'

const forecastDir = path.join(process.cwd(), 'data', 'forecasts')
const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(forecastDir, { recursive: true })

function getPriceData(cardId: string): { low: number; high: number; history: PriceRecord[] } | null {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  try {
    const data: PriceHistory = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (data.history.length > 0) {
      const record = data.history[0]
      const avg = record.avg ?? record.low
      // scraper が avg のみ保存する場合（low===high）は ±10% の価格帯を推定する
      const low = record.low < record.high ? record.low : Math.round(avg * 0.90)
      const high = record.low < record.high ? record.high : Math.round(avg * 1.10)
      return { low, high, history: data.history }
    }
  } catch {}
  return null
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
// 15 RPM free tier → 1 call per 4s to stay safely under the limit
const API_DELAY_MS = 4000

// ── 1日の生成上限（2026-08-28 追加）──
// Gemini の無料枠は 500 リクエスト/日。掲載枚数が 529 枚になり**全カードを毎日回すと
// 上限を超える**ようになった（実際 2026-08-28 に新4弾の途中から 429 で落ちている）。
// 全部を毎日作り直す必要は無いので、優先度を付けて予算内に収める。
const MAX_CALLS_PER_RUN = 440   // 500 のうち adjustRankings 等の余地を残す
// 何日経ったら作り直すか。全カードがこの周期で一巡する
const STALE_DAYS = 3
// 予想生成時点の想定価格から実勢がこれだけ動いたら、鮮度に関係なく作り直す
const MOVED_PCT = 6

const DAY_MS = 24 * 60 * 60 * 1000

function readForecast(cardId: string): Forecast | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(forecastDir, `${cardId}.json`), 'utf-8')) as Forecast
  } catch { return null }
}

/** 作り直す理由。null なら今日は作らなくてよい */
function refreshReason(fc: Forecast | null, low: number, high: number, now: number): string | null {
  if (fc == null) return '新規'
  const gen = Date.parse(fc.generated_at || '')
  if (!Number.isFinite(gen)) return '生成日時が不明'

  // 予想生成時に見ていた価格帯の中央と、いまの価格帯の中央を比べる
  const then = (fc.price_forecast.current_low + fc.price_forecast.current_high) / 2
  const nowMid = (low + high) / 2
  if (then > 0) {
    const moved = Math.abs(nowMid - then) / then * 100
    if (moved >= MOVED_PCT) return `実勢が${moved.toFixed(0)}%動いた`
  }

  const ageDays = (now - gen) / DAY_MS
  if (ageDays >= STALE_DAYS) return `${Math.floor(ageDays)}日経過`
  return null
}

async function main() {
  const cards = getAllCards()
  // 弾の状況・BOX相場・同名カードのレア間価格・過去予想の較正をプロンプトに渡すための文脈
  const buildContext = createForecastContextBuilder(cards)
  // ── 作り直す対象を先に決める ──
  // 全カードを毎日回すと 500RPD を超える（529枚）。優先度は 新規 > 実勢が動いた > 古い順。
  // 予算に収まらなかったカードは前回の予想がそのまま残るだけで、画面は壊れない。
  const now = Date.now()
  type Job = { card: typeof cards[0]; cardId: string; price: NonNullable<ReturnType<typeof getPriceData>>; reason: string; rank: number; age: number }
  const jobs: Job[] = []
  let noPrice = 0
  let fresh = 0

  for (const card of cards) {
    const cardId = getCardSlug(card)
    const price = getPriceData(cardId)
    if (!price) { noPrice++; continue }
    const fc = readForecast(cardId)
    const reason = refreshReason(fc, price.low, price.high, now)
    if (reason == null) { fresh++; continue }
    const gen = fc ? Date.parse(fc.generated_at || '') : NaN
    jobs.push({
      card, cardId, price, reason,
      rank: reason === '新規' ? 0 : reason.startsWith('実勢が') ? 1 : 2,
      age: Number.isFinite(gen) ? now - gen : Number.MAX_SAFE_INTEGER,
    })
  }

  jobs.sort((a, b) => a.rank - b.rank || b.age - a.age)
  const budget = jobs.slice(0, MAX_CALLS_PER_RUN)
  const deferred = jobs.length - budget.length

  console.log(`掲載 ${cards.length}枚 / 価格なし ${noPrice}枚 / 鮮度内で据え置き ${fresh}枚`)
  console.log(`作り直す ${budget.length}枚（新規 ${budget.filter(j => j.rank === 0).length} / 実勢変動 ${budget.filter(j => j.rank === 1).length} / 経過 ${budget.filter(j => j.rank === 2).length}）`)
  if (deferred > 0) console.log(`⚠ 1日の上限(${MAX_CALLS_PER_RUN}件)に収まらない ${deferred}枚は次回に回します`)
  console.log('')

  console.log('【Step 1】個別予想を生成中...\n')
  const succeeded: Array<{ cardId: string; card: typeof cards[0]; forecast: Forecast }> = []
  let failed = 0
  let apiCallCount = 0

  for (const { card, cardId, price, reason } of budget) {
    process.stdout.write(`  [${card.card_name} ${card.rarity}] (${reason}) `)

    if (apiCallCount > 0) await sleep(API_DELAY_MS)
    process.stdout.write('予想生成中... ')
    try {
      const forecast = await generateForecast(card, price.low, price.high, price.history, buildContext(card))
      apiCallCount++
      succeeded.push({ cardId, card, forecast })
      const { up_pct, flat_pct, down_pct } = forecast.overall
      const priceStr = `¥${price.low.toLocaleString()}〜¥${price.high.toLocaleString()}`
      console.log(`完了 [↑${up_pct}% →${flat_pct}% ↓${down_pct}%] ${priceStr}`)
    } catch (e) {
      apiCallCount++
      console.log('失敗')
      console.error('    エラー:', e instanceof Error ? e.message : e)
      failed++
    }
  }

  // ⚠ 部分生成では adjustRankings を**この場で掛けてはいけない**（2026-08-28）。
  //   adjustRankings は渡した集合の中で up/flat/down を相対配分する。全カードを毎日
  //   作り直していた頃は succeeded＝全件だったので問題なかったが、上限で絞るように
  //   なった今は succeeded が一部（例: 529枚中176枚）でしかない。その中だけで
  //   スプレッドを掛けると、作り直した銘柄と据え置きの銘柄で基準が違う確率が並ぶ。
  //   まず素の予想を書き出し、最後に **全 forecasts へ respread-rankings.ts** を
  //   当てるのが正しい順序（あちらはAPIを消費しない）。
  for (const { cardId, forecast } of succeeded) {
    fs.writeFileSync(path.join(forecastDir, `${cardId}.json`), JSON.stringify(forecast, null, 2), 'utf-8')
  }
  console.log(`\n【Step 2】${succeeded.length}件を書き出しました。`)
  console.log('  ランキングのスプレッドは全件に当て直す必要があります:')
  console.log('    npx tsx scripts/respread-rankings.ts')


  console.log(`\n完了: ${succeeded.length}枚処理, ${failed}枚失敗`)
}

main()
