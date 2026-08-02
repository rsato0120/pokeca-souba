// ストームエメラルダ（M6・2026-07-31発売）のシークレット枠37枚を pokeca_data.json に追加する。
// カード名/番号/HP/タイプ/イラストレーターは pokeca.net の実カード画像（m6/077-113.jpg）を目視して確定。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'storm_emeralda'
const PREFIX = 'storm-emeralda'
const TOTAL = '076'
const img = (n) => `https://www.pokeca.net/data/pokeca/product/m6/${n}.jpg`

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── AR 077-088 ───────────────────────────────────────────────
  ['077', 'AR', 'アメモース', 'masquerain', '草', '1進化', 110, 'REND', 'mid', 'mid', 'normal', 'low',
    'ワザ「バグパニック」=山札を下から7枚オモテにし、同名ワザ持ちの枚数×50ダメージ。',
    '雨上がりの森を背景にした描き下ろしAR。アメモースはキャラ知名度が中位で、AR帯では下位価格になりやすい。'],
  ['078', 'AR', 'ガーディ', 'growlithe', '炎', 'たね', 80, 'Yoshimoto Yoshimon', 'mid', 'high', 'normal', 'none',
    'ワザ「ほえる」で相手のバトルポケモンを入れ替え。',
    '室内のドアからのぞくガーディの生活感ある描き下ろし。ガーディ／ウインディはファン人気が厚くAR需要が読める。'],
  ['079', 'AR', 'ブーバーン', 'magmortar', '炎', '1進化', 140, 'Taiga Kasai', 'mid', 'mid', 'normal', 'low',
    '特性「バディブースト」=基本炎/雷エネを手札からエレキブルかブーバーンにつける。',
    'エレキブル(081)と対になる火山のAR。ペア収集需要はあるがキャラ人気は中位。'],
  ['080', 'AR', 'カイオーガ', 'kyogre', '水', 'たね', 150, 'Nurikabe', 'mid', 'high', 'normal', 'low',
    'ワザ「あらぶるうず」=「伝説」とつくスタジアムが出ていればベンチにも50ダメージ。',
    'グラードン(084)と対になる伝説ポケモンAR。ホウエン伝説の看板でAR帯の上位相場が期待できる。'],
  ['081', 'AR', 'エレキブル', 'electivire', '雷', '1進化', 140, 'Rianti Hidayat', 'mid', 'mid', 'normal', 'low',
    'ワザ「ボルテージハンマー」=ついている基本エネをトラッシュした枚数×60ダメージ。',
    '幾何学的な色面で構成された個性的な描き下ろし。ブーバーン(079)と対のAR。'],
  ['082', 'AR', 'バチンウニ', 'pincurchin', '雷', 'たね', 80, 'Tetsu Kayama', 'mid', 'mid', 'normal', 'none',
    'ワザ「エナジークラッシュ」=相手全員についているエネルギーの数×20ダメージ。',
    '海底の群れを描いた背景重視のAR。キャラ人気は限定的で低位相場になりやすい。'],
  ['083', 'AR', 'ラブトロス', 'enamorus', '超', 'たね', 120, 'Taira Akitsu', 'mid', 'mid', 'normal', 'low',
    '特性「けしんだんけつ」=場に化身トリオ／ラブトロスがいれば無色エネなしでワザが使える。',
    'ハート型の雲が浮かぶ淡色のAR。化身フォルム系はコレクター層が薄めだがイラスト評価は高い。'],
  ['084', 'AR', 'グラードン', 'groudon', '闘', 'たね', 150, 'Ryota Murayama', 'mid', 'high', 'normal', 'low',
    'ワザ「あらぶるだいち」=「伝説」とつくスタジアムが出ていれば170ダメージ追加。',
    'カイオーガ(080)と対の伝説AR。溶岩の中の咆哮を描いた迫力構図で、AR帯トップ級の相場が付いている。'],
  ['085', 'AR', 'マーイーカ', 'inkay', '超', 'たね', 60, 'Rond', 'high', 'mid', 'normal', 'none',
    'ワザ「はたきおとす」=相手の手札からオモテを見ないで1枚トラッシュ。',
    'Rond の水彩調が映える海中のAR。メガカラマネロex(094)の進化前で、弾内の関連収集需要がある。'],
  ['086', 'AR', 'ルリリ', 'azurill', '無', 'たね', 30, 'Narumi Sato', 'mid', 'mid', 'normal', 'none',
    'ワザ「ぴょんぴょんチャージ」=山札からエネルギーをベンチにつける。',
    '花畑と丸太を描いた優しい画風の低HPかわいい系AR。ベビィポケモンARは根強い層がある。'],
  ['087', 'AR', 'チルタリス', 'altaria', '無', '1進化', 110, 'kodama', 'mid', 'mid', 'normal', 'low',
    '特性「コットンキャリー」=自分のたねポケモン全員のにげるエネルギーが0になる。',
    '青空と雲を背景にした爽やかな描き下ろし。チルタリスはイラスト映えでコレクター評価が安定。'],
  ['088', 'AR', 'カクレオン', 'kecleon', '無', 'たね', 90, 'Tomokazu Komiya', 'high', 'mid', 'normal', 'none',
    'ワザ「カラフルウイップ」=手札から見せたポケモンのタイプの数×30ダメージ。',
    'Tomokazu Komiya の極彩色クレヨン画。作家性の強さで買取上位に食い込むタイプのAR。'],

  // ── SR 089-106 ───────────────────────────────────────────────
  ['089', 'SR', 'メガグソクムシャex', 'mega-golisopod-ex', '草', 'メガシンカex', 340, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    'ワザ「とどめをさす」=相手にダメカンがのっていれば160ダメージ追加。HP340の高耐久メガシンカex。',
    'SAR(107)と同カードのSR版。SARに需要が集中しやすくSRは相対的に安価。'],
  ['090', 'SR', 'ヒートロトムex', 'heat-rotom-ex', '炎', 'ポケモンex', 190, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    'ワザ「さいかねつ」=トラッシュの基本炎エネの枚数×30ダメージ。',
    'ロトムのフォルムチェンジ系ex。SAR版が無いためSRが最上位版になる。'],
  ['091', 'SR', 'ヨワシex', 'wishiwashi-ex', '水', 'ポケモンex', 260, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    '特性「オーシャンゲイン」=バトル場にいるなら自分の番に1回HPを50回復。',
    'たねでHP260の耐久ex。SAR版なしでSRが最上位。キャラ人気は限定的。'],
  ['092', 'SR', 'ライコウex', 'raikou-ex', '雷', 'ポケモンex', 200, 'aky CG Works', 'mid', 'high', 'normal', 'mid',
    'ワザ「いかずちをまとう」=先攻最初の番でも使えるエネ加速。',
    'SAR(108)と同カードのSR版。ライコウは伝説三犬でキャラ人気が高く、SRでも一定の需要がある。'],
  ['093', 'SR', 'メガゴルーグex', 'mega-golurk-ex', '超', 'メガシンカex', 350, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    '特性「きどうせいげん」=手札が10枚以上のときしかワザが使えない。ワザ「ゴライアスパンチ」300ダメージ。',
    'この弾最高HP(350)のメガシンカex。SAR(109)が別レコード。'],
  ['094', 'SR', 'メガカラマネロex', 'mega-malamar-ex', '超', 'メガシンカex', 320, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    'ワザ「サイコマリオネット」=相手のベンチの数×70ダメージ。',
    'SAR版が無くSRが最上位版。マーイーカAR(085)と合わせた進化ライン収集の対象。'],
  ['095', 'SR', 'メガレックウザex', 'mega-rayquaza-ex', '無', 'メガシンカex', 280, '5ban Graphics', 'high', 'high', 'normal', 'high',
    '特性「はしゃのほうこう」＋ワザ「ストームエメラルダ」=味方全員の炎/雷エネの数×50ダメージ。弾の看板カード。',
    '弾名を冠した目玉カードのSR版。SAR(110)/MUR(113)に需要が集中するがSRも看板需要で下支えされる。'],
  ['096', 'SR', 'ファイアローex', 'talonflame-ex', '無', 'ポケモンex', 280, '5ban Graphics', 'high', 'mid', 'normal', 'high',
    '特性「エキサイトダイブ」=無色メガシンカexが場にいれば手札からベンチに出せる。メガレックウザexの相棒枠。',
    'メガレックウザexデッキの必須枠として実需が読める2進化ex。SAR版なし。'],
  ['097', 'SR', 'ぼうけんのランタン', 'adventure-lantern', 'グッズ', 'グッズ', 0, 'inose yukie', 'mid', 'mid', 'normal', 'mid',
    'グッズ。山札から基本炎エネと基本雷エネを1枚ずつ手札に加える。',
    'メガレックウザex専用のサーチグッズ。トレーナーズSRとしては構築需要で下支えされる。'],
  ['098', 'SR', 'ポケモンキャッチャー', 'pokemon-catcher', 'グッズ', 'グッズ', 0, 'Studio Bora Inc.', 'mid', 'mid', 'normal', 'mid',
    'グッズ。コインがオモテなら相手のベンチポケモンをバトル場に入れ替える。',
    '歴代何度も再録されている定番グッズの新規SR。旧イラストとの比較で相場は控えめ。'],
  ['099', 'SR', 'とくちゅうチョッキ', 'assault-vest', 'ポケモンのどうぐ', 'ポケモンのどうぐ', 0, 'Toyste Beach', 'mid', 'mid', 'normal', 'mid',
    'ポケモンのどうぐ。メガシンカexから受けるワザのダメージを-60。',
    'メガシンカex環境へのメタどうぐ。実需依存でイラスト面の訴求は小さい。'],
  ['100', 'SR', 'MCの盛り上げ', 'mc-hype', 'サポート', 'サポート', 0, 'DOM', 'mid', 'mid', 'normal', 'mid',
    'サポート。山札を2枚引く。相手のサイドが3枚以下ならさらに2枚引く。',
    '新規女性トレーナーのサポートSR。キャラ人気が付けば伸びるが初出のため未知数。'],
  ['101', 'SR', 'ギリー', 'gilly', 'サポート', 'サポート', 0, 'Sanosuke Sakuma', 'mid', 'mid', 'normal', 'mid',
    'サポート。山札からサポートとスタジアムを合計3枚まで手札に加える。',
    'SAR(111)と同キャラ。SRは通常構図でSAR版に需要が流れやすい。'],
  ['102', 'SR', 'ヒガナの信頼', 'zinnia-trust', 'サポート', 'サポート', 0, 'GIDORA', 'mid', 'high', 'normal', 'high',
    'サポート。バトルポケモンを入れ替え、エネルギー1個を新しいバトルポケモンにつけ替える。',
    'ヒガナはORAS人気キャラでトレーナーズ需要が厚い。SAR(112)が本命だがSRも上位相場。'],
  ['103', 'SR', 'フウとランの修行', 'tate-liza-training', 'サポート', 'サポート', 0, 'Yuu Nishida', 'mid', 'mid', 'normal', 'mid',
    'サポート。2枚引き、「伝説」とつくスタジアムが出ていれば手札にもどる。',
    'ホウエンのジムリーダー双子。懐かしさ需要はあるがキャラ人気は中位。'],
  ['104', 'SR', 'グロウ草エネルギー', 'grow-grass-energy', '草', '特殊エネルギー', 0, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    '特殊エネルギー。草エネルギー1個ぶんとしてはたらき、つけている草ポケモンの最大HPが+20される。',
    'エネルギーSRは実需中心で相場は低位安定。4枚揃え需要はある。'],
  ['105', 'SR', 'ニトロ炎エネルギー', 'nitro-fire-energy', '炎', '特殊エネルギー', 0, '5ban Graphics', 'high', 'mid', 'normal', 'high',
    '特殊エネルギー。炎エネルギー1個ぶんとしてはたらき、ワザの効果でトラッシュされたら手札にもどる。',
    'メガレックウザexデッキで採用が見込まれる炎特殊エネ。実需で他のエネSRより高くなりうる。'],
  ['106', 'SR', 'バブル水エネルギー', 'bubble-water-energy', '水', '特殊エネルギー', 0, '5ban Graphics', 'high', 'mid', 'normal', 'mid',
    '特殊エネルギー。水エネルギー1個ぶんとしてはたらき、つけている水ポケモンは特殊状態にならない。',
    'エネルギーSR3種の1枚。実需中心で低位安定。'],

  // ── SAR 107-112 ──────────────────────────────────────────────
  ['107', 'SAR', 'メガグソクムシャex', 'mega-golisopod-ex', '草', 'メガシンカex', 340, 'nagimiso', 'high', 'mid', 'normal', 'mid',
    'SR(089)と同スペックの特別イラスト版。HP340。',
    'nagimiso による極彩色のスラッシュ構図。作家人気が高くSAR帯の中位以上が期待される。'],
  ['108', 'SAR', 'ライコウex', 'raikou-ex', '雷', 'ポケモンex', 200, 'Oku', 'high', 'high', 'normal', 'mid',
    'SR(092)と同スペックの特別イラスト版。',
    'Oku の水墨調で岩場を駆けるライコウ。伝説三犬の人気と作家性が重なりSAR上位（メガレックウザexに次ぐ）。'],
  ['109', 'SAR', 'メガゴルーグex', 'mega-golurk-ex', '超', 'メガシンカex', 350, 'Takeshi Nakamura', 'mid', 'mid', 'normal', 'mid',
    'SR(093)と同スペックの特別イラスト版。HP350はこの弾最高。',
    '遺跡を背景にした重厚な描き下ろし。キャラ人気は中位でSAR帯では下位寄りの相場。'],
  ['110', 'SAR', 'メガレックウザex', 'mega-rayquaza-ex', '無', 'メガシンカex', 280, 'Kazuki Minami', 'high', 'high', 'scarce', 'high',
    'SR(095)と同スペックの特別イラスト版。弾の看板。',
    'レックウザとメガレックウザが交錯する構図。ホウエン最人気級の伝説でSAR最高額枠。MUR(113)に次ぐチェイス。'],
  ['111', 'SAR', 'ギリー', 'gilly', 'サポート', 'サポート', 0, 'Shimaris Yukichi', 'mid', 'mid', 'normal', 'mid',
    'SR(101)と同効果の特別イラスト版。フィールドを駆けるフルアート。',
    '新規キャラのためキャラ人気が未成熟。SAR帯では最も安価な枠になりやすい。'],
  ['112', 'SAR', 'ヒガナの信頼', 'zinnia-trust', 'サポート', 'サポート', 0, 'Teeziro', 'high', 'high', 'normal', 'high',
    'SR(102)と同効果の特別イラスト版。',
    'Teeziro による人気キャラ・ヒガナのフルアート。トレーナーズSARは女性キャラ人気で高騰しやすい定番枠。'],

  // ── MUR 113 ──────────────────────────────────────────────────
  ['113', 'MUR', 'メガレックウザex', 'mega-rayquaza-ex', '無', 'メガシンカex', 280, 'takuyoa', 'mid', 'high', 'scarce', 'high',
    'この弾の最高レアリティ。SR/SARと同スペック（HP280・ワザ「ストームエメラルダ」）でゴールド加工。',
    'ストームエメラルダ唯一のMUR。金加工＋レックウザ＋弾の看板が重なり、初動から最高額のチェイスカード。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))
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
      player: { regulation_mark: 'J', rotation: 'far', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: '実カード画像（pokeca.net m6）でカード名・番号・HP・タイプ・イラストレーターを確認（2026-07-31）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`storm_emeralda: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
