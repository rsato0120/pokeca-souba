// タッグボルト（SM9・2018-12）の光物 SR/SA 14枚（096-109）を pokeca_data.json に追加する。
// 画像は limitless が #1-109 を全てホストしている（#110以降はカード自体が存在しない）ため、
// S6a/S7R のような TCGplayer CDN フォールバックは不要。番号は先頭ゼロ無し。
//
// レアリティ区分: 各TAG TEAM GXに「通常SR(5ban Graphics)」と「SA(個人絵師)」の2種が存在する。
// 遊々亭など市場では両方"SR"表記だが、価格帯が一桁違うため本DBでは SA を分けて扱う（S6aと同方針）。
import * as fs from 'fs'

const DATA = 'data/pokeca_data.json'
const d = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const BOX_ID = 'tag_bolt'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM9/SM9_${n}_R_JP_LG.png`

const box = {
  box_id: BOX_ID,
  box_name: 'タッグボルト',
  code: 'SM9',
  release_ym: '2018-12',
  certainty: 'released',
  pack_price_yen: 162,
  packs_per_box: 30,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/0/0d/SM9_Tag_Bolt_pack.jpg',
  note: '2018-12-07発売のサン&ムーン期拡張パック。TAG TEAM GXが初登場した弾で、各GXに通常SRとスペシャルアート(SA)の2種が存在する。目玉はラティアス&ラティオスGX SA・ゲンガー&ミミッキュGX SA・ピカチュウ&ゼクロムGX SA。長期絶版で高騰。',
}

// [番号, カード名, レアリティ, タイプ, HP, 絵師, キャラ人気, 備考]
const DEFS = [
  [96,  'セレビィ&フシギバナGX',   'SR', '草',   270, '5ban Graphics',    'mid',  'TAG TEAM GX。通常イラストのSR。'],
  [97,  'セレビィ&フシギバナGX',   'SA', '草',   270, 'Shin Nagasawa',    'mid',  'TAG TEAM GXのスペシャルアート。'],
  [98,  'コイキング&ホエルオーGX', 'SR', '水',   300, '5ban Graphics',    'mid',  'TAG TEAM GX。通常イラストのSR。'],
  [99,  'コイキング&ホエルオーGX', 'SA', '水',   300, 'OOYAMA',           'mid',  'TAG TEAM GXのスペシャルアート。人気の高いチェイスカード。'],
  [100, 'ピカチュウ&ゼクロムGX',   'SR', '雷',   240, '5ban Graphics',    'high', 'TAG TEAM GX。当時環境を席巻した看板カードの通常SR。'],
  [101, 'ピカチュウ&ゼクロムGX',   'SA', '雷',   240, 'kawayoo',          'high', 'TAG TEAM GXのスペシャルアート。タッグボルトを代表するチェイスカード。'],
  [102, 'ゲンガー&ミミッキュGX',   'SR', '超',   240, '5ban Graphics',    'high', 'TAG TEAM GX。通常イラストのSR。'],
  [103, 'ゲンガー&ミミッキュGX',   'SA', '超',   240, 'Midori Harada',    'high', 'TAG TEAM GXのスペシャルアート。ゲンガー・ミミッキュ双方の人気が高く最上位クラスの相場。'],
  [104, 'ラティアス&ラティオスGX', 'SR', '竜',   250, '5ban Graphics',    'high', 'TAG TEAM GX。通常イラストのSR。'],
  [105, 'ラティアス&ラティオスGX', 'SA', '竜',   250, 'Sanosuke Sakuma',  'high', 'TAG TEAM GXのスペシャルアート。タッグボルト最高額帯のカード。'],
  [106, 'イーブイ&カビゴンGX',     'SR', '無色', 270, '5ban Graphics',    'high', 'TAG TEAM GX。SA版は存在せずSRのみ。'],
  [107, 'エリカのおもてなし',       'SR', 'サポート', 0, 'Sanosuke Sakuma', 'high', 'エリカが描かれたサポートSR。サポート枠では屈指の人気。'],
  [108, 'タケシのガッツ',           'SR', 'サポート', 0, 'Naoki Saito',     'mid',  'タケシが描かれたサポートSR。'],
  [109, 'ナツメの暗示',             'SR', 'サポート', 0, 'Hitoshi Ariga',   'mid',  'ナツメが描かれたサポートSR。'],
]

const SLUG = {
  'セレビィ&フシギバナGX': 'serebii-fushigibana-gx',
  'コイキング&ホエルオーGX': 'koiking-hoeruoo-gx',
  'ピカチュウ&ゼクロムGX': 'pikachu-zekrom-gx',
  'ゲンガー&ミミッキュGX': 'gengar-mimikyu-gx',
  'ラティアス&ラティオスGX': 'latias-latios-gx',
  'イーブイ&カビゴンGX': 'eevee-kabigon-gx',
  'エリカのおもてなし': 'erika-no-omotenashi',
  'タケシのガッツ': 'takeshi-no-gattsu',
  'ナツメの暗示': 'natsume-no-anji',
}

const cards = DEFS.map(([no, name, rarity, type, hp, illus, charPop, note]) => ({
  id: `${BOX_ID.replace(/_/g, '-')}-${SLUG[name]}-${rarity.toLowerCase()}-${no}`,
  card_no: `${String(no).padStart(3, '0')}/095`,
  rarity,
  card_name: name,
  box_id: BOX_ID,
  is_reprint: false,
  image_url: img(no),
  card_spec: {
    type,
    stage: type === 'サポート' ? 'サポート' : 'たねポケモン',
    hp,
    note,
  },
  materials: {
    // SM期はレギュレーションマーク導入前。スタン落ち済みだが本サイトは
    // コレクター相場特化のためプレイヤー材料は表示・予想に使わない。
    player: { regulation_mark: '', rotation: 'unknown', competitive_usage: 'none' },
    collector: {
      illustrator: illus,
      // 5ban Graphics は通常SRの版元表記で個人絵師人気とは別物のため unknown 扱い
      illustrator_popularity: illus === '5ban Graphics' ? 'unknown' : 'high',
      // 通常SRは基本セットGXと同一構図の流用、SAは描き下ろし
      artwork_type: rarity === 'SA' ? 'original' : 'reused',
      rarity,
    },
    common: {
      reprint_status: 'none',
      scarcity: 'out_of_print',
      character_popularity: charPop,
    },
  },
  evidence_notes: { player: '', collector: '', source: '' },
  note: '',
}))

// 冪等化: 既存の同一boxを一旦除去してから追加する
d.boxes = d.boxes.filter((b) => b.box_id !== BOX_ID)
d.cards = d.cards.filter((c) => c.box_id !== BOX_ID)

// 収録弾は新しい順に並んでいるので、旧弾は末尾側へ置く
d.boxes.push(box)
d.cards.push(...cards)

fs.writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n', 'utf-8')
console.log(`追加: box=${box.box_name} (${box.code}) / cards=${cards.length}枚`)
for (const c of cards) console.log(`  ${c.card_no} ${c.rarity.padEnd(2)} ${c.card_name}  ${c.id}`)
console.log(`合計カード数: ${d.cards.length}`)
