// ブラックボルト（SV11B・2025-06-06）の高額チェイス18枚を pokeca_data.json に追加する。
//
// この弾は「イッシュのポケモンが全種AR化」する特殊構成で光物が88枚（AR72 + SR8 + SAR7 + BWR1）ある。
// 大半のARは¥700〜1,000で相場が動かないため、ユーザー選択により高額帯のみを厳選収録する（151と同方針）。
//   BWR 1枚（174 ゼクロムex＝この弾の目玉）/ SAR 全7枚 / SR 上位2枚 / AR 高額上位8枚
//
// 画像: limitless CDN が 102 以降をホストする。087・097 のみ 403 なので pokeca.net にフォールバック。
import * as fs from 'fs'

const DATA = 'data/pokeca_data.json'
const d = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const BOX_ID = 'black_bolt'
const limitless = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV11B/SV11B_${n}_R_JP_LG.png`
const pokeca = (n) => `https://www.pokeca.net/data/pokeca/product/sv11b/${n}.jpg`
// 087/097 は limitless に無い（403）
const img = (n) => (n === '087' || n === '097' ? pokeca(n) : limitless(n))

const box = {
  box_id: BOX_ID,
  box_name: 'ブラックボルト',
  code: 'SV11B',
  release_ym: '2025-06',
  certainty: 'released',
  pack_price_yen: 290,
  packs_per_box: 20,
  pack_image_url: 'https://www.pokemon-card.com/ex/sv11/assets/images/infoProduct-img-1.png',
  note: '2025-06-06発売の拡張パック（同時発売の「ホワイトフレア」と対）。イッシュ地方のポケモンを全種ARで収録する特殊構成で、AR72種・SAR7種に加えこの弾だけの新レアリティBWR（ゼクロムex 174）が目玉。本サイトは相場が動く高額帯18枚を掲載。',
}

// [番号, カード名, レアリティ, タイプ, 進化段階, HP, 絵師, 絵師人気, キャラ人気, 備考]
const DEFS = [
  ['174', 'ゼクロムex',   'BWR', '雷', 'ポケモンex',     230, 'takuyoa',         'mid',  'high', 'この弾だけの新レアリティBWR（ブラックホワイトレア）。黒基調の特殊加工で、ブラックボルト最高額のチェイスカード。'],
  ['173', 'Nの筋書き',     'SAR', 'サポート', 'サポート',    0, 'REND',            'mid',  'high', 'Nが描かれたサポートSAR。初動¥24,800から下落したが、サポートSARでは屈指の人気。'],
  ['172', 'ゲノセクトex',  'SAR', '鋼', 'ポケモンex',     220, 'kantaro',         'mid',  'mid',  'ゲノセクトexのスペシャルアートレア。'],
  ['171', 'ドリュウズex',  'SAR', '闘', 'ポケモンex',     270, 'Mitsuhiro Arita', 'high', 'mid',  '有田満弘によるドリュウズexのSAR。'],
  ['170', 'メロエッタex',  'SAR', '超', 'ポケモンex',     200, 'LINNE',           'mid',  'mid',  'メロエッタexのスペシャルアートレア。'],
  ['169', 'ゼクロムex',    'SAR', '雷', 'ポケモンex',     230, 'danciao',         'mid',  'high', 'ゼクロムexのSAR。BWRに次ぐこの弾の主力チェイス。'],
  ['168', 'キュレムex',    'SAR', '水', 'ポケモンex',     230, 'chibi',           'mid',  'high', 'キュレムexのスペシャルアートレア。'],
  ['167', 'ジャローダex',  'SAR', '草', 'ポケモンex',     320, 'Ryota Murayama',  'mid',  'mid',  'ジャローダexのスペシャルアートレア。'],
  ['165', 'Nの筋書き',     'SR',  'サポート', 'サポート',    0, 'hncl',            'mid',  'high', 'Nの筋書きのフルアートSR。'],
  ['161', 'ゼクロムex',    'SR',  '雷', 'ポケモンex',     230, 'takuyoa',         'mid',  'high', 'ゼクロムexのフルアートSR。'],
  ['157', 'チラーミィ',    'AR',  '無色', 'たねポケモン',  60, 'Natsumi Yoshida', 'mid',  'mid',  'ARの中でも人気の高い一枚。'],
  ['123', 'ユニラン',      'AR',  '超', 'たねポケモン',    40, 'USGMEN',          'high', 'mid',  'USGMENによるAR。AR帯ではガマゲロゲに次ぐ高額。'],
  ['117', 'シビシラス',    'AR',  '雷', 'たねポケモン',    40, 'ryoma uratsuka',  'mid',  'mid',  'AR帯の上位。'],
  ['109', 'ガマゲロゲ',    'AR',  '水', '2進化ポケモン',  170, 'Shinji Kanda',    'mid',  'mid',  'AR最高額。SAR勢を上回る相場を付けたこの弾の名物カード。'],
  ['104', 'ウルガモス',    'AR',  '炎', '1進化ポケモン',  120, 'AKIRA EGAWA',     'mid',  'mid',  'AR帯の上位。'],
  ['102', 'シャンデラ',    'AR',  '炎', '2進化ポケモン',  150, 'Kuroimori',       'mid',  'mid',  'AR帯の上位。'],
  ['097', 'ビクティニ',    'AR',  '炎', 'たねポケモン',    80, 'Amelicart',       'high', 'high', 'Amelicartによる人気AR。AR帯ではユニランと並ぶ高額。'],
  ['087', 'ツタージャ',    'AR',  '草', 'たねポケモン',    70, 'Yoshimi Miyoshi', 'mid',  'mid',  'AR番号の先頭を飾るツタージャ。御三家人気で安定。'],
]

const SLUG = {
  'ゼクロムex': 'zekrom-ex',
  'Nの筋書き': 'n-no-sujigaki',
  'ゲノセクトex': 'genesect-ex',
  'ドリュウズex': 'doryuuzu-ex',
  'メロエッタex': 'meloetta-ex',
  'キュレムex': 'kyurem-ex',
  'ジャローダex': 'jalorda-ex',
  'チラーミィ': 'chiraamii',
  'ユニラン': 'uniran',
  'シビシラス': 'shibishirasu',
  'ガマゲロゲ': 'gamageroge',
  'ウルガモス': 'urugamosu',
  'シャンデラ': 'shandera',
  'ビクティニ': 'victini',
  'ツタージャ': 'tsutaaja',
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

// 収録弾は新しい順。SV11B(2025-06)はM1(2025-08)より古くSV2a等の旧弾より新しいので、
// メガ期(M系)の後ろ・旧弾(pokecen以降)の前に差し込む。
const insertAt = d.boxes.findIndex((b) => b.box_id === 'pokecen_pikachu')
d.boxes.splice(insertAt < 0 ? d.boxes.length : insertAt, 0, box)
d.cards.push(...cards)

fs.writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n', 'utf-8')
console.log(`追加: box=${box.box_name} (${box.code}) / cards=${cards.length}枚`)
for (const c of cards) console.log(`  ${c.card_no} ${c.rarity.padEnd(3)} ${c.card_name}  ${c.id}`)
console.log(`合計カード数: ${d.cards.length}`)
