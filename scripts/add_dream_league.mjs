// 強化拡張パック ドリームリーグ（SM11b・2019-08-02発売）の高額チェイス9枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SM11b/{番号} で1枚ずつ確認（2026-08-30）。
//
// ⚠ HR(069-072)とUR(073-075)は limitless の画像CDNが403（カードページも404）。UR帯は買取¥150〜1,500
//   と薄いので落として問題ないが、HRのソルガレオ&ルナアーラGX(070・買取¥8,000)は惜しい。
// ⚠ この弾は**GX期でスニダンの素体成約が唯一まともに流れている**。実測(2026-08-30・45日窓)で
//   リーリエの全力8件・レシラム&ゼクロムGX 8件・ソルルナGX 4件。価格帯も¥26,000〜45,000で
//   guardPrice が効く帯なので、他のGX期の弾と違ってスニダン由来の価格が入る見込み。
// ⚠ CHR（キャラクターレア）を初めて入れる弾。BoxCardList の RARITY_ORDER に 'CHR' を追加した。
// 選定基準＝遊々亭の買取一覧（yuyu-tei.jp/buy/poc/s/sm11b）の高額帯。シルヴァディGX SR(065)・
//   CHR の低額帯（買取¥50〜900）は薄商いで欠測しやすいので落とした。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'dream_league'
const PREFIX = 'dream-league'
const TOTAL = '049'

const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM11b/SM11b_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'ドリームリーグ',
  code: 'SM11b',
  release_ym: '2019-08',
  certainty: 'released',
  pack_price_yen: 162,
  packs_per_box: 30,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/9/9d/SM11b_Dream_League_pack.jpg',
  note: '2019-08-02発売の強化拡張パック（1パック5枚・1BOX30パック。定価は税込¥162で SM9タッグボルトと同じ）。GXのSRにトレーナーが一緒に描かれる構図と、CHR（キャラクターレア）を大量に収録したのが特徴で、絵柄人気だけで相場が作られている弾。目玉はソルガレオ&ルナアーラGX SR（リーリエ）とリーリエの全力SR。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, spec備考, collector備考]
const ROWS = [
  // ── SR 062-068 ───────────────────────────────────────────────
  ['063', 'SR', 'ソルガレオ&ルナアーラGX', 'solgaleo-lunala-gx', '超', 'たね', 270, 'Hideki Ishikawa', 'high', 'high',
    'TAG TEAM GX。ワザ「コズミックバーン」230／GXワザ「めがみのひかりGX」200。',
    'この弾のトップ。買取¥18,000前後。**リーリエが一緒に描かれた**構図が人気の中心で、スニダンでは素体が45日で4件動き、PSA10は45日で130件と全GX期で最も厚い。PSA10は10,917枚（鑑定総数14,300枚）。'],
  ['067', 'SR', 'メイ', 'rosa', 'サポート', 'サポート', 0, 'kirisAki', 'high', 'high',
    'サポート。英名は Rosa。',
    '買取¥15,000前後。kirisAki によるメイのSR。BW2の女主人公で、女性キャラSRの中でも根強い人気。出品が122件と板が厚い。PSA10は8,750枚。'],
  ['064', 'SR', 'レシラム&ゼクロムGX', 'reshiram-zekrom-gx', '竜', 'たね', 270, 'Naoki Saito', 'high', 'high',
    'TAG TEAM GX。ワザ「ダブルブレイズ」／GXワザ。',
    '買取¥14,000前後。斎藤ナオキによる、**Nが一緒に描かれた**構図。スニダンの素体成約が45日で8件とGX期では最多クラスで、価格がスニダン由来で入りやすい。PSA10は7,364枚。'],
  ['068', 'SR', 'リーリエの全力', 'lillies-full-force', 'サポート', 'サポート', 0, 'Noriko Uono', 'high', 'high',
    'サポート。英名は Lillie\'s Full Force。',
    '買取¥14,000前後。魚野純子によるリーリエのSR。がんばリーリエ(SM4+ 119)ほどではないが、リーリエSRとして安定した人気。出品223件はこの9枚で最多、スニダンの素体成約も45日で8件と厚い。PSA10は9,215枚（鑑定総数16,359枚）。'],
  ['062', 'SR', 'ラフレシアGX', 'vileplume-gx', '草', '2進化', 240, 'Kagemaru Himeno', 'high', 'mid',
    'ワザ「アレルギーボムGX」50。',
    '買取¥3,500前後。姫野かげまるによるラフレシアGX。旧世代からの人気イラストレーターで、SR帯の中位。PSA10は4,453枚。'],
  ['066', 'SR', 'Nの覚悟', 'ns-resolve', 'サポート', 'サポート', 0, 'Mana Ibe', 'mid', 'high',
    'サポート。英名は N\'s Resolve。',
    '買取¥2,000前後（スニダン販売¥6,900）。Nのサポートカード。レシラム&ゼクロムGX SR(064)と揃えたい需要がある。PSA10は3,152枚。'],

  // ── CHR（キャラクターレア）050-061 ───────────────────────────
  ['054', 'CHR', 'ピカチュウ', 'pikachu', '雷', 'たね', 70, 'Hitoshi Ariga', 'mid', 'high',
    'ワザ「ボルテッカー」70。キャラクターレア＝トレーナーが一緒に描かれる仕様。',
    'CHR帯のトップ。買取¥12,000前後（スニダン販売¥26,500）。有賀ヒトシによるピカチュウCHR。**PSA10は16,183枚（鑑定総数18,368枚）とこの弾で最も鑑定されている**カードで、鑑定市場の主役。'],
  ['058', 'CHR', 'ミミッキュ', 'mimikyu', '超', 'たね', 70, 'You Iribi', 'mid', 'high',
    'キャラクターレア。**アセロラが一緒に描かれた**構図。',
    '買取¥3,000前後（スニダン販売¥12,400）。ミミッキュ＋アセロラという人気の組み合わせで、買取と実勢の差が大きい銘柄。PSA10は11,249枚。'],
  ['052', 'CHR', 'ポッチャマ', 'piplup', '水', 'たね', 60, 'Tomomi Kaneko', 'mid', 'high',
    'ワザ「バブルホールド」80。キャラクターレア。',
    '買取¥4,000前後（スニダン販売¥11,000）。CHR帯ではピカチュウに次ぐ人気。PSA10は9,325枚。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX)

for (const [no, rarity, name, slug, type, stage, hp, illus, illusPop, charPop, specNote, colNote] of ROWS) {
  data.cards.push({
    id: `${PREFIX}-${slug}-${rarity.toLowerCase()}-${Number(no)}`,
    card_no: `${no}/${TOTAL}`,
    rarity,
    card_name: name,
    box_id: BOX,
    is_reprint: false,
    image_url: img(no),
    card_spec: { type, stage, hp, note: specNote },
    materials: {
      // SM期はレギュレーションマーク導入前。現行スタンダードでは使えないので競技採用は none
      player: { regulation_mark: '', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'out_of_print', character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/SM11b/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認、相場は遊々亭(sm11b)買取一覧とスニダン、PSA枚数は gemrate（2026-08-30）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
