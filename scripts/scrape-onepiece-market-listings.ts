import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { assessBargain } from '@/lib/bargains'
import { getOnePieceCatalog, getOnePiecePrices, onePieceShortName } from '@/lib/onepiece'

type Item = { id?: string; name?: string; price?: number | string; thumbnails?: string[]; thumbnail?: string; imageUrl?: string }
const output = path.join(process.cwd(), 'data/onepiece/market-listings.json')
const normalize = (s: string) => s.normalize('NFKC').toUpperCase().replace(/[\s・･,，、。'’"”\-−ー]/g, '')
const excluded = (s: string) => /(PSA|BGS|ARS|CGC)\s*\d+|まとめ|セット|一式|複数枚|引退|オリパ|福袋|傷|ジャンク|折れ|白かけ|ケース|スリーブ|プレイマット|デッキ|英語|海外|中国語|韓国語|インドネシア|レプリカ|オリカ/i.test(s)

async function main() {
  const { products } = getOnePieceCatalog()
  const candidates = products.filter(p => p.kind === 'card' && p.card_no && (getOnePiecePrices(p.id)?.history[0]?.avg ?? 0) >= 3000)
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const rows: object[] = []
  try {
    for (const [index, product] of candidates.entries()) {
      const latest = getOnePiecePrices(product.id)?.history[0]
      const marketPrice = latest?.avg
      if (!latest || marketPrice == null) continue
      const page = await browser.newPage()
      try {
        const query = encodeURIComponent(`${onePieceShortName(product.name)} ${product.card_no}`)
        const responsePromise = page.waitForResponse(r => r.url().includes('/v2/entities:search') && r.status() === 200, { timeout: 25000 }).catch(() => null)
        await page.goto(`https://jp.mercari.com/search?keyword=${query}&status=on_sale&item_types=buy_now&sort=price&order=asc`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const response = await responsePromise
        if (!response) continue
        const json = await response.json()
        const items: Item[] = json.items ?? json.data?.items ?? json.result?.items ?? []
        const code = normalize(product.card_no ?? '')
        for (const item of items) {
          const title = String(item.name ?? '')
          const price = Number(item.price)
          if (!item.id || !(price > 0) || excluded(title) || !normalize(title).includes(code)) continue
          const deal = assessBargain(price, marketPrice)
          if (!deal) continue
          rows.push({ productId: product.id, listingId: String(item.id), slug: product.id,
            name: onePieceShortName(product.name), rarity: product.card_no, cardImage: product.image_url,
            listingImage: item.thumbnails?.[0] ?? item.thumbnail ?? item.imageUrl ?? null,
            title, listingPrice: price, marketPrice, ...deal,
            url: `https://jp.mercari.com/item/${item.id}` })
          break
        }
      } catch { /* 一部商品の取得失敗で全体を止めない */ }
      finally { await page.close() }
      console.log(`${index + 1}/${candidates.length} ${onePieceShortName(product.name)}`)
      await new Promise(r => setTimeout(r, 900))
    }
  } finally { await browser.close() }
  rows.sort((a, b) => (b as { discountPct: number }).discountPct - (a as { discountPct: number }).discountPct)
  if (candidates.length > 0 && rows.length === 0) {
    throw new Error('Mercariのお買い得出品を1件も取得できなかったため、既存データを保持します')
  }
  fs.writeFileSync(output, JSON.stringify({ updated_at: new Date().toISOString(), rows }, null, 2) + '\n')
  console.log(`保存: ${rows.length}件`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
