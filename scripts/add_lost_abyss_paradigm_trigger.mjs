// ロストアビス（S11）とパラダイムトリガー（S12）の主要チェイスを追加する。
// 名称・番号・HP・タイプ・イラストレーターは Limitless の各カードページで確認。
// SA は同サイト上では Secret Rare だが、既存データの剣盾期分類に合わせ rarity='SA' とする。
import fs from 'node:fs'

const DATA = 'data/pokeca_data.json'
const PULL_RATES = 'data/pull-rates.json'
const SNKRDUNK_IDS = 'data/snkrdunk-ids.json'
const img = (set, no) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/${set}/${set}_${no}_R_JP_LG.png`

const BOXES = [
  {
    box_id: 'lost_abyss', box_name: 'ロストアビス', code: 'S11', release_ym: '2022-07',
    certainty: 'released', pack_price_yen: 165, packs_per_box: 30,
    pack_image_url: 'https://archives.bulbagarden.net/media/upload/c/c5/S11_Lost_Abyss_pack.jpg',
    note: '2022-07-15発売の拡張パック（1パック5枚・1BOX30パック）。ロストゾーン戦術が本格登場した弾で、Shinji KandaによるギラティナVのスペシャルアートが最大のチェイス。',
  },
  {
    box_id: 'paradigm_trigger', box_name: 'パラダイムトリガー', code: 'S12', release_ym: '2022-10',
    certainty: 'released', pack_price_yen: 165, packs_per_box: 30,
    pack_image_url: 'https://archives.bulbagarden.net/media/upload/b/b5/S12_Paradigm_Trigger_pack.jpg',
    note: '2022-10-21発売の拡張パック（1パック5枚・1BOX30パック）。ルギアVSTARとアーケオスの組み合わせが競技環境を席巻し、kawayooによるルギアVのスペシャルアートが最大のチェイス。',
  },
]

// box, set, 通番, rarity, 名前, slug, タイプ, stage, HP, illustrator, collector note
const ROWS = [
  ['lost_abyss', 'S11', '104', 'SA', 'ロトムV', 'rotom-v', '雷', 'ポケモンV', 190, 'Yuu Nishida', '家電に囲まれたロトムを描いた生活感のあるスペシャルアート。ロトム人気と構築実績の両方がある。'],
  ['lost_abyss', 'S11', '106', 'SA', 'プテラV', 'aerodactyl-v', '闘', 'ポケモンV', 210, 'Nurikabe', '太古のポケモンが暮らす景色を描いたスペシャルアート。ギラティナVに次ぐ弾内上位のチェイス。'],
  ['lost_abyss', 'S11', '109', 'SA', 'ガラル ニャイキングV', 'galarian-perrserker-v', '鋼', 'ポケモンV', 200, 'GOSSAN', '荒々しい船上の構図が特徴的なスペシャルアート。流通量が少なく、弾内SAの一角を占める。'],
  ['lost_abyss', 'S11', '111', 'SA', 'ギラティナV', 'giratina-v', '竜', 'ポケモンV', 220, 'Shinji Kanda', 'Shinji Kandaによる異世界的な構図。この弾を象徴する最高額チェイスで、海外需要も非常に厚い。'],
  ['lost_abyss', 'S11', '113', 'SR', 'アクロマの実験', 'colress-experiment', 'サポート', 'トレーナーズ', 0, 'Naoki Saito', 'ロストゾーン系デッキの中核サポート。Naoki Saitoのイラストと競技実績で需要が続く。'],
  ['lost_abyss', 'S11', '114', 'SR', 'おじょうさま', 'lady', 'サポート', 'トレーナーズ', 0, 'saino misaki', '女性トレーナーのフルアート。コレクター需要が強く、トレーナーズSRでは弾内上位。'],
  ['lost_abyss', 'S11', '120', 'HR', 'ギラティナVSTAR', 'giratina-vstar', '竜', 'ポケモンVSTAR', 280, '5ban Graphics', 'ギラティナVSTARのレインボー仕様。看板ポケモン需要と競技実績を持つ。'],
  ['lost_abyss', 'S11', '121', 'HR', 'アクロマの実験', 'colress-experiment', 'サポート', 'トレーナーズ', 0, 'Naoki Saito', 'アクロマの実験のHR版。SR版より流通は薄いが、ロスト系の象徴として収集需要がある。'],
  ['lost_abyss', 'S11', '122', 'HR', 'おじょうさま', 'lady', 'サポート', 'トレーナーズ', 0, 'saino misaki', 'おじょうさまのHR版。女性トレーナーのレインボー仕様として一定の需要がある。'],
  ['lost_abyss', 'S11', '125', 'UR', 'ギラティナVSTAR', 'giratina-vstar', '竜', 'ポケモンVSTAR', 280, '5ban Graphics', 'ギラティナVSTARのゴールド仕様。SA版ギラティナVと並ぶ看板カードの上位版。'],

  ['paradigm_trigger', 'S12', '103', 'SA', 'アンノーンV', 'unown-v', '超', 'ポケモンV', 180, 'Toshinao Aoki', '多数のアンノーンが遺跡を形作るスペシャルアート。独特の構図でコレクター人気が高い。'],
  ['paradigm_trigger', 'S12', '106', 'SA', 'スカタンクV', 'skuntank-v', '悪', 'ポケモンV', 210, 'Jiro Sasumo', '森の中のスカタンク一家を描いたスペシャルアート。背景まで作り込まれた一枚。'],
  ['paradigm_trigger', 'S12', '108', 'SA', 'レジドラゴV', 'regidrago-v', '竜', 'ポケモンV', 220, 'Hataya', '洞窟に佇むレジドラゴを描いたスペシャルアート。ドラゴン系コレクターから支持される。'],
  ['paradigm_trigger', 'S12', '110', 'SA', 'ルギアV', 'lugia-v', '無', 'ポケモンV', 220, 'kawayoo', '嵐の海を進むルギアを描いたkawayooの代表的スペシャルアート。この弾の最高額チェイス。'],
  ['paradigm_trigger', 'S12', '111', 'SR', 'さぎょういん', 'worker', 'サポート', 'トレーナーズ', 0, 'Yuu Nishida', '鉱山の作業員を描いたトレーナーズSR。実用性とキャラクター需要を兼ねる。'],
  ['paradigm_trigger', 'S12', '113', 'SR', 'スズナ', 'candice', 'サポート', 'トレーナーズ', 0, 'Naoki Saito', 'シンオウ地方の人気ジムリーダー。Naoki SaitoによるSRで、トレーナーズ枠の筆頭。'],
  ['paradigm_trigger', 'S12', '114', 'SR', 'ワタル', 'lance', 'サポート', 'トレーナーズ', 0, 'Ryuta Fuse', 'シリーズを代表するドラゴン使いのSR。初代世代からのキャラクター人気がある。'],
  ['paradigm_trigger', 'S12', '118', 'HR', 'ルギアVSTAR', 'lugia-vstar', '無', 'ポケモンVSTAR', 280, 'PLANETA Mochizuki', 'ルギアVSTARのレインボー仕様。競技環境で長く活躍した看板カード。'],
  ['paradigm_trigger', 'S12', '121', 'HR', 'スズナ', 'candice', 'サポート', 'トレーナーズ', 0, 'Naoki Saito', 'スズナのHR版。人気トレーナーのレインボー仕様として収集対象になる。'],
  ['paradigm_trigger', 'S12', '123', 'UR', 'ルギアVSTAR', 'lugia-vstar', '無', 'ポケモンVSTAR', 280, 'PLANETA Mochizuki', 'ルギアVSTARのゴールド仕様。SA版ルギアVと並ぶ弾内の代表カード。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))
for (const box of BOXES) {
  const index = data.boxes.findIndex((b) => b.box_id === box.box_id)
  if (index >= 0) data.boxes[index] = box
  else data.boxes.push(box)
}

const targetBoxes = new Set(BOXES.map((b) => b.box_id))
data.cards = data.cards.filter((card) => !targetBoxes.has(card.box_id))
for (const [box, set, no, rarity, name, slug, type, stage, hp, illustrator, collector] of ROWS) {
  data.cards.push({
    id: `${box.replaceAll('_', '-')}-${slug}-${rarity.toLowerCase()}-${Number(no)}`,
    card_no: `${no}/${set === 'S11' ? '100' : '098'}`,
    rarity,
    card_name: name,
    box_id: box,
    is_reprint: false,
    image_url: img(set, no),
    card_spec: { type, stage, hp, note: '' },
    materials: {
      player: { regulation_mark: 'F', rotation: 'out', competitive_usage: ['ギラティナV', 'アクロマの実験', 'ルギアV', 'ルギアVSTAR'].includes(name) ? 'high' : 'low' },
      collector: { illustrator, illustrator_popularity: ['Shinji Kanda', 'Naoki Saito', 'kawayoo'].includes(illustrator) ? 'high' : 'mid', artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: rarity === 'SA' || rarity === 'UR' ? 'scarce' : 'normal', character_popularity: ['ギラティナV', 'ギラティナVSTAR', 'ルギアV', 'ルギアVSTAR', 'スズナ'].includes(name) ? 'high' : 'mid' },
    },
    evidence_notes: {
      player: '', collector,
      source: `limitlesstcg.com/cards/jp/${set}/${Number(no)} で名称・番号・HP・タイプ・ステージ・イラストレーターを確認（2026-09-02）`,
    },
    note: '',
  })
}
fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')

const rates = JSON.parse(fs.readFileSync(PULL_RATES, 'utf-8'))
for (const box of BOXES) {
  rates.boxes[box.box_id] = {
    confidence: 'estimated',
    source: '同世代の剣盾期拡張パック開封統計からの外挿。収録種類数はシークレット番号帯から確定',
    source_url: 'https://pokemon-infomation.com/pull-rates-eeveeheroes/',
    groups: [
      { id: 'sr_poke', label: 'SR（ポケモンV）', rarity: 'SR', stages: ['ポケモンV'], kinds: 8, per_card: 0.05 },
      { id: 'sr_support', label: 'SR（サポート）', rarity: 'SR', stages: ['トレーナーズ'], kinds: 4, per_card: 0.075 },
      { id: 'sa_v', label: 'SA（ポケモンV）', rarity: 'SA', stages: ['ポケモンV'], kinds: 4, per_card: 0.038 },
      { id: 'hr_poke', label: 'HR（ポケモン）', rarity: 'HR', stages: ['ポケモンVMAX', 'ポケモンVSTAR'], kinds: 4, per_card: 0.025 },
      { id: 'hr_support', label: 'HR（サポート）', rarity: 'HR', stages: ['トレーナーズ'], kinds: 4, per_card: 0.05 },
      { id: 'ur', label: 'UR', rarity: 'UR', kinds: 3, per_card: 0.025 },
    ],
  }
}
fs.writeFileSync(PULL_RATES, JSON.stringify(rates, null, 2) + '\n', 'utf-8')

// 検索結果のタイトルに弾コードとカード番号が一致することを確認した商品だけを登録する。
const snkrdunkIds = JSON.parse(fs.readFileSync(SNKRDUNK_IDS, 'utf-8'))
Object.assign(snkrdunkIds, {
  'lost-abyss-rotom-v-sa-104': 93375,
  'lost-abyss-aerodactyl-v-sa-106': 93378,
  'lost-abyss-galarian-perrserker-v-sa-109': 96624,
  'lost-abyss-giratina-v-sa-111': 93379,
  'lost-abyss-colress-experiment-sr-113': 93377,
  'lost-abyss-lady-sr-114': 93374,
  'lost-abyss-giratina-vstar-hr-120': 96559,
  'lost-abyss-colress-experiment-hr-121': 96629,
  'lost-abyss-lady-hr-122': 96627,
  'lost-abyss-giratina-vstar-ur-125': 93380,
  'paradigm-trigger-unown-v-sa-103': 100560,
  'paradigm-trigger-skuntank-v-sa-106': 100563,
  'paradigm-trigger-regidrago-v-sa-108': 100565,
  'paradigm-trigger-lugia-v-sa-110': 100567,
  'paradigm-trigger-worker-sr-111': 100568,
  'paradigm-trigger-candice-sr-113': 100570,
  'paradigm-trigger-lance-sr-114': 100571,
  'paradigm-trigger-lugia-vstar-hr-118': 100575,
  'paradigm-trigger-candice-hr-121': 100578,
  'paradigm-trigger-lugia-vstar-ur-123': 100580,
  'box-lost_abyss-shrink': 86213,
  'box-paradigm_trigger-shrink': 97143,
})
fs.writeFileSync(SNKRDUNK_IDS, JSON.stringify(snkrdunkIds, null, 2) + '\n', 'utf-8')

const ids = data.cards.map((card) => card.id)
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
console.log(`追加完了: ${BOXES.length} BOX / ${ROWS.length} cards（総数 ${data.boxes.length} BOX / ${data.cards.length} cards）`)
console.log(duplicates.length ? `重複ID: ${duplicates.join(', ')}` : 'ID重複なし')
