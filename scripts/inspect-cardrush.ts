/**
 * カードラッシュのHTML構造を調査するデバッグスクリプト
 * 実行: npx tsx scripts/inspect-cardrush.ts
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

  const query = encodeURIComponent('メガダークライex SR')

  // 駿河屋
  const url = `https://www.suruga-ya.jp/search?category=524&search_word=${query}`
  console.log('URL:', url)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(5000)

  // ページタイトル確認
  console.log('Title:', await page.title())

  // 価格・在庫に関連しそうなテキストを含む要素を全て抽出
  const info = await page.evaluate(() => {
    const results: { tag: string; classes: string; text: string }[] = []

    // 全要素をスキャン
    document.querySelectorAll('*').forEach(el => {
      const text = (el.textContent ?? '').trim().slice(0, 80)
      if (
        /[0-9,，]+円|¥[0-9]|在庫|残り|SOLD|売り切れ|買取|kaitori/i.test(text) &&
        el.children.length < 3 &&
        text.length < 80
      ) {
        results.push({
          tag: el.tagName.toLowerCase(),
          classes: el.className,
          text,
        })
      }
    })
    return results.slice(0, 60)
  })

  console.log('\n=== 価格・在庫関連の要素 ===')
  for (const r of info) {
    console.log(`<${r.tag} class="${r.classes}"> ${r.text}`)
  }

  // 商品リストの最初の1件のHTML全体も確認
  const firstItem = await page.evaluate(() => {
    // よくある商品リストのセレクタ候補
    const candidates = [
      '.p-item-list li',
      '.item-list li',
      '.product-list .item',
      '.search-result .item',
      '.c-product-card',
      '[class*="product"] li',
      '[class*="item-list"] li',
      'ul.items li',
    ]
    for (const sel of candidates) {
      const el = document.querySelector(sel)
      if (el) return { selector: sel, html: el.outerHTML.slice(0, 1000) }
    }
    // 駿河屋向けセレクタ
    const surugaCandidates = [
      '.item_search_list .item_box',
      '.item_box',
      '.box_commodity_info',
      '.commodity_img_inner',
      '[class*="item_box"]',
    ]
    for (const sel of surugaCandidates) {
      const el = document.querySelector(sel)
      if (el) return { selector: sel, html: el.outerHTML.slice(0, 1000) }
    }

    // フォールバック: li要素の中で価格っぽいものを探す
    const lis = Array.from(document.querySelectorAll('li'))
    for (const li of lis) {
      if (/[0-9,]+円|¥[0-9]/.test(li.textContent ?? '')) {
        return { selector: 'li (fallback)', html: li.outerHTML.slice(0, 1000) }
      }
    }
    return null
  })

  if (firstItem) {
    console.log(`\n=== 最初の商品要素 (${firstItem.selector}) ===`)
    console.log(firstItem.html)
  } else {
    console.log('\n商品リスト要素が見つかりませんでした')
    // ページのbody最初の2000文字をダンプ
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 2000))
    console.log('\n=== body HTML (先頭2000文字) ===')
    console.log(bodyHtml)
  }

  await browser.close()
}

main().catch(console.error)
