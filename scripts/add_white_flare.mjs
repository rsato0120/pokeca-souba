// ホワイトフレア（SV11W・2025-06-06）の高額チェイス18枚を pokeca_data.json に追加する。
// ブラックボルト（SV11B）と同時発売の対になる弾で、構成も同じ（AR 087-158 / SR 159-166 / SAR 167-173 / BWR 174）。
// 収録方針も揃えて BWR1 + SAR7 + SR2 + 高額AR8 の18枚。add_black_bolt.mjs と対で読むこと。
//
// 画像: limitless CDN は 102 以降のみ。095・096 は 403 なので pokeca.net にフォールバック（SV11Bと同じ穴の空き方）。
import * as fs from 'fs'

const DATA = 'data/pokeca_data.json'
const d = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const BOX_ID = 'white_flare'
const limitless = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV11W/SV11W_${n}_R_JP_LG.png`
const pokeca = (n) => `https://www.pokeca.net/data/pokeca/product/sv11w/${n}.jpg`
const img = (n) => (n === '095' || n === '096' ? pokeca(n) : limitless(n))

const box = {
  box_id: BOX_ID,
  box_name: 'ホワイトフレア',
  code: 'SV11W',
  release_ym: '2025-06',
  certainty: 'released',
  pack_price_yen: 290,
  packs_per_box: 20,
  pack_image_url: 'https://www.pokemon-card.com/ex/sv11/assets/images/infoProduct-img-2.png',
  note: '2025-06-06発売の拡張パック（同時発売の「ブラックボルト」と対）。イッシュ地方のポケモンを全種ARで収録する特殊構成で、AR72種・SAR7種に加え新レアリティBWR（レシラムex 174）が目玉。BWRは2カートンに1枚とされる低封入率。本サイトは相場が動く高額帯18枚を掲載。',
}

// [番号, カード名, レアリティ, タイプ, 進化段階, HP, 絵師, 絵師人気, キャラ人気, 備考]
const DEFS = [
  ['174', 'レシラムex',   'BWR', '炎', 'ポケモンex',     230, '5ban Graphics',  'unknown', 'high', 'ブラックボルトのゼクロムexと対になるBWR。封入率が極めて低く、ホワイトフレア最高額のチェイスカード。'],
  ['173', 'トウコ',       'SAR', 'サポート', 'サポート',    0, 'Naoki Saito',    'high',    'high', 'BWの女主人公トウコのSAR。人気キャラでサポートSARとして高額帯。'],
  ['172', 'バッフロンex', 'SAR', '無色', 'ポケモンex',   220, 'Rianti Hidayat', 'mid',     'mid',  'バッフロンexのスペシャルアートレア。'],
  ['171', 'サザンドラex', 'SAR', '悪', 'ポケモンex',     330, 'Takumi Wada',    'high',    'high', '和田拓三によるサザンドラexのSAR。SAR勢ではレシラム・トウコに次ぐ相場。'],
  ['170', 'ブルンゲルex', 'SAR', '超', 'ポケモンex',     270, 'Narano',         'mid',     'mid',  'ブルンゲルexのスペシャルアートレア。'],
  ['169', 'ケルディオex', 'SAR', '水', 'ポケモンex',     210, 'Yuu Nishida',    'mid',     'mid',  'ケルディオexのスペシャルアートレア。'],
  ['168', 'レシラムex',   'SAR', '炎', 'ポケモンex',     230, 'kawayoo',        'high',    'high', 'kawayooによるレシラムexのSAR。この弾の看板ポケモンでBWRに次ぐ主力チェイス。'],
  ['167', 'エルフーンex', 'SAR', '草', 'ポケモンex',     230, 'mele',           'mid',     'mid',  'エルフーンexのスペシャルアートレア。'],
  ['166', 'トウコ',       'SR',  'サポート', 'サポート',    0, 'yuu',            'mid',     'high', 'トウコのフルアートSR。SR帯では最高額。'],
  ['160', 'レシラムex',   'SR',  '炎', 'ポケモンex',     230, '5ban Graphics',  'unknown', 'high', 'レシラムexのフルアートSR。'],
  ['141', 'ゾロアーク',   'AR',  '悪', '1進化ポケモン',  120, 'Iwamoto05',      'mid',     'high', 'ゾロアークのAR。ゾロア(140)と対で人気。'],
  ['140', 'ゾロア',       'AR',  '悪', 'たねポケモン',    70, 'Naoki Saito',    'high',    'high', 'ゾロアのAR。AR帯の上位。'],
  ['124', 'プルリル',     'AR',  '超', 'たねポケモン',    80, 'Shinya Komatsu', 'mid',     'mid',  'プルリルのAR。'],
  ['113', 'バチュル',     'AR',  '雷', 'たねポケモン',    40, 'HYOGONOSUKE',    'high',    'mid',  'HYOGONOSUKEによるバチュルのAR。'],
  ['104', 'ダイケンキ',   'AR',  '水', '2進化ポケモン',  160, 'DOM',            'mid',     'mid',  'ミジュマルの最終進化ダイケンキのAR。'],
  ['102', 'ミジュマル',   'AR',  '水', 'たねポケモン',    70, 'OKACHEKE',       'high',    'high', 'AR最高額。SAR勢に迫る相場を付けたこの弾の名物カード。'],
  ['096', 'ポカブ',       'AR',  '炎', 'たねポケモン',    70, 'Orca',           'mid',     'mid',  'イッシュ御三家ポカブのAR。'],
  ['095', 'ビリジオン',   'AR',  '草', 'たねポケモン',   120, 'kodama',         'mid',     'mid',  'ビリジオンのAR。'],
]

const SLUG = {
  'レシラムex': 'reshiram-ex',
  'トウコ': 'touko',
  'バッフロンex': 'baffuron-ex',
  'サザンドラex': 'sazandora-ex',
  'ブルンゲルex': 'burungeru-ex',
  'ケルディオex': 'keldeo-ex',
  'エルフーンex': 'erufuun-ex',
  'ゾロアーク': 'zoroark',
  'ゾロア': 'zorua',
  'プルリル': 'pururiru',
  'バチュル': 'bachuru',
  'ダイケンキ': 'daikenki',
  'ミジュマル': 'mijumaru',
  'ポカブ': 'pokabu',
  'ビリジオン': 'virizion',
}

const cards = DEFS.map(([no, name, rarity, type, stage, hp, illus, illusPop, charPop, note]) => ({
  id: `${BOX_ID.replace(/_/g, '-')}-${SLUG[name]}-${rarity.toLowerCase()}-${Number(no)}`,
  card_no: `${no}/086`,
  rarity,
  card_name: name,
  box_id: BOX_ID,
  is_reprint: false,
  image_url: img(no),
  card_spec: { type, stage, hp, note },
  materials: {
    // レギュレーションマークI。本サイトはコレクター相場特化なのでプレイヤー材料は表示・予想に使わない。
    player: { regulation_mark: 'I', rotation: 'far', competitive_usage: 'none' },
    collector: {
      illustrator: illus,
      // 5ban Graphics は版元表記で個人絵師人気とは別物のため unknown 扱い（タッグボルトと同方針）
      illustrator_popularity: illusPop,
      artwork_type: 'original',
      rarity,
    },
    common: {
      reprint_status: 'none',
      scarcity: 'normal',
      character_popularity: charPop,
    },
  },
  evidence_notes: { player: '', collector: '', source: '' },
  note: '',
}))

// 冪等化: 既存の同一boxを一旦除去してから追加する
d.boxes = d.boxes.filter((b) => b.box_id !== BOX_ID)
d.cards = d.cards.filter((c) => c.box_id !== BOX_ID)

// 対になる black_bolt の直後に置く
const at = d.boxes.findIndex((b) => b.box_id === 'black_bolt')
d.boxes.splice(at < 0 ? d.boxes.length : at + 1, 0, box)
d.cards.push(...cards)

fs.writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n', 'utf-8')
console.log(`追加: box=${box.box_name} (${box.code}) / cards=${cards.length}枚`)
for (const c of cards) console.log(`  ${c.card_no} ${c.rarity.padEnd(3)} ${c.card_name}  ${c.id}`)
console.log(`合計カード数: ${d.cards.length}`)
