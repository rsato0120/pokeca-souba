// 出品件数の取りこぼし調査（使い捨て）。
// 「番号で検索」と「名前+レアリティ+弾名で検索」で、同じ関門を通した後の件数を比べる。
// 使い方: npx tsx scripts/onsale-probe.ts
import { chromium, type Browser } from 'playwright'
import { getAllCards, getAllBoxes } from '../src/lib/data'

const RARITY_TOKEN_RE = /(^|[^A-Za-z])(RR|SR|SAR|SA|HR|MA|MUR|UR|AR)([^A-Za-z]|$)/g
const EXCLUDE_KEYWORDS = ['傷あり', 'ジャンク', 'まとめ', 'PSA', 'BGS', 'CGC', '割れ', '折れ', 'コンプ', '全種', 'セット', '複数', '大量', 'カートン', 'サプライのみ', 'プロモなし', 'プロモ無し', 'プロモカードなし']
const EXCLUDE_PATTERNS = [/[2-9０-９]枚\s*セット/, /まとめ/, /セット\s*[2-9０-９]/, /[1-9][0-9]+\s*枚/, /[2-9０-９]\s*枚/, /[2-9０-９]\s*[点種]/, /[2-9０-９]\s*(BOX|ボックス|箱)/i, /[1-9][0-9]+\s*(BOX|ボックス|箱)/i]

interface CardNo { no: number; total: number; strict?: boolean; rarity?: string; siblingRarities?: string[] }

function extractNoPairs(title: string) {
  const out: Array<{ no: number; total: number }> = []
  for (const m of title.matchAll(/(\d{1,3})\s*[/／]\s*(\d{1,3})/g)) out.push({ no: parseInt(m[1], 10), total: parseInt(m[2], 10) })
  return out
}
function looksLikeBundle(title: string): boolean {
  if (/引退/.test(title)) return true
  if (/専用/.test(title)) return true
  if (/(?:[A-Za-z]|ex|EX|GX|V|VMAX|VSTAR)\s*他/.test(title) || /他\s*$/.test(title)) return true
  if ((title.match(RARITY_TOKEN_RE) || []).length >= 3) return true
  const byTotal = new Map<number, Set<number>>()
  for (const p of extractNoPairs(title)) {
    if (!byTotal.has(p.total)) byTotal.set(p.total, new Set())
    byTotal.get(p.total)!.add(p.no)
  }
  return [...byTotal.values()].some(s => s.size >= 2)
}
function isExcluded(title: string): boolean {
  const upper = title.toUpperCase()
  return EXCLUDE_KEYWORDS.some(kw => upper.includes(kw.toUpperCase())) || EXCLUDE_PATTERNS.some(re => re.test(title)) || looksLikeBundle(title)
}
const CONFUSABLE = [['SR', 'SA'], ['SR', 'SAR'], ['HR', 'SA']]
const isConfusable = (a: string, b: string) => CONFUSABLE.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
const hasRarityToken = (t: string, r: string) => new RegExp(`(^|[^A-Za-z])${r}([^A-Za-z]|$)`).test(t.toUpperCase())
function matchesCardNo(title: string, card: CardNo | null): boolean {
  if (card == null) return true
  const sameSet = extractNoPairs(title).filter(p => p.total === card.total)
  if (sameSet.length > 0) return sameSet.some(p => p.no === card.no)
  if (!card.strict) return true
  if (!card.rarity || card.siblingRarities == null) return false
  if (card.siblingRarities.some(r => isConfusable(card.rarity!, r))) return false
  if (!hasRarityToken(title, card.rarity)) return false
  if (card.siblingRarities.some(r => hasRarityToken(title, r))) return false
  return true
}

interface Item { name: string; price: number }

async function fetchPages(browser: Browser, query: string, sort: string, maxPages: number) {
  const base = `https://jp.mercari.com/search?keyword=${encodeURIComponent(query)}&status=on_sale&item_types=buy_now&${sort}`
  const items: Item[] = []
  let numFound: number | null = null
  let token = ''
  let pages = 0
  let truncated = false
  while (pages < maxPages) {
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
    try {
      const rp = page.waitForResponse(r => r.url().includes('/v2/entities:search') && r.status() === 200, { timeout: 25000 }).catch(() => null)
      await page.goto(pages === 0 ? base : `${base}&page_token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const res = await rp
      if (!res) break
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json().catch(() => null)
      if (!json) break
      const meta = json.meta ?? {}
      if (numFound == null) {
        const raw = meta.numFound ?? meta.total
        numFound = raw != null && !isNaN(Number(raw)) ? Number(raw) : null
      }
      items.push(...(json.items ?? []))
      token = typeof meta.nextPageToken === 'string' ? meta.nextPageToken : ''
      pages++
      if (!token) break
      truncated = pages >= maxPages
    } finally { await page.close() }
    await new Promise(r => setTimeout(r, 2500 + Math.random() * 1500))
  }
  return { items, numFound, pages, truncated }
}

function tally(items: Item[], cardNo: CardNo | null) {
  let kept = 0, dropExcluded = 0, dropNo = 0
  const noNumberTitles: string[] = []
  for (const i of items) {
    if (isExcluded(i.name)) { dropExcluded++; continue }
    if (!matchesCardNo(i.name, cardNo)) {
      dropNo++
      if (extractNoPairs(i.name).length === 0) noNumberTitles.push(i.name)
      continue
    }
    kept++
  }
  return { seen: items.length, kept, dropExcluded, dropNo, noNumberTitles }
}

async function main() {
  const targets = process.argv.slice(2)
  const cards = getAllCards()
  const boxes = new Map(getAllBoxes().map(b => [b.box_id, b.box_name]))
  const siblingCount = new Map<string, number>()
  const siblingRarities = new Map<string, string[]>()
  for (const c of cards) {
    const k = `${c.box_id}|${c.card_name}`
    siblingCount.set(k, (siblingCount.get(k) ?? 0) + 1)
    siblingRarities.set(k, [...(siblingRarities.get(k) ?? []), c.rarity])
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  for (const slug of targets) {
    const card = cards.find(c => `${c.box_id}-${c.card_name}`.length && (c.id === slug))
    if (!card) { console.log(`?? 見つからない: ${slug}`); continue }
    const m = (card.card_no ?? '').match(/^(\d{1,3})\s*[/／]\s*(\d{1,3})$/)
    const key = `${card.box_id}|${card.card_name}`
    const cardNo: CardNo | null = m ? {
      no: parseInt(m[1], 10), total: parseInt(m[2], 10),
      strict: (siblingCount.get(key) ?? 0) > 1,
      rarity: card.rarity,
      siblingRarities: (siblingRarities.get(key) ?? []).filter(r => r !== card.rarity),
    } : null
    const boxName = boxes.get(card.box_id) ?? ''

    console.log(`\n════ ${card.card_name} ${card.rarity} (${card.card_no}) / ${boxName} ${cardNo?.strict ? '[strict]' : ''}`)

    // A: 現行＝番号で検索・価格昇順
    const qA = `${card.card_name} ${card.card_no}`
    const A = await fetchPages(browser, qA, 'sort=price&order=asc', 3)
    const tA = tally(A.items, cardNo)
    console.log(`  A 番号検索/価格昇順  q="${qA}"`)
    console.log(`     numFound=${A.numFound} 取得${tA.seen} → 採用${tA.kept}（除外${tA.dropExcluded} 番号不一致${tA.dropNo}）${A.truncated ? ' ※打ち切り' : ''}`)

    // B: 旧＝名前+レアリティ+弾名で検索・価格昇順（同じ関門を通す）
    const qB = `${card.card_name} ${card.rarity} ${boxName}`.replace(/\s+/g, ' ').trim()
    const B = await fetchPages(browser, qB, 'sort=price&order=asc', 3)
    const tB = tally(B.items, cardNo)
    console.log(`  B 広い検索/価格昇順  q="${qB}"`)
    console.log(`     numFound=${B.numFound} 取得${tB.seen} → 採用${tB.kept}（除外${tB.dropExcluded} 番号不一致${tB.dropNo}）${B.truncated ? ' ※打ち切り' : ''}`)

    // C: 広い検索・新着順（価格昇順の偏りを見る＝外挿の採用率が妥当か）
    const C = await fetchPages(browser, qB, 'sort=created_time&order=desc', 1)
    const tC = tally(C.items, cardNo)
    const rateB1 = tB.seen ? (tB.kept / tB.seen) : 0
    const rateC = tC.seen ? (tC.kept / tC.seen) : 0
    console.log(`  C 広い検索/新着順1P  取得${tC.seen} → 採用${tC.kept}  採用率 価格昇順(全体)=${(rateB1 * 100).toFixed(0)}% vs 新着=${(rateC * 100).toFixed(0)}%`)

    // Bだけが拾えている出品の実物を見る（本当にこのカードか？）
    const inA = new Set(A.items.map(i => i.name))
    const deltaKept = B.items.filter(i => !isExcluded(i.name) && matchesCardNo(i.name, cardNo) && !inA.has(i.name))
    console.log(`  --- Bのみが採用した ${deltaKept.length}件（先頭8件・¥価格） ---`)
    deltaKept.slice(0, 8).forEach(i => console.log(`      ¥${String(i.price).padStart(7)}  ${i.name.slice(0, 62)}`))

    if (tA.noNumberTitles.length) {
      console.log(`  --- Aで番号不一致として落ちた例（番号が書かれていない出品）---`)
      tA.noNumberTitles.slice(0, 4).forEach(t => console.log(`      ${t.slice(0, 70)}`))
    }
    await new Promise(r => setTimeout(r, 4000))
  }
  await browser.close()
}
main()
