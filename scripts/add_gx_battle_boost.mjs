// ハイクラスパック GXバトルブースト（SM4+・2017-10-20発売）の高額チェイス3枚を追加する。
// カード名/番号/効果/イラストレーターは limitlesstcg.com/cards/jp/SM4p/{番号} で1枚ずつ確認（2026-08-30）。
//
// ⚠ limitless の弾コードは「+」ではなく**小文字の p**（SM4+ → SM4p、SM3+ → SM3p）。
//   "SM4+" や "SM4%2B" は403、"SM4P"（大文字P）も403で、小文字だけが通る。
// ⚠ 画像CDNは 115-120（SR帯）までで、HR(121-123)とUR(124-125)は403。ただしHR/URは
//   買取¥400〜3,000と薄いので、画像が無くても実害はない。
// ⚠ **3枚しか入れていない**。この弾は高額帯が極端で、119/120/118 の3枚（¥34,800〜¥302,500）の
//   次が UR ¥4,980、その先は¥2,690以下。¥50〜500のSR(115-117)を足しても薄商いで欠測するだけ
//   なので落とした（pokecen_pikachu も3枚なので最小構成としては前例がある）。
// ⚠ がんばリーリエ(119)は**スニダンの素体成約が90日で0件**。出品は54件あるのに売れておらず、
//   動いているのはPSA10だけ（45日で19件・中央値¥2,970,000）。素体価格はメルカリ頼みになる。
//   メルカリ側も¥6,199〜¥3,000,000 と50倍のレンジなので、guardPrice が弾く可能性が高い。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'gx_battle_boost'
const PREFIX = 'gx-battle-boost'
const TOTAL = '114'

const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM4p/SM4p_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'GXバトルブースト',
  code: 'SM4+',
  release_ym: '2017-10',
  certainty: 'released',
  pack_price_yen: 540,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/6/6b/SM4Plus_GX_Battle_Boost_pack.jpg',
  note: '2017-10-20発売のハイクラスパック（希望小売価格500円＋税・1パック10枚・1BOX10パック）。全てキラカードで、ポケモンGXが1パックに1枚確定。当たりはSR6種/HR3種/UR2種の11種だけと少ないが、その筆頭が「がんばリーリエ」で、ポケカ史上でも屈指の高額カードになった。未開封BOXは買取¥900,000前後と成約がほぼ無い水準。',
}

// [番号, レアリティ, カード名, slug, イラストレーター, 絵師人気, キャラ人気, spec備考, collector備考]
const ROWS = [
  ['119', 'SR', 'リーリエ', 'lillie', 'Naoki Saito', 'high', 'high',
    'サポート。自分の手札が6枚になるように山札を引く。最初の自分の番に使ったなら8枚になるように引く。',
    '通称「がんばリーリエ」。メルカリの成約平均¥402,143・最安出品¥332,222（2026-08-30実測）で、遊々亭の買取が¥400,000前後。斎藤ナオキによるリーリエで、ポケカで最も知られた高額カードの一枚。PSA10は1,212枚（鑑定総数3,164枚・GEM率38%）と鑑定が通りにくく、PSA10の相場は¥2,970,000前後まで離れる。⚠スニダンでは素体の成約が90日で0件（出品は54件あるが売れていない）＝値段が付くのはPSA10だけで、素体価格はメルカリ頼み。'],
  ['120', 'SR', 'ルザミーネ', 'lusamine', 'You Iribi', 'mid', 'high',
    'サポート。自分のトラッシュにあるサポートとスタジアムを合計2枚、相手に見せてから手札に加える。',
    '買取¥48,000／販売¥75,800前後。この弾の第2チェイス。リーリエの母という設定でセット需要がある。PSA10は880枚（鑑定総数3,411枚・GEM率26%）とがんばリーリエより通りにくい。'],
  ['118', 'SR', 'スイレン', 'lana', 'Kanako Eo', 'mid', 'high',
    'サポート。[水]エネルギーがついている自分のポケモン全員のHPを、それぞれ「50」回復する。',
    '買取¥20,000／販売¥34,800前後。第3チェイス。SM期の島キング/クイーン系サポートSRの中では上位。PSA10は624枚（鑑定総数2,764枚・GEM率23%）と、この3枚で最も鑑定が通りにくい。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX)

for (const [no, rarity, name, slug, illus, illusPop, charPop, specNote, colNote] of ROWS) {
  data.cards.push({
    id: `${PREFIX}-${slug}-${rarity.toLowerCase()}-${Number(no)}`,
    card_no: `${no}/${TOTAL}`,
    rarity,
    card_name: name,
    box_id: BOX,
    is_reprint: false,
    image_url: img(no),
    card_spec: { type: 'サポート', stage: 'サポート', hp: 0, note: specNote },
    materials: {
      // SM期はレギュレーションマーク導入前。現行スタンダードでは使えないので競技採用は none
      player: { regulation_mark: '', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'out_of_print', character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/SM4p/{番号} で名称・番号・効果・イラストレーターを確認、相場は遊々亭(sm04plus)買取一覧とポケカジラ販売一覧、PSA枚数は gemrate（2026-08-30）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
