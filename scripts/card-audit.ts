// 修正前後の比較用。使い方: npx tsx scripts/card-audit.ts "カイリューV SR 蒼空ストリーム" 73
import { chromium, type Browser } from 'playwright'

const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/, /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i]

const isExcludedOld = (t: string) => EXCLUDE_KEYWORDS.some(k => t.includes(k)) || EXCLUDE_PATTERNS.some(r => r.test(t))
const isExcludedNew = (t: string) => { const u = t.toUpperCase(); return EXCLUDE_KEYWORDS.some(k => u.includes(k.toUpperCase())) || EXCLUDE_PATTERNS.some(r => r.test(t)) }
const extractCardNos = (t: string) => [...t.matchAll(/(\d{1,3})\s*[/／]\s*(\d{1,3})/g)].map(m => parseInt(m[1], 10))
const matchesCardNo = (t: string, n: number | null) => { if (n == null) return true; const a = extractCardNos(t); return a.length === 0 || a.includes(n) }

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }
const removeOutliers = (p: number[]) => p.length < 3 ? p : p.filter(x => x >= median(p) * 0.5 && x <= median(p) * 1.5)

function summarize(label: string, kept: Array<{ name: string; price: number }>, lowPct: number, highPct: number) {
  const prices = removeOutliers(kept.map(i => Number(i.price)))
  if (prices.length < 3) { console.log(`  ${label.padEnd(8)} 採用${String(kept.length).padStart(3)}件 → 外れ値除去後${prices.length}件 ＝ データ不足(null)`); return }
  const s = [...prices].sort((a, b) => a - b)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  console.log(`  ${label.padEnd(8)} 採用${String(kept.length).padStart(3)}件 → 有効${String(prices.length).padStart(3)}件 / 中央値 ¥${median(prices).toLocaleString().padStart(8)} / avg ¥${avg.toLocaleString().padStart(8)} / ${(lowPct * 100)}th ¥${s[Math.floor(s.length * lowPct)].toLocaleString()} 〜 ${(highPct * 100)}th ¥${s[Math.min(s.length - 1, Math.floor(s.length * highPct))].toLocaleString()}`)
}

async function run(browser: Browser, query: string, cardNo: number | null, status: 'sold_out' | 'on_sale') {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  const sort = status === 'sold_out' ? 'sort=created_time&order=desc' : 'sort=price&order=asc'
  const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(query)}&status=${status}&item_types=buy_now&${sort}`
  const rp = page.waitForResponse(r => r.url().includes('/v2/entities:search') && r.status() === 200, { timeout: 25000 }).catch(() => null)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const res = await rp
  if (!res) { console.log(`\n### [${status}] ${query}  取得失敗`); await page.close(); return }
  const json = await res.json()
  const items: Array<{ name: string; price: number }> = json.items ?? json.data?.items ?? []

  console.log(`\n### [${status}] ${query}  (番号=${cardNo ?? '照合なし'}) numFound=${json.meta?.numFound} 取得${items.length}`)
  const lo = status === 'sold_out' ? 0.2 : 0.1
  const hi = status === 'sold_out' ? 0.8 : 0.9
  summarize('修正前', items.filter(i => !isExcludedOld(i.name) && Number(i.price) > 0), lo, hi)
  summarize('修正後', items.filter(i => !isExcludedNew(i.name) && matchesCardNo(i.name, cardNo) && Number(i.price) > 0), lo, hi)

  const dropped = items.filter(i => !isExcludedOld(i.name) && Number(i.price) > 0)
    .filter(i => isExcludedNew(i.name) || !matchesCardNo(i.name, cardNo))
  console.log(`  --- 新たに除外された ${dropped.length}件（高い順8件） ---`)
  ;[...dropped].sort((a, b) => b.price - a.price).slice(0, 8).forEach(i => console.log(`      ¥${String(i.price).padStart(8)}  ${i.name.slice(0, 66)}`))
  await page.close()
  await new Promise(r => setTimeout(r, 2500))
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const query = process.argv[2]
  const cardNo = process.argv[3] ? parseInt(process.argv[3], 10) : null
  await run(browser, query, cardNo, 'sold_out')
  await run(browser, query, cardNo, 'on_sale')
  await browser.close()
}
main()
