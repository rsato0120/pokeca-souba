import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  try {
    // メガリザードンXex SAR を検索
    const keyword = 'メガリザードンXex+SAR+インフェルノX'
    await page.goto(`https://snkrdunk.com/search?keyword=${keyword}&category=card`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    console.log('=== 検索結果ページ ===')
    console.log('URL:', page.url())

    // カードページのHTMLで状態別価格を探す
    await page.goto('https://snkrdunk.com/apparels/826553', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })

    // PSA関連の要素を探す
    const psaInfo = await page.evaluate(() => {
      const body = document.body.innerHTML
      // PSA10関連テキスト周辺を抽出
      const idx = body.indexOf('PSA10')
      return idx >= 0 ? body.slice(Math.max(0, idx - 200), idx + 500) : 'PSA10 not found'
    })
    console.log('PSA10 HTML周辺:', psaInfo)

    // すべての価格テキストを探す
    const prices = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        const t = el.textContent?.trim() ?? ''
        return t.startsWith('¥') && t.length < 20 && el.children.length === 0
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        classes: el.className
      }))
    })
    console.log('価格要素:', JSON.stringify(prices.slice(0, 20), null, 2))

  } catch (e) {
    console.log('ERROR:', (e as Error).message)
  } finally {
    await browser.close()
  }
}
main()
