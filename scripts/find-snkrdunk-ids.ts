// snkrdunk の apparel ID をカード名＋番号から引く。
//
// ⚠ 検索のクエリパラメータは **keywords（複数形）**。`keyword=` だと 200 は返るが
//   検索が効かず、トップの人気商品一覧がそのまま描画される（scrape-prices.ts の
//   findSnkrdunkId が長らく何も見つけられなかった原因）。
//
// 使い方: npx tsx scripts/find-snkrdunk-ids.ts SM8b "230:ダークライGX" "224:ルカリオGX"
//   → 番号 \t apparelId \t スニダンのタイトル
//   タイトルに "[{弾コード} {番号}/" が入っている行だけを採用する（番号照合が唯一の確実な鍵）。
import { chromium } from 'playwright'
// 引数: "SM8b" "230:ダークライGX" "224:ルカリオGX" ...
async function main() {
  const set = process.argv[2]
  const targets = process.argv.slice(3).map(s => { const [no, name] = s.split(':'); return { no, name } })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  for (const t of targets) {
    let done = false
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        await page.goto(`https://snkrdunk.com/search?keywords=${encodeURIComponent(t.name + ' ' + t.no)}`,
          { waitUntil: 'domcontentloaded', timeout: 30000 })
        await new Promise(r => setTimeout(r, 3500))
        const rows = await page.evaluate(() => Array.from(document.querySelectorAll('a'))
          .map(a => ({ text: (a as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
                       href: (a as HTMLAnchorElement).href }))
          .filter(x => /\/apparels\/\d+$/.test(x.href)))
        // スニダンは弾コードを小文字で書くことがある（"ピカチュウ CHR[sm11b 054/049]"）ので大小無視で照合する
        const want = `[${set} ${t.no}/`.toLowerCase()
        const hit = rows.find(r => r.text.toLowerCase().includes(want))
        if (hit) { console.log(`${t.no}\t${hit.href.match(/(\d+)$/)![1]}\t${hit.text.slice(0, 85)}`); done = true }
        else if (rows.length) { console.log(`${t.no}\t-\t候補: ${rows.slice(0, 3).map(r => r.text.slice(0, 60)).join(' || ')}`); done = true }
      } catch { await new Promise(r => setTimeout(r, 3000)) }
    }
    if (!done) console.log(`${t.no}\tFAIL`)
    await new Promise(r => setTimeout(r, 2500))
  }
  await browser.close()
}
main()
