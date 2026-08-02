import { chromium } from 'playwright'

const query = process.argv[2] ?? 'ライボルト AR アビスアイ'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  const kw = encodeURIComponent(query)
  const url = `https://jp.mercari.com/search?keyword=${kw}&status=sold_out&sort=created_time&order=desc`
  console.log('検索:', query)
  console.log('URL:', url)

  const responsePromise = page.waitForResponse(
    r => r.url().includes('/v2/entities:search') && r.status() === 200,
    { timeout: 20000 }
  )
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const res = await responsePromise
  const json = await res.json()
  const items: Array<{ name: string; price: number }> = json.items ?? json.data?.items ?? []

  console.log(`\n取得件数: ${items.length}件`)
  items.slice(0, 20).forEach((item, i) => {
    console.log(`${i + 1}. ¥${item.price}\t${item.name?.slice(0, 80)}`)
  })

  await browser.close()
}
main()
