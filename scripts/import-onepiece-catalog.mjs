// One-time, reviewable catalog import. Prices are fetched separately from actual sales.
import fs from 'node:fs'
import { chromium } from 'playwright'

const sets = [
  { id: 'op17', code: 'OP-17', name: '世界最強の戦士', article: 32598 },
  { id: 'op16', code: 'OP-16', name: '決戦の刻', article: 31735 },
  { id: 'op15', code: 'OP-15', name: '神の島の冒険', article: 31228 },
  { id: 'op14', code: 'OP-14', name: '蒼海の七傑', article: 30674 },
  { id: 'op13', code: 'OP-13', name: '受け継がれる意志', article: 27561 },
]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
async function visit(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`)
      return
    } catch (error) {
      if (attempt === 2) throw error
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}
const saved = fs.existsSync('data/onepiece/catalog.json') ? JSON.parse(fs.readFileSync('data/onepiece/catalog.json', 'utf8')) : null
const products = saved?.products ?? []
try {
  for (const set of sets) {
    if (products.filter(p => p.set_id === set.id).length === 11) {
      Object.assign(set, saved.sets.find(s => s.id === set.id))
      continue
    }
    set.selection_url = `https://snkrdunk.com/articles/${set.article}/`
    await visit(set.selection_url)
    const officialLinks = await page.evaluate(() => [...document.querySelectorAll('a')].map(a => a.href).filter(u => u.includes('onepiece-cardgame.com/products/')))
    const officialUrl = officialLinks.find(u => u.includes(set.id))
    if (!officialUrl) throw new Error(`Official source missing: ${set.id}`)
    set.official_url = officialUrl.split('?')[0]
    await visit(set.official_url)
    const officialText = await page.locator('body').innerText()
    const released = officialText.match(/発売日\s*(\d{4})[.年](\d{1,2})[.月](\d{1,2})/)
    if (!released) throw new Error(`Release date missing: ${set.id}`)
    set.release_date = `${released[1]}-${released[2].padStart(2, '0')}-${released[3].padStart(2, '0')}`
    await visit(set.selection_url)
    const links = await page.evaluate(() => [...document.querySelectorAll('a')]
      .filter(a => /\/apparels\/\d+/.test(a.href))
      .map(a => ({ title: a.textContent.trim(), id: Number(a.href.match(/\/apparels\/(\d+)/)[1]) })))
    const box = links.find(l => l.title.includes(set.name) && /ボックス/.test(l.title))
    if (!box) throw new Error(`BOX not found: ${set.id}`)
    const unique = [...new Map(links.filter(l => l.id !== box.id).map(l => [l.id, l])).values()]
    const selected = unique.slice(0, 45)
    for (const entry of [...selected, box]) {
      if (entry.id !== box.id && products.filter(p => p.set_id === set.id && p.kind === 'card').length >= 10) continue
      await visit(`https://snkrdunk.com/apparels/${entry.id}`)
      const meta = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent.trim() ?? ''
        const image = [...document.querySelectorAll('img')].find(i => i.alt === title || (i.alt.length > 8 && title.startsWith(i.alt)))
        return { title, image_url: image?.getAttribute('data-src') || image?.getAttribute('src') || null }
      })
      const kind = entry.id === box.id ? 'box' : 'card'
      if (kind === 'card' && !meta.title.includes(set.name)) continue
      if (kind === 'box') meta.title = `${set.name} 未開封BOX`
      const cardNo = meta.title.match(/\[((?:OP|EB|ST)-?\d{2}-\d{3}|P-\d{3})\s*\]/)?.[1]?.replace(/^(OP|EB|ST)-/, '$1') ?? null
      if (kind === 'card' && !cardNo) throw new Error(`Card number missing: ${meta.title}`)
      products.push({ id: `${set.id}-${entry.id}`, set_id: set.id, kind, name: meta.title,
        card_no: cardNo, snkrdunk_id: entry.id, image_url: meta.image_url,
        source_url: `https://snkrdunk.com/apparels/${entry.id}` })
      console.log(`${set.code} ${kind} ${entry.id} ${meta.title}`)
      await new Promise(r => setTimeout(r, 500))
    }
    fs.mkdirSync('data/onepiece', { recursive: true })
    fs.writeFileSync('data/onepiece/catalog.json', JSON.stringify({ sets, products }, null, 2) + '\n')
  }
  // The article's image links carry the exact apparel ID, including the parallel variant.
  for (const set of sets) {
    await visit(set.selection_url)
    const images = await page.evaluate(() => [...document.querySelectorAll('a[href*="/apparels/"]')]
      .filter(a => a.querySelector('img'))
      .map(a => ({ id: Number(a.href.match(/\/apparels\/(\d+)/)?.[1]), src: a.querySelector('img').getAttribute('data-src') || a.querySelector('img').src,
        scale: Number(a.querySelector('img').style.transform.match(/^scale\(([\d.]+)\)$/)?.[1] ?? 1) })))
    for (const product of products.filter(p => p.set_id === set.id)) {
      const match = images.find(i => i.id === product.snkrdunk_id && i.src.startsWith('https://cdn.snkrdunk.com/') && !i.src.includes('/loading.'))
      if (match) { product.image_url = match.src; product.image_scale = Math.min(2.5, Math.max(1, match.scale)) }
    }
  }
  fs.writeFileSync('data/onepiece/catalog.json', JSON.stringify({ sets, products }, null, 2) + '\n')
} finally { await browser.close() }
