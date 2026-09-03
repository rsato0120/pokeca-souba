import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { getAllBoxes, getBoxPriceVariant } from '@/lib/data'
import { assessBoxBargain, boxMarketPrice, matchesSingleBox, type BoxMarketListings, type DealBoxVariant } from '@/lib/box-bargains'
import type { MarketListing } from '@/types/pokeca'

type Item = { id?: string; name?: string; price?: number | string; status?: string; thumbnails?: string[]; thumbnail?: string }

async function main() {
  const boxes = getAllBoxes()
  const targets = boxes.flatMap(box => box.certainty !== 'released' || !box.packs_per_box ? [] :
    (['shrink', 'noshrink'] as DealBoxVariant[]).flatMap(variant => {
      const market = boxMarketPrice(getBoxPriceVariant(box.box_id, variant)?.history[0])
      return market ? [{ box, variant, market }] : []
    }))
  const output = path.join(process.cwd(), 'data', 'box-market-listings.json')
  const result: BoxMarketListings = { updated_at: new Date().toISOString(), groups: [] }
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  let failures = 0
  try {
    for (const { box, variant, market } of targets) {
      const page = await browser.newPage()
      try {
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
        const query = `${box.box_name} BOX シュリンク${variant === 'shrink' ? '付き' : 'なし'}`
        // 最低価格を設けて空箱・パックが検索結果の先頭を占めることを防ぐ。
        const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(query)}&status=on_sale&item_types=buy_now&sort=price&order=asc&price_min=${Math.ceil(market * 0.6)}&price_max=${Math.floor(market * 0.95)}`
        const waiting = page.waitForResponse(r => r.url().includes('/v2/entities:search') && r.status() === 200, { timeout: 25000 }).catch(() => null)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const response = await waiting
        if (!response) throw new Error('検索結果を取得できませんでした')
        const json = await response.json()
        const items: Item[] | undefined = json.items ?? json.data?.items ?? json.result?.items
        if (!Array.isArray(items)) throw new Error('検索結果の形式が不明です')
        const listings: MarketListing[] = items.filter(item =>
          /^m\d+$/.test(String(item.id)) && (!item.status || /^(ITEM_STATUS_ON_SALE|on_sale)$/.test(item.status)) &&
          matchesSingleBox(String(item.name ?? ''), box, variant, boxes) && assessBoxBargain(Number(item.price), market)
        ).sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 3).map(item => ({
          id: String(item.id), title: String(item.name), price: Number(item.price), url: `https://jp.mercari.com/item/${item.id}`,
          ...(item.thumbnails?.[0] || item.thumbnail ? { image_url: item.thumbnails?.[0] ?? item.thumbnail } : {}),
        }))
        result.groups.push({ box_id: box.box_id, variant, fetched_at: new Date().toISOString(), listings })
        console.log(`${box.box_name} / ${variant}: ${listings.length}件`)
      } catch (error) {
        failures++
        console.error(`${box.box_name} / ${variant}: ${error instanceof Error ? error.message : error}`)
        // 失敗した系列の古い出品は引き継がない。
      } finally {
        await page.close()
      }
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  } finally {
    await browser.close()
  }
  if (targets.length > 0 && failures === targets.length) throw new Error('全BOXの取得に失敗したため、既存ファイルを維持します')
  let previous: BoxMarketListings | null = null
  try { previous = JSON.parse(fs.readFileSync(output, 'utf-8')) as BoxMarketListings } catch { /* 初回 */ }
  const signature = (data: BoxMarketListings) => JSON.stringify(data.groups.map(({ box_id, variant, listings }) => ({ box_id, variant, listings })))
  if (previous && signature(previous) === signature(result) && Date.now() - Date.parse(previous.updated_at) < 12 * 3600000) {
    console.log('BOX出品に変更なし — 確認日時は12時間ごとに更新します')
    return
  }
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`保存: ${result.groups.reduce((sum, group) => sum + group.listings.length, 0)}出品 / ${failures}系列取得失敗`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
