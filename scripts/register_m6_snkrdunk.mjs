// ストームエメラルダ(M6)の snkrdunk apparel ID を data/snkrdunk-ids.json に登録する。
// IDは3バッチに分かれている:
//   ①868587-868598 = AR 077-088（id = 番号 + 868510 の連番）
//   ②868599-868608 = SR 10枚（089-094,096,100,102,103。095と一部トレーナー/エネは欠番）
//   ③868609-868614 = SAR 107-112（id = 番号 + 868502）／ 8687xx帯に MUR 113 と残りのSR
// 出典: スニダンの当たりランキング記事(articles/28986)の本文リンク＋ID連番スキャン(<title>照合)。
import fs from 'node:fs'

const IDS = 'C:/Users/user/Desktop/pokeca-souba/data/snkrdunk-ids.json'
const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'

// カード番号 -> apparel ID
const BY_NO = {
  // AR（連番: 番号 + 868510）
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [77 + i, 868587 + i])),
  // SR
  89: 868599, 90: 868600, 91: 868601, 92: 868602, 93: 868603, 94: 868604,
  95: 868768, 96: 868605, 97: 868769, 100: 868606, 102: 868607, 103: 868608,
  // SAR（連番: 番号 + 868502）
  107: 868609, 108: 868610, 109: 868611, 110: 868612, 111: 868613, 112: 868614,
  // MUR
  113: 868770,
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))
const ids = JSON.parse(fs.readFileSync(IDS, 'utf-8'))
const cards = data.cards.filter((c) => c.box_id === 'storm_emeralda')

let added = 0
const missing = []
for (const c of cards) {
  const no = Number(c.card_no.split('/')[0])
  const apparel = BY_NO[no]
  if (apparel) { ids[c.id] = apparel; added++ } else { missing.push(`${c.card_no} ${c.rarity} ${c.card_name}`) }
}

fs.writeFileSync(IDS, JSON.stringify(ids, null, 2) + '\n', 'utf-8')
console.log(`登録: ${added}/${cards.length} 枚（総登録数 ${Object.keys(ids).length}）`)
if (missing.length) console.log('未登録:\n  ' + missing.join('\n  '))
