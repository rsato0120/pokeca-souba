// ハイクラスパック TAG TEAM GX タッグオールスターズ（SM12a・2019-10-04発売）の高額チェイス15枚を追加する。
// カード名/番号/HP/ワザ/イラストレーターは serebii.net/card/tagallstars/{番号}.shtml で1枚ずつ確認（2026-08-30）。
//
// ⚠ limitless はこの弾のカードページを 173 までしか持たない（シークレット174以降は404）。画像CDNは
//   211 付近まで生きているので画像だけ limitless、情報は serebii という組み合わせにしている。
// ⚠ HR(212-219)とUR(220-226)は画像CDNが403で入れられない。UR帯は買取¥4,000〜20,000と美味しいが、
//   S8b/S4a の時のような TCGplayer CDN 迂回が必要なので今回は見送った。
// ⚠ SR と SA の対（181/182・185/186・187/188）は**スニダンのタイトル表記で判別**した。
//   スニダンは SA版を「SR: SA」と書くので、番号照合と併せれば取り違えない。
// ⚠ 英名は JP と入れ替わる。「グリーンの戦略」= Blue's Tactics(193)、「ブルーの探索」= Green's Exploration(196)。
//   遊々亭やserebiiの英名をそのまま日本語に戻すと逆になるので注意。
// 選定基準＝遊々亭の買取一覧（yuyu-tei.jp/buy/poc/s/sm12a）の高額帯。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'tag_all_stars'
const PREFIX = 'tag-all-stars'
const TOTAL = '173'

const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM12a/SM12a_${n}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'タッグオールスターズ',
  code: 'SM12a',
  release_ym: '2019-10',
  certainty: 'released',
  pack_price_yen: 550,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/2/25/SM12a_Tag_All_Stars_pack.jpg',
  note: '2019-10-04発売のハイクラスパック（1パック10枚・1BOX10パック）。サン&ムーン期を締めくくる総集編で、TAG TEAM GXのSA・トレーナーSR・HR・URを大量に収録した。目玉はブラッキー&ダークライGX SAとかんこうきゃくSR。長期絶版でBOX相場は定価の約30倍。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, spec備考, collector備考]
const ROWS = [
  // ── SA（スペシャルアート）──────────────────────────────────
  ['182', 'SA', 'ブラッキー&ダークライGX', 'umbreon-darkrai-gx', '悪', 'たね', 270, 'so-taro', 'high', 'high',
    'TAG TEAM GX。ワザ「ブラックランス」／GXワザ「ダークムーンGX」。きぜつすると相手はサイドを3枚取る。',
    'この弾の単独トップ。買取¥90,000前後（スニダン販売¥78,000）。so-taro によるSAで、ブラッキー人気＋TAG TEAM SAの希少性が重なる。PSA10は4,824枚（鑑定総数6,419枚）。'],
  ['186', 'SA', 'トゲピー&ピィ&ププリンGX', 'togepi-cleffa-igglybuff-gx', 'フェアリー', 'たね', 240, '0313', 'high', 'high',
    'TAG TEAM GX。ワザ「ローリングパニック」／GXワザ。きぜつすると相手はサイドを3枚取る。',
    '買取¥25,000前後。0313 による人気の高いSAで、ベビィポケモン3体の絵柄がコレクター人気を集める。PSA10は3,372枚。'],
  ['188', 'SA', 'イーブイGX', 'eevee-gx', '無', 'たね', 160, 'Q-rais', 'high', 'high',
    'ワザ「アセンションDNA」。きぜつすると相手はサイドを2枚取る。',
    'Q-rais によるイーブイGXのSA。イーブイズを集める層の定番。スニダンの素体成約は2026-07下旬の¥48,000〜60,000から8月には¥98,000〜125,000へ上昇しており、この15枚で最も値動きが速い。SR版(187)との価格差は約18倍。PSA10は2,371枚。'],
  ['177', 'SA', 'エーフィ&デオキシスGX', 'espeon-deoxys-gx', '超', 'たね', 260, 'Hasuno', 'high', 'high',
    'TAG TEAM GX。ワザ「サイキッククラブ」。きぜつすると相手はサイドを3枚取る。',
    '買取¥18,000前後（スニダン販売¥53,000）。Hasuno によるSA。エーフィ人気で安定した需要がある。PSA10は3,155枚。'],
  ['179', 'SA', 'オーロット&ヨノワールGX', 'trevenant-dusknoir-gx', '超', 'たね', 270, 'PLANETA Tsuji', 'mid', 'mid',
    'TAG TEAM GX。ワザ「ナイトウォッチ」。きぜつすると相手はサイドを3枚取る。',
    '買取¥4,000前後。SA帯では下位だが、SR版(178)の買取¥900に対して約4.4倍でSAプレミアムは効いている。PSA10は1,029枚。'],

  // ── SR（トレーナー）─────────────────────────────────────────
  ['192', 'SR', 'かんこうきゃく', 'sightseer', 'サポート', 'サポート', 0, 'Naoki Saito', 'high', 'mid',
    'サポート。山札を上から3枚見て1枚を手札に、残りを山札の下に戻す。',
    'SAを除けばこの弾のトップ。買取¥60,000前後。斎藤ナオキによる「かんこうきゃく」で、モブキャラのSRという意外性からGX期屈指のコレクターズアイテムになった。PSA10は5,661枚（鑑定総数12,355枚とこの弾で最多）。'],
  ['190', 'SR', 'エリカのおもてなし', 'erikas-hospitality', 'サポート', 'サポート', 0, 'kodama', 'high', 'high',
    'サポート。相手のバトル場とベンチのポケモンの数だけカードを引く。',
    '買取¥30,000前後。kodama によるエリカのSR。タッグボルト(SM9 107)版とは別イラストで、こちらはこの弾の第2チェイス。PSA10は4,203枚。'],
  ['196', 'SR', 'ブルーの探索', 'greens-exploration', 'サポート', 'サポート', 0, 'TOKIYA', 'high', 'high',
    'サポート。自分の場にGXやEXがいない時、山札からトレーナーズを2枚まで手札に加える。英名は Green\'s Exploration。',
    '買取¥20,000前後。TOKIYA によるブルーのSR。初代ヒロインの人気銘柄。PSA10は3,725枚。'],
  ['191', 'SR', 'カスミ&カンナ', 'misty-lorelei', 'サポート', 'サポート', 0, 'Ryuta Fuse', 'high', 'high',
    'サポート。水ポケモンにエネルギーを付ける効果。英名は Misty & Lorelei。',
    '買取¥15,000前後。布施龍太によるカスミ＆カンナ。女性キャラ2人組のSRでコレクター需要が厚い。PSA10は3,414枚。'],
  ['201', 'SR', 'レッドの挑戦', 'reds-challenge', 'サポート', 'サポート', 0, 'TOKIYA', 'high', 'high',
    'サポート。山札からポケモンとサポートを1枚ずつ手札に加える。',
    '買取¥15,000前後。TOKIYA によるレッドのSR。初代主人公でブルーの探索(196)・グリーンの戦略(193)と3枚セットで集める層が多い。PSA10は2,543枚。'],
  ['193', 'SR', 'グリーンの戦略', 'blues-tactics', 'サポート', 'サポート', 0, 'TOKIYA', 'high', 'high',
    'サポート。手札のグッズの枚数だけカードを引く。英名は Blue\'s Tactics。',
    '買取¥12,000前後。TOKIYA によるグリーンのSR。初代3人組の中では最も安いが、揃えたい需要が下支えする。PSA10は2,525枚。'],

  // ── SR（ポケモン）───────────────────────────────────────────
  ['181', 'SR', 'ブラッキー&ダークライGX', 'umbreon-darkrai-gx', '悪', 'たね', 270, '5ban Graphics', 'mid', 'high',
    'TAG TEAM GX。ワザ「ブラックランス」／GXワザ「ダークムーンGX」。SA(182)と同スペックの通常SR。',
    '買取¥10,000前後。SA(182)の約9分の1だが、SR単体でも人気カード。PSA10は1,692枚。'],
  ['175', 'SR', 'デデンネGX', 'dedenne-gx', '雷', 'たね', 160, 'kanahei', 'high', 'high',
    '特性「デデチェンジ」＝手札を全て捨てて6枚引く。SM期からVSTAR期まで環境の必須カードだった。',
    '買取¥7,500前後。kanahei（カナヘイ）によるデデンネGXで、作家人気が突出している。競技での実需もあった。PSA10は3,636枚。'],
  ['185', 'SR', 'トゲピー&ピィ&ププリンGX', 'togepi-cleffa-igglybuff-gx', 'フェアリー', 'たね', 240, '5ban Graphics', 'mid', 'high',
    'TAG TEAM GX。ワザ「ローリングパニック」。SA(186)と同スペックの通常SR。',
    '買取¥4,000前後。SA(186)の約6分の1。PSA10は948枚とこの15枚で最も鑑定数が少ない。'],
  ['187', 'SR', 'イーブイGX', 'eevee-gx', '無', 'たね', 160, 'aky CG Works', 'mid', 'high',
    'ワザ「アセンションDNA」。SA(188)と同スペックの通常SR。',
    '買取¥2,400前後。SA(188)との差が約7.5倍と大きく、SR/SAの価格差を見る比較対象として置いている。PSA10は1,122枚。'],
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
      source: 'serebii.net/card/tagallstars/{番号}.shtml で名称・HP・ワザ・イラストレーターを1枚ずつ確認、SR/SAの別はスニダンのタイトル表記、相場は遊々亭(sm12a)買取一覧、PSA枚数は gemrate（2026-08-30）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
