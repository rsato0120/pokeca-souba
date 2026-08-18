// ハイクラスパック シャイニートレジャーex（SV4a・2023-12-01発売）の高額チェイス18枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SV4a/{番号} で1枚ずつ確認（2026-08-19）。
// 選定基準＝遊々亭の買取一覧（https://yuyu-tei.jp/buy/poc/s/sv04a）の高額帯。
// UR(355-360)とSR(342-346)は買取50〜400円で薄商い＝メルカリ成約が取れず欠測になりやすいため見送り。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'shiny_treasure'
const PREFIX = 'shiny-treasure'
const TOTAL = '190'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV4a/SV4a_${n}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'シャイニートレジャーex',
  code: 'SV4a',
  release_ym: '2023-12',
  certainty: 'released',
  pack_price_yen: 550,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/b/ba/SV4a_Shiny_Treasure_ex_pack.png',
  note: '2023-12-01発売のハイクラスパック（1パック10枚・1BOX10パック）。色違いポケモンをS/SSRで大量収録した年末の総集編弾。2026年に絶版化して相場が再燃し、BOX買取は定価の約4倍まで上昇。ミュウex SAR(347)が最高額。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── S（色違いレア）──────────────────────────────────────────
  ['210', 'S', 'ヒトカゲ', 'charmander', '炎', 'たね', 70, 'sowsow', 'high', 'high', 'normal', 'none',
    'ワザ「まるやけ」=場のスタジアムをトラッシュ／「ひをはく」30ダメージ。',
    'sowsow の色違いヒトカゲ。リザードン系の進化前として単体でもコレクター需要が厚く、S帯ではピカチュウに次ぐ人気枠。'],
  ['236', 'S', 'ピカチュウ', 'pikachu', '雷', 'たね', 70, 'Yuu Nishida', 'high', 'high', 'normal', 'none',
    'ワザ「なきごえ」=次の相手の番、受けたポケモンのワザダメージ-20／「ピカボルト」30ダメージ。',
    '色違い（金色）ピカチュウ。S帯のトップ相場で、この弾のS枠を代表するカード。ピカチュウの色違いは常に別格の需要がある。'],
  ['265', 'S', 'ミミッキュ', 'mimikyu', '超', 'たね', 70, 'Nelnal', 'high', 'high', 'normal', 'low',
    '特性「しんぴのまもり」=ポケモンex・Vのワザダメージを受けない／ワザ「ゴーストアイ」=ダメカン7個。',
    '色違いミミッキュ。AR版(341)と同スペックで、同弾内に2種ある人気キャラ。S帯ではヒトカゲと並ぶ上位。'],

  // ── SSR（色違いスーパーレア）─────────────────────────────────
  ['327', 'SSR', 'ミュウex', 'mew-ex', '超', 'たね', 180, 'aky CG Works', 'mid', 'high', 'normal', 'mid',
    '特性「リスタート」=手札が3枚になるまで引く／ワザ「ゲノムハック」=相手のワザをコピー。',
    '色違いミュウexのSSR。SAR(347)と同カードで、SAR高騰の受け皿としてSSR帯トップ相場。'],
  ['328', 'SSR', 'サーナイトex', 'gardevoir-ex', '超', '2進化ポケモン', 310, 'N-DESIGN Inc.', 'mid', 'high', 'normal', 'mid',
    '特性「サイコエンブレイス」=トラッシュから基本超エネを付けダメカン2個／ワザ「ミラクルフォース」190。',
    '色違いサーナイトexのSSR。サーナイトはイラスト人気・キャラ人気とも高くSSR帯の上位。'],
  ['331', 'SSR', 'リザードンex', 'charizard-ex', '悪', '2進化ポケモン', 330, '5ban Graphics', 'high', 'high', 'normal', 'high',
    '特性「れんごくしはい」=進化時に基本炎エネを3枚まで加速／ワザ「バーニングダーク」=180＋相手のサイド枚数×30。',
    '色違い（黒銀）リザードンexのSSR。黒炎の支配者の看板カードの色違い版で、ミュウexSSRと並ぶSSR帯トップ。'],

  // ── AR ───────────────────────────────────────────────────────
  ['338', 'AR', 'ウミトリオ', 'wugtrio', '水', '1進化ポケモン', 90, 'Tetsu Kayama', 'mid', 'mid', 'normal', 'none',
    'ワザ「ずつき」30／「うみほりトンネル」=コイン3回、オモテの数×3枚を相手の山札からトラッシュ。',
    '海底のトンネルを描いた描き下ろしAR。キャラ人気は中位でAR帯では下位寄りの相場。'],
  ['339', 'AR', 'イルカマン', 'palafin', '水', '1進化ポケモン', 150, 'akagi', 'mid', 'mid', 'normal', 'low',
    'ワザ「ジェットパンチ」30＋ベンチにも30／「ジャスティスキック」=ベンチから出た番のみ210ダメージ。',
    'マイティフォルムへの変身を描いたAR。パルデア新ポケモンでキャラ人気は中位。'],
  ['340', 'AR', 'パモ', 'pawmi', '雷', 'たね', 60, 'REND', 'mid', 'mid', 'normal', 'none',
    'ワザ「なぐる」10／「エレキック」20。',
    'REND による小動物系AR。かわいい系ARとして一定の需要があるが、キャラ人気は中位。'],
  ['341', 'AR', 'ミミッキュ', 'mimikyu', '超', 'たね', 70, 'Mitsuhiro Arita', 'high', 'high', 'normal', 'low',
    '特性「しんぴのまもり」=ポケモンex・Vのワザダメージを受けない／ワザ「ゴーストアイ」=ダメカン7個。',
    '初代カードの絵師・有田満弘によるミミッキュAR。作家人気とキャラ人気が重なり、この弾のAR帯で最高額。'],

  // ── SAR ──────────────────────────────────────────────────────
  ['347', 'SAR', 'ミュウex', 'mew-ex', '超', 'たね', 180, 'USGMEN', 'high', 'high', 'scarce', 'mid',
    'SSR(327)と同スペックの特別イラスト版。特性「リスタート」／ワザ「ゲノムハック」。',
    'USGMEN による幻想的な描き下ろし。この弾の最高額カードで、シャイニートレジャーexのチェイスそのもの。'],
  ['348', 'SAR', 'サーナイトex', 'gardevoir-ex', '超', '2進化ポケモン', 310, 'Kuroimori', 'high', 'high', 'normal', 'mid',
    'SSR(328)と同スペックの特別イラスト版。特性「サイコエンブレイス」／ワザ「ミラクルフォース」190。',
    'Kuroimori による幻想的なサーナイトSAR。女性的シルエットのポケモンSARは安定して高値がつく定番枠。'],
  ['349', 'SAR', 'リザードンex', 'charizard-ex', '悪', '2進化ポケモン', 330, 'AKIRA EGAWA', 'high', 'high', 'scarce', 'high',
    'SSR(331)と同スペックの特別イラスト版。特性「れんごくしはい」／ワザ「バーニングダーク」。',
    'AKIRA EGAWA による黒リザードンのSAR。ミュウexSARに次ぐこの弾の第2チェイスで、リザードン人気により長期的に堅い。'],
  ['350', 'SAR', 'ナンジャモ', 'iono', 'サポート', 'サポート', 0, 'hanabushi', 'high', 'high', 'normal', 'high',
    'サポート。おたがいに手札を山札の下にもどし、サイドの残り枚数ぶん引く。',
    'hanabushi による2枚目のナンジャモSAR（クレイバースト096とは別イラスト）。ナンジャモはポケカ全体でも屈指の人気キャラでトレーナーズSARの筆頭。'],
  ['351', 'SAR', 'ネモ', 'nemona', 'サポート', 'サポート', 0, 'aspara', 'high', 'mid', 'normal', 'mid',
    'サポート。自分の山札を3枚引く。',
    'aspara による躍動感のあるネモSAR。主人公のライバル枠で、女性キャラSARとして安定した需要がある。'],
  ['352', 'SAR', 'ネルケ', 'perrin', 'サポート', 'サポート', 0, 'Taiga Kayama', 'mid', 'mid', 'normal', 'low',
    'サポート。相手の手札を見て、その中のサポートの枚数×2枚ぶん山札を引く。',
    'DLC「碧の円盤」の写真家ネルケのSAR。登場が新しくキャラ人気が成熟していないため、SAR帯では下位寄りの相場。'],
  ['353', 'SAR', 'ペパー', 'arven', 'サポート', 'サポート', 0, 'aspara', 'high', 'mid', 'normal', 'high',
    'サポート。山札から「グッズ」と「ポケモンのどうぐ」を1枚ずつ手札に加える。',
    'aspara によるペパーSAR。構築での実需が長く続いた人気サポートだが、男性キャラのためSAR帯では中位。'],
  ['354', 'SAR', 'ボタン', 'penny', 'サポート', 'サポート', 0, 'aspara', 'high', 'high', 'normal', 'high',
    'サポート。自分の場のたねポケモン1匹を、ついているカードごと手札にもどす。',
    'aspara によるボタンSAR。スター団のボスで人気が高く、ナンジャモに次ぐトレーナーズSARの上位枠。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

// box を upsert（再実行できるように）
const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX) // 再実行できるよう既存分は入れ替え

for (const [no, rarity, name, slug, type, stage, hp, illus, illusPop, charPop, scarcity, usage, specNote, colNote] of ROWS) {
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
      player: { regulation_mark: 'G', rotation: 'far', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/SV4a/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-19）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
