// GX期4弾の RR 63枚について snkrdunk の apparel ID を検索し、
// 商品名に "[{弾コード} {番号}/" が入っている候補だけを data/snkrdunk-ids.json に登録する。
// （番号照合が唯一の確実な鍵。スニダンは弾コードを小文字で書くことがあるので大小無視で照合する）
import fs from 'node:fs'
import { chromium } from 'playwright'

const IDS_FILE = 'C:/Users/user/Desktop/pokeca-souba/data/snkrdunk-ids.json'
const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const SET_OF = { gx_ultra_shiny: 'SM8b', tag_all_stars: 'SM12a', dream_league: 'SM11b', gx_battle_boost: 'SM4+' }

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))
const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf-8'))
const targets = data.cards.filter(c => SET_OF[c.box_id] && c.rarity === 'RR' && !ids[c.id])
console.log(`対象 ${targets.length}枚`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })

let ok = 0, ng = 0
for (const card of targets) {
  const set = SET_OF[card.box_id]
  const no = card.card_no.split('/')[0]
  const q = `${card.card_name} ${no}`
  let done = false
  for (let attempt = 0; attempt < 3 && !done; attempt++) {
    try {
      await page.goto(`https://snkrdunk.com/search?keywords=${encodeURIComponent(q)}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 })
      await new Promise(r => setTimeout(r, 3500))
      const rows = await page.evaluate(() => Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText.replace(/\s+/g, ' ').trim(), href: a.href }))
        .filter(x => /\/apparels\/\d+$/.test(x.href)))
      const want = `[${set} ${no}/`.toLowerCase()
      const hit = rows.find(r => r.text.toLowerCase().includes(want))
      if (hit) {
        ids[card.id] = Number(hit.href.match(/(\d+)$/)[1])
        console.log(`✓ ${card.id} -> ${ids[card.id]}  ${hit.text.slice(0, 70)}`)
        ok++
      } else {
        console.log(`✗ ${card.id}  候補${rows.length}件: ${rows.slice(0, 2).map(r => r.text.slice(0, 45)).join(' || ')}`)
        ng++
      }
      done = true
    } catch { await new Promise(r => setTimeout(r, 3000)) }
  }
  if (!done) { console.log(`✗ ${card.id}  FAIL`); ng++ }
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n', 'utf-8')
  await new Promise(r => setTimeout(r, 2000))
}
await browser.close()
console.log(`\n登録 ${ok}枚 / 未登録 ${ng}枚`)
