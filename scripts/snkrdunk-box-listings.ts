import type { Browser } from 'playwright'

/** BOX商品そのものの新品出品数。関連商品や中古カードの件数は含めない。 */
export function parseBoxListingCount(html: string, apparelId: number): number | null {
  const payloads = [html]
  for (const match of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try {
      const chunk = JSON.parse(match[1])
      if (typeof chunk[1] === 'string') payloads.push(chunk[1])
    } catch { /* 不明なチャンクは採用しない */ }
  }
  for (const payload of payloads) {
    for (const match of payload.matchAll(/"apparelData":\s*\{/g)) {
      const start = match.index! + match[0].lastIndexOf('{')
      let depth = 0, quoted = false, escaped = false
      for (let end = start; end < payload.length; end++) {
        const char = payload[end]
        if (quoted) {
          if (escaped) escaped = false
          else if (char === '\\') escaped = true
          else if (char === '"') quoted = false
        } else if (char === '"') quoted = true
        else if (char === '{') depth++
        else if (char === '}' && --depth === 0) {
          try {
            const product = JSON.parse(payload.slice(start, end + 1))
            if (product.id === apparelId && Number.isSafeInteger(product.listingCount) && product.listingCount >= 0) return product.listingCount
          } catch { /* 壊れたデータを0件として保存しない */ }
          break
        }
      }
    }
  }
  return null
}

export async function getSnkrdunkBoxListingCount(browser: Browser, apparelId: number): Promise<number | null> {
  const page = await browser.newPage()
  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
    await page.goto(`https://snkrdunk.com/apparels/${apparelId}`, { waitUntil: 'load', timeout: 30000 })
    return parseBoxListingCount(await page.content(), apparelId)
  } catch { return null }
  finally { await page.close() }
}
