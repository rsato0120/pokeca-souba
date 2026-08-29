// 検索キーワードの候補比較（使い捨て）。
// 現行「名前 + 番号(NNN/MMM)」がタイトル40字切れで取りこぼす件を、別の引き方で救えるか測る。
import { chromium } from 'playwright'

const RARITY_TOKEN_RE = /(^|[^A-Za-z])(RR|SR|SAR|SA|HR|MA|MUR|UR|AR)([^A-Za-z]|$)/g
const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン', 'サプライのみ', 'プロモなし', 'プロモ無し', 'プロモカードなし']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/, /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i]
const pairs = (t: string) => [...t.matchAll(/(\d{1,3})\s*[/／]\s*(\d{1,3})/g)].map(m => ({ no: +m[1], total: +m[2] }))
function bundle(t: string) {
  if (/引退|専用/.test(t)) return true
  if (/(?:[A-Za-z]|ex|EX|GX|V|VMAX|VSTAR)\s*他/.test(t) || /他\s*$/.test(t)) return true
  if ((t.match(RARITY_TOKEN_RE) || []).length >= 3) return true
  const by = new Map<number, Set<number>>()
  for (const p of pairs(t)) { if (!by.has(p.total)) by.set(p.total, new Set()); by.get(p.total)!.add(p.no) }
  return [...by.values()].some(s => s.size >= 2)
}
const excluded = (t: string) => {
  const u = t.toUpperCase()
  return EXCLUDE_KEYWORDS.some(k => u.includes(k.toUpperCase())) || EXCLUDE_PATTERNS.some(r => r.test(t)) || bundle(t)
}

// 「そのカードだと確信できる」判定を2段階で見る
const strictMatch = (t: string, no: number, total: number) => {
  const same = pairs(t).filter(p => p.total === total)
  return same.length > 0 ? same.some(p => p.no === no) : null // null = 番号が書かれていない
}
// 分母が切れている場合の救済: 分子と同じ数字が単独で出ていて、他の番号ペアが無い
const looseMatch = (t: string, no: number, total: number) => {
  const s = strictMatch(t, no, total)
  if (s !== null) return s
  if (pairs(t).length > 0) return false
  return new RegExp(`(^|[^0-9])0*${no}([^0-9]|$)`).test(t)
}

async function count(browser: import('playwright').Browser, q: string, no: number, total: number, rarity: string) {
  const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(q)}&status=on_sale&item_types=buy_now&sort=price&order=asc`
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  let items: Array<{ name: string; price: number }> = []
  let numFound: number | null = null
  try {
    const rp = page.waitForResponse(r => r.url().includes('/v2/entities:search') && r.status() === 200, { timeout: 25000 }).catch(() => null)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const res = await rp
    if (res) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await res.json().catch(() => null)
      items = j?.items ?? []
      numFound = j?.meta?.numFound != null ? Number(j.meta.numFound) : null
    }
  } finally { await page.close() }

  const alive = items.filter(i => !excluded(i.name))
  const strict = alive.filter(i => strictMatch(i.name, no, total) === true).length
  const loose = alive.filter(i => looseMatch(i.name, no, total)).length
  const rar = alive.filter(i => strictMatch(i.name, no, total) === null && new RegExp(`(^|[^A-Za-z])${rarity}([^A-Za-z]|$)`).test(i.name.toUpperCase())).length
  console.log(`   q="${q}"`.padEnd(46), `numFound=${String(numFound).padStart(4)} 取得${String(items.length).padStart(3)} 除外後${String(alive.length).padStart(3)} → 番号厳密${String(strict).padStart(3)} / 分母切れ救済込み${String(loose).padStart(3)} （番号無しでレア表記あり${rar}）`)
  await new Promise(r => setTimeout(r, 3500 + Math.random() * 1500))
  return { strict, loose }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const targets: Array<[string, string, number, number, string, string]> = [
    ['ファイアローex', '096/076', 96, 76, 'SR', 'ストームエメラルダ'],
    ['ケルディオex', '169/086', 169, 86, 'SAR', 'ホワイトフレア'],
    ['ゾロアーク', '141/086', 141, 86, 'AR', 'ホワイトフレア'],
  ]
  for (const [name, noStr, no, total, rarity, box] of targets) {
    console.log(`\n════ ${name} ${rarity} (${noStr}) / ${box}`)
    await count(browser, `${name} ${noStr}`, no, total, rarity)            // 現行
    await count(browser, `${name} ${String(no)}`, no, total, rarity)        // 分子のみ（先頭ゼロ落とし）
    await count(browser, `${name} ${noStr.split('/')[0]}`, no, total, rarity) // 分子のみ（先頭ゼロ込み）
    await count(browser, `${name} ${rarity}`, no, total, rarity)            // 名前+レアのみ
  }
  await browser.close()
}
main()
