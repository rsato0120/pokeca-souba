// SM8b の snkrdunk apparel ID を登録する。
// ⚠ 書き込む前に /v1/apparels/{id} の localizedName に "[SM8b {番号}/150]" が入っているかを
//   1件ずつ照合する。スニダンは SA版を「SR: SA」と書くなど表記が揺れるため、番号照合が唯一の確実な鍵。
import fs from 'node:fs'
const IDS_FILE = 'C:/Users/user/Desktop/pokeca-souba/data/snkrdunk-ids.json'
const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'

const MAP = {
  209: 91293, 240: 91295, 229: 91299, 216: 91297, 219: 91294, 238: 93099,
  230: 112793, 220: 91298, 224: 112788, 210: 112777, 211: 112778,
  206: 112774, 215: 112782, 237: 112800, 153: 91296, 152: 112770, 201: 397704,
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))
const cards = data.cards.filter((c) => c.box_id === 'gx_ultra_shiny')
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
  const want = `[SM8b ${String(no).padStart(3, '0')}/150]`
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
