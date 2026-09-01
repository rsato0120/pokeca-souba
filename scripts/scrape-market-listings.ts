import { chromium, type Browser } from 'playwright'
import fs from 'fs'
import path from 'path'
import { getAllCards, getCardSlug, getPriceHistory } from '@/lib/data'
import type { Card, MarketListing, MarketListings } from '@/types/pokeca'
import { assessBargain } from '@/lib/bargains'

const OUTPUT_FILE = path.join(process.cwd(), 'data', 'market-listings.json')
const RANKING_LIMIT = 30
const LISTINGS_PER_CARD = 3
const SALES_WINDOW_DAYS = 7
const BARGAIN_CANDIDATE_LIMIT = 30

type MercariItem = {
  id?: string
  name?: string
  price?: number | string
  thumbnails?: string[]
  thumbnail?: string
  imageUrl?: string
  image_url?: string
  photos?: Array<{ uri?: string; url?: string }>
}

function normalize(value: string): string {
  return value.normalize('NFKC').toUpperCase().replace(/[\s・･,，、。'’"”\-−ー]/g, '')
}

function matchesCardName(title: string, cardName: string): boolean {
  const normalized = normalize(title)
  return cardName.split(/[の&]/).map(normalize).filter(Boolean).every((part) => normalized.includes(part))
}

function matchesCardNumber(title: string, cardNo: string): boolean {
  const match = cardNo.match(/^(\d{1,3})\s*[/／]\s*(\d{1,3})$/)
  if (!match) return true
  const no = String(Number(match[1]))
  const total = String(Number(match[2]))
  return [...title.matchAll(/(\d{1,3})\s*[/／]\s*(\d{1,3})/g)]
    .some((candidate) => String(Number(candidate[1])) === no && String(Number(candidate[2])) === total)
}

function isExcluded(title: string): boolean {
  return /(PSA|BGS|ARS|CGC)\s*(10|9|8|7|6|5|4|3|2|1)|まとめ|セット|一式|複数枚|引退品|オリパ|福袋|傷あり|ジャンク|折れ|白かけ|アクリル|スタンド|ケース|スリーブ|プレイマット|デッキシールド|サプライ|英語版|海外版|中国語|韓国語|インドネシア|メタルカード|レプリカ|オリカ|プロモなし/i.test(title)
}

function listingImage(item: MercariItem): string | undefined {
  return item.thumbnails?.[0] ?? item.thumbnail ?? item.imageUrl ?? item.image_url
    ?? item.photos?.[0]?.uri ?? item.photos?.[0]?.url
}

function buildQuery(card: Card): string {
  const numericNo = /^(\d{1,3})\s*[/／]\s*(\d{1,3})$/.test(card.card_no)
  if (numericNo) return `${card.card_name} ${card.card_no}`
  return card.rarity === 'PROMO'
    ? `${card.card_name} プロモ`
    : `${card.card_name} ${card.rarity}`
}

async function fetchListings(browser: Browser, card: Card): Promise<MarketListing[]> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  const query = encodeURIComponent(buildQuery(card))
  const url = `https://jp.mercari.com/search?keyword=${query}&status=on_sale&item_types=buy_now&sort=price&order=asc`
  try {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/v2/entities:search') && response.status() === 200,
      { timeout: 25000 },
    ).catch(() => null)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const response = await responsePromise
    if (!response) return []
    const json = await response.json()
    const items: MercariItem[] = json.items ?? json.data?.items ?? json.result?.items ?? []
    return items
      .filter((item) => {
        const title = String(item.name ?? '')
        const price = Number(item.price)
        return Boolean(item.id) && price > 0 && matchesCardName(title, card.card_name)
          && matchesCardNumber(title, card.card_no) && !isExcluded(title)
      })
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, LISTINGS_PER_CARD)
      .map((item) => ({
        id: String(item.id),
        title: String(item.name),
        price: Number(item.price),
        url: `https://jp.mercari.com/item/${item.id}`,
        ...(listingImage(item) ? { image_url: listingImage(item) } : {}),
      }))
  } catch {
    return []
  } finally {
    await page.close()
  }
}

function dateMinus(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00+09:00`)
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}

async function main() {
  const cards = getAllCards()
  const histories = cards.map((card) => ({ card, history: getPriceHistory(getCardSlug(card)) }))
  const baseDate = histories.map(({ history }) => history?.history[0]?.date ?? '').sort().at(-1) ?? ''
  if (!baseDate) throw new Error('価格履歴がないため出品ランキングを作成できません')
  const fromDate = dateMinus(baseDate, SALES_WINDOW_DAYS - 1)
  const ranked = histories
    .map(({ card, history }) => ({
      card,
      sales: Object.entries(history?.sales_by_day ?? {})
        .filter(([date]) => date >= fromDate && date <= baseDate)
        .reduce((sum, [, count]) => sum + Number(count), 0),
    }))
    .filter(({ sales }) => sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, RANKING_LIMIT)

  // ask_low は既存の日次取得で全カードに入るため、ここで割安候補だけを先に絞る。
  // 候補に対してのみ個別出品を取り、全696カードを追加で検索する負荷を避ける。
  const bargainCandidates = histories
    .map(({ card, history }) => {
      const latest = history?.history[0]
      if (!latest || latest.date < dateMinus(baseDate, 3) || (latest.sample_count ?? 0) < 5) return null
      const marketPrice = latest.avg ?? Math.round((latest.low + latest.high) / 2)
      const askPrice = latest.ask_low ?? 0
      const bargain = assessBargain(askPrice, marketPrice)
      return bargain ? { card, score: bargain.discountPct } : null
    })
    .filter((candidate): candidate is { card: Card; score: number } => candidate != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, BARGAIN_CANDIDATE_LIMIT)

  const targets = new Map<string, { card: Card; sales: number }>()
  for (const entry of ranked) targets.set(getCardSlug(entry.card), entry)
  for (const entry of bargainCandidates) {
    const slug = getCardSlug(entry.card)
    if (!targets.has(slug)) targets.set(slug, { card: entry.card, sales: 0 })
  }
  const targetList = [...targets.values()]

  console.log(`${baseDate}基準の売れ筋${ranked.length}枚＋割安候補${bargainCandidates.length}枚（重複除外後${targetList.length}枚）から出品を取得します`)
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const result: MarketListings = { updated_at: new Date().toISOString(), base_date: baseDate, cards: {} }
  try {
    for (const [index, { card, sales }] of targetList.entries()) {
      const listings = await fetchListings(browser, card)
      result.cards[getCardSlug(card)] = {
        card_id: getCardSlug(card),
        fetched_at: result.updated_at,
        listings,
      }
      console.log(`${index + 1}/${targetList.length} ${card.card_name} ${card.rarity}: 成約${sales}件 / 出品${listings.length}件保存`)
      await new Promise((resolve) => setTimeout(resolve, 1800 + Math.random() * 1200))
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  console.log(`保存しました: ${OUTPUT_FILE}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
