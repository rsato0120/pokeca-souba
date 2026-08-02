import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja-JP,ja;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  try {
    // カード個別ページを探す（メガリザードンXex SARで検索）
    const keyword = encodeURIComponent('メガリザードンXex SAR インフェルノX')
    const res = await page.goto(`https://snkrdunk.com/search?keyword=${keyword}&category=card`, {
      waitUntil: 'networkidle',
      timeout: 15000
    })
    console.log('STATUS:', res?.status())
    console.log('URL:', page.url())

    // 商品リンクを取得
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/trading-cards/"]')).slice(0, 5).map(a => ({
        text: (a as HTMLElement).innerText.trim().slice(0, 80),
        href: (a as HTMLAnchorElement).href
      }))
    )
    console.log('カードリンク:', JSON.stringify(links, null, 2))

    const text = (await page.evaluate(() => document.body.innerText)).slice(0, 1500)
    console.log(text)
  } catch (e) {
    console.log('ERROR:', (e as Error).message)
  } finally {
    await browser.close()
  }
}
main()
