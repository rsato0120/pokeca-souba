// SM12a の snkrdunk apparel ID を登録する。
// ⚠ 書き込む前に /v1/apparels/{id} の localizedName に "[SM12a {番号}/173]" が入っているかを
//   1件ずつ照合する。スニダンは SA版を「SR: SA」と書くなど表記が揺れるため、番号照合が唯一の確実な鍵。
import fs from 'node:fs'
const IDS_FILE = 'C:/Users/user/Desktop/pokeca-souba/data/snkrdunk-ids.json'
const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'

const MAP = {
  182: 93082, 186: 93092, 188: 93085, 177: 91271, 179: 104543,
  192: 91269, 190: 93089, 196: 93083, 191: 91272, 201: 93091, 193: 93086,
  181: 104534, 175: 396155, 185: 104549, 187: 104535,
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))
const cards = data.cards.filter((c) => c.box_id === 'tag_all_stars')
const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf-8'))

let ok = 0, ng = 0
for (const card of cards) {
  const no = Number(card.card_no.split('/')[0])
  const apparel = MAP[no]
  if (!apparel) { console.log(`✗ ${card.id}: ID未登録`); ng++; continue }
  let name = ''
  for (let i = 0; i < 4 && !name; i++) {
    try {
      const r = await fetch(`https://snkrdunk.com/v1/apparels/${apparel}`, {
        headers: { 'Accept-Language': 'ja-JP', 'User-Agent': 'Mozilla/5.0' },
      })
      name = (await r.json()).localizedName ?? ''
    } catch { await new Promise((r) => setTimeout(r, 3000)) }
  }
  const want = `[SM12a ${String(no).padStart(3, '0')}/173]`
  if (name.includes(want)) {
    ids[card.id] = apparel
    console.log(`✓ ${card.id} -> ${apparel}  ${name.slice(0, 60)}`)
    ok++
  } else {
    console.log(`✗ ${card.id} -> ${apparel}  期待 ${want} / 実際 ${name.slice(0, 70)}`)
    ng++
  }
  await new Promise((r) => setTimeout(r, 400))
}

if (ng === 0) {
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n', 'utf-8')
  console.log(`\n登録完了: ${ok}件（snkrdunk-ids.json 合計 ${Object.keys(ids).length}件）`)
} else {
  console.log(`\n⚠️ ${ng}件が照合に失敗したため書き込みを中止した`)
  process.exit(1)
}
