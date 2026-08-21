// 拡張パック「25th ANNIVERSARY COLLECTION」（S8a・2021-10-22発売）の光り物9枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/S8a/{番号} で1枚ずつ確認（2026-08-21）。
// 030（ミュウ UR）だけは limitless に無いので、
//   ・スペックは TCGplayer の product 571822 details（productName で "Mew 030/028" を照合）
//   ・イラストレーターは bulbapedia "Mew (Celebrations 11)" の caption（Yuu Nishida）
//   ・画像は TCGplayer CDN
// で確認した。
//
// 選定: この弾は 001-017 が非キラ扱いの低額再録（実勢 ¥100〜300）で薄商いになるため落とし、
// RR/RRR/SR/UR の光り物だけを採る。025-028（ピカチュウV-UNION）は市場が「4枚1セット」でしか
// 流通せず、スクレイパーの除外パターン（"セット"/"4枚"）に必ず引っかかるので除外した。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'anniv_25th'
const PREFIX = 'anniv-25th'
const TOTAL = '028'

// 030 は limitless に無い（S8a_30 は 404）。TCGplayer CDN へフォールバック。
const TCG_PRODUCT = { 30: 571822 }
const img = (n) =>
  TCG_PRODUCT[Number(n)]
    ? `https://tcgplayer-cdn.tcgplayer.com/product/${TCG_PRODUCT[Number(n)]}_in_1000x1000.jpg`
    : `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/S8a/S8a_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: '25th ANNIVERSARY COLLECTION',
  code: 'S8a',
  release_ym: '2021-10',
  certainty: 'released',
  pack_price_yen: 297,
  packs_per_box: 16,
  pack_image_url: 'https://www.pokemon-card.com/ex/25th/assets/images/products/20210625-1-1.png',
  note: '2021-10-22発売、ポケモンカードゲーム25周年の記念弾（1パック5枚・全てキラカード／うち1枚は25th仕様の基本エネルギー・1BOX16パック・定価¥4,752）。歴代の伝説ポケモンとピカチュウを集めた28種構成で、ゴールド仕様のミュウUR（030/028）が単独のチェイス。4パック購入で「プロモカードパック 25th ANNIVERSARY edition」が1パックもらえるキャンペーンとセットで展開された。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, spec備考, collector備考]
const ROWS = [
  ['018', 'RR', 'ザシアンV', 'zacian-v', '超', 'たね', 220, 'Mitsuhiro Arita', 'high', 'high', 'out_of_print',
    '特性「けんのほうこう」=山札から超エネを1枚つけて自分の番を終える／ワザ「ストームスラッシュ」60+（超エネの数×30追加）。',
    '有田満弘による25th仕様のザシアンV。剣盾の看板伝説をシリーズ初代からの絵師が描いた1枚で、この弾のRR帯では最も評価が高い。'],
  ['019', 'RR', 'ザマゼンタV', 'zamazenta-v', '闘', 'たね', 220, 'Mitsuhiro Arita', 'high', 'mid', 'out_of_print',
    '特性「たてのうなり」=自分の闘ポケモンがVMAXから受けるダメージを-20／ワザ「ヘビーインパクト」150。',
    '有田満弘による25th仕様のザマゼンタV。ザシアン(018)と対になる1枚だが、キャラ人気ではザシアンに一歩譲る。'],
  ['020', 'RR', 'ピカチュウV', 'pikachu-v', '雷', 'たね', 190, 'HYOGONOSUKE', 'high', 'high', 'out_of_print',
    'ワザ「ボルテッカー」210（このポケモンにも30ダメージ）。',
    'HYOGONOSUKE による25thのピカチュウV。25周年の主役であるピカチュウの通常V枠で、絵師人気とキャラ人気の両方が乗る。'],
  ['021', 'RR', 'なみのりピカチュウV', 'surfing-pikachu-v', '雷', 'たね', 200, 'aky CG Works', 'mid', 'high', 'out_of_print',
    'ワザ「なみのり」150（水エネ3個）。雷ポケモンだが水エネで動く変則カード。',
    '旧裏面時代の「なみのりピカチュウ」を現代のVにしたカード。VMAX(022)と組で集められるため、単体でも一定の需要がある。'],
  ['022', 'RRR', 'なみのりピカチュウVMAX', 'surfing-pikachu-vmax', '雷', 'VMAX', 310, 'aky CG Works', 'mid', 'high', 'out_of_print',
    'ワザ「ダイサーフ」160（相手のベンチ全員にも30ダメージ）。',
    'なみのりピカチュウVMAX。サーフボードに乗るピカチュウの構図が人気で、そらをとぶ(024)と並ぶこの弾のVMAX2枚看板の片方。'],
  ['023', 'RR', 'そらをとぶピカチュウV', 'flying-pikachu-v', '雷', 'たね', 190, 'aky CG Works', 'mid', 'high', 'out_of_print',
    'ワザ「でんきショック」20（コインでマヒ）／「そらをとぶ」120（コインでウラなら失敗、オモテならワザのダメージ・効果を受けない）。',
    '旧裏面時代の「そらをとぶピカチュウ」を現代のVにしたカード。風船で飛ぶピカチュウのイラストで、なみのり側と同格の扱い。'],
  ['024', 'RRR', 'そらをとぶピカチュウVMAX', 'flying-pikachu-vmax', '雷', 'VMAX', 310, 'aky CG Works', 'mid', 'high', 'out_of_print',
    'ワザ「ダイバルーン」160（次の相手の番、たねポケモンからワザのダメージを受けない）。',
    'そらをとぶピカチュウVMAX。巨大な風船とピカチュウの構図が25周年らしい1枚で、なみのりVMAX(022)と人気を二分する。'],
  ['029', 'SR', '博士の研究', 'professors-research', 'サポート', 'サポート', 0, 'Ken Sugimori', 'high', 'high', 'out_of_print',
    'サポート。自分の手札をすべてトラッシュし、山札を7枚引く。',
    '杉森建が描くオーキド博士版「博士の研究」のSR。25周年に合わせて初代のキャラクターデザイナー本人が描いた唯一のトレーナーズで、この弾のSR枠。'],
  ['030', 'UR', 'ミュウ', 'mew', '超', 'たね', 60, 'Yuu Nishida', 'high', 'high', 'out_of_print',
    '特性「ふしぎなしっぽ」=山札の上6枚からグッズを1枚手札に／ワザ「サイコショット」30。',
    'ゴールド仕様のミュウUR。この弾で唯一のURであり、実質的な当たり枠。幻のポケモンの人気に加え、25周年記念パックの最高レアという記号性で長期的に堅い。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX)

for (const [no, rarity, name, slug, type, stage, hp, illus, illusPop, charPop, scarcity, specNote, colNote] of ROWS) {
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
      player: { regulation_mark: 'E', rotation: 'far', competitive_usage: 'none' },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/S8a/{番号}（030 は tcgplayer product 571822 と bulbapedia "Mew (Celebrations 11)"）で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-21）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
