// 公式カード検索の名称・番号・レアリティ・画像をTCGdexの仕様データと照合して登録。
// 再実行しても同じIDを追加せず、価格履歴・予想は変更しない。
import fs from 'node:fs'

const boxId = 'battle_partners'
const slugs = ['maractus','articuno','wailord','ionos-kilowattrel','lillies-ribombee','swinub','lycanroc','ns-zorua','ns-reshiram','furret','noibat','hops-wooloo','volcanion-ex','ionos-bellibolt-ex','lillies-clefairy-ex','mamoswine-ex','ns-zoroark-ex','hops-zacian-ex','salamence-ex','dudunsparce-ex','iris-fighting-spirit','roughneck','brocks-scouting','volcanion-ex','ionos-bellibolt-ex','lillies-clefairy-ex','ns-zoroark-ex','hops-zacian-ex','salamence-ex','ionos-bellibolt-ex','ns-zoroark-ex','spiky-energy']
const types = { Grass:'草', Fire:'炎', Water:'水', Lightning:'雷', Psychic:'超', Fighting:'闘', Darkness:'悪', Metal:'鋼', Dragon:'竜', Colorless:'無' }
const stages = { Basic:'たね', Stage1:'1進化', Stage2:'2進化' }
const json = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}: ${url}`); return r.json() }
const cards = []
for (let no = 101; no <= 132; no++) {
  const source = `https://www.pokemon-card.com/card-search/details.php/card/${47120 + no}/`
  const response = await fetch(source)
  if (!response.ok) throw new Error(`公式カードページ取得失敗: ${no}`)
  const html = await response.text()
  const card = await json(`https://api.tcgdex.net/v2/ja/cards/SV9-${no}`)
  const name = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim()
  const number = html.replaceAll('&nbsp;', ' ').match(/\b(\d{3})\s*\/\s*100\b/)?.[1]
  const rarity = html.match(/ic_rare_(\w+)\.gif/)?.[1]?.split('_')[0].toUpperCase()
  const imagePath = html.match(/class="fit"\s+src="([^"]+\/SV9\/[^\"]+)"/)?.[1]
  if (name !== card.name || Number(number) !== no || !['AR','SR','SAR','UR'].includes(rarity) || !imagePath) throw new Error(`公式との照合失敗: ${no} ${name} ${number} ${rarity}`)
  const type = card.category === 'Trainer' ? 'サポート' : card.category === 'Energy' ? 'エネルギー' : types[card.types?.[0]]
  const stage = card.category === 'Pokemon' ? stages[card.stage] : type
  if (!type || !stage) throw new Error(`種類・進化情報不足: ${no}`)
  const illustrator = card.illustrator ?? 'unknown'
  if (illustrator !== 'unknown' && !html.includes(illustrator)) throw new Error(`イラストレーター不一致: ${no}`)
  const sourceNote = `公式カード検索 ${source} で名称・番号・レアリティ・画像・イラストレーターを確認。HP・タイプ・進化段階はTCGdex（https://api.tcgdex.net/v2/ja/cards/SV9-${no}）参照。2026-09-03登録。`
  cards.push({
    id: `battle-partners-${slugs[no - 101]}-${rarity.toLowerCase()}-${no}`,
    card_no: `${no}/100`, rarity, card_name: name, box_id: boxId,
    is_reprint: no === 132,
    image_url: `https://www.pokemon-card.com${imagePath}`,
    card_spec: { type, stage, hp: card.hp ?? 0, note: `${rarity}仕様。バトルパートナーズ収録。` },
    materials: {
      player: { regulation_mark: 'I', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator, illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
      common: { reprint_status: no === 132 ? 'reprinted' : 'none', scarcity: 'normal', character_popularity: 'unknown' },
    },
    evidence_notes: { player: '競技使用率・レギュレーション落ちの時期は未評価。', collector: `${name}の${rarity}版。`, source: sourceNote }, note: '',
  })
  console.log(`${no}/100 ${rarity} ${name}`)
}
const file = 'data/pokeca_data.json'
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
if (!data.boxes.some(box => box.box_id === boxId)) data.boxes.push({
  box_id: boxId, box_name: 'バトルパートナーズ', code: 'SV9', release_ym: '2025-01', certainty: 'released',
  pack_price_yen: 180, packs_per_box: 30,
  pack_image_url: 'https://www.pokemon-card.com/ex/sv9/assets/images/infoProduct-img-1.png',
  note: '2025-01-24発売。1パック5枚入り・1BOX30パック。公式商品情報: https://www.pokemon-card.com/ex/sv9/ 。AR・SR・SAR・UR全32種を掲載。',
})
const ids = new Set(data.cards.map(card => card.id))
const added = cards.filter(card => !ids.has(card.id))
data.cards.push(...added)
fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
console.log(`追加 ${added.length}枚 / 合計 ${data.cards.length}枚`)
