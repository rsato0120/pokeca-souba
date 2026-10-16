import fs from 'node:fs'
// Product names, contents and release: https://www.30th.pokemon-card.com/product/cardset?slide=modal
// Exact product/card IDs: https://snkrdunk.com/articles/32998/ (2026-10-16)
const sets = [
  {
    "region": "kanto",
    "regionName": "カントー",
    "productId": 890731,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/8c930aa3-9260-428b-aab1-4c7ca3c1b9e1.webp?size=l",
    "cards": [
      {
        "name": "フシギダネ",
        "number": 101,
        "id": 890740,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_101_aumftuat.png"
      },
      {
        "name": "ヒトカゲ",
        "number": 102,
        "id": 890741,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_102_pt9obsca.png"
      },
      {
        "name": "ゼニガメ",
        "number": 103,
        "id": 890742,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_103_4ewh05a9.png"
      }
    ]
  },
  {
    "region": "johto",
    "regionName": "ジョウト",
    "productId": 890732,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/4c806c20-747b-432c-aea3-874c870fb53c.webp?size=l",
    "cards": [
      {
        "name": "チコリータ",
        "number": 104,
        "id": 890743,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_104_0hjzlyap.png"
      },
      {
        "name": "ヒノアラシ",
        "number": 105,
        "id": 890744,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_105_d69y7lqp.png"
      },
      {
        "name": "ワニノコ",
        "number": 106,
        "id": 890745,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_106_cn01nfwy.png"
      }
    ]
  },
  {
    "region": "hoenn",
    "regionName": "ホウエン",
    "productId": 890733,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/8e8d51e6-6058-42d4-ad91-bf8f01b643b4.webp?size=l",
    "cards": [
      {
        "name": "キモリ",
        "number": 107,
        "id": 890746,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_107_fo9kbv0z.png"
      },
      {
        "name": "アチャモ",
        "number": 108,
        "id": 890747,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_108_w8uo5010.png"
      },
      {
        "name": "ミズゴロウ",
        "number": 109,
        "id": 890748,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_109_tddzzzgs.png"
      }
    ]
  },
  {
    "region": "sinnoh",
    "regionName": "シンオウ",
    "productId": 890734,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/8638fa2d-3eae-4874-aee0-7a9ed1c03ed2.webp?size=l",
    "cards": [
      {
        "name": "ナエトル",
        "number": 110,
        "id": 890749,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_110_8vcdtj1b.png"
      },
      {
        "name": "ヒコザル",
        "number": 111,
        "id": 890750,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_111_k6lf6kih.png"
      },
      {
        "name": "ポッチャマ",
        "number": 112,
        "id": 890751,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_112_omlkqn9k.png"
      }
    ]
  },
  {
    "region": "unova",
    "regionName": "イッシュ",
    "productId": 890735,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/328c182d-e3fc-4b1a-99e3-656cb37fb5c3.webp?size=l",
    "cards": [
      {
        "name": "ツタージャ",
        "number": 113,
        "id": 890752,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_113_hu6x7wmd.png"
      },
      {
        "name": "ポカブ",
        "number": 114,
        "id": 890753,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_114_n28qwgxs.png"
      },
      {
        "name": "ミジュマル",
        "number": 115,
        "id": 890754,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_115_mnrfal5b.png"
      }
    ]
  },
  {
    "region": "kalos",
    "regionName": "カロス",
    "productId": 890736,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/1276fe4e-ca83-4107-a12e-0c2693bb1b1e.webp?size=l",
    "cards": [
      {
        "name": "ハリマロン",
        "number": 116,
        "id": 890755,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_116_ot4rv5w3.png"
      },
      {
        "name": "フォッコ",
        "number": 117,
        "id": 890756,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_117_4wk6z26d.png"
      },
      {
        "name": "ケロマツ",
        "number": 118,
        "id": 890757,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_118_s38jcptz.png"
      }
    ]
  },
  {
    "region": "alola",
    "regionName": "アローラ",
    "productId": 890737,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/98afdacd-304e-4d17-8de7-a2c4aa335127.webp?size=l",
    "cards": [
      {
        "name": "モクロー",
        "number": 119,
        "id": 890758,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_119_7t38ep1y.png"
      },
      {
        "name": "ニャビー",
        "number": 120,
        "id": 890759,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_120_f25bwe3z.png"
      },
      {
        "name": "アシマリ",
        "number": 121,
        "id": 890760,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_121_4bs8bu09.png"
      }
    ]
  },
  {
    "region": "galar",
    "regionName": "ガラル",
    "productId": 890738,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/d28f8656-cc07-4541-990d-6b415126b466.webp?size=l",
    "cards": [
      {
        "name": "サルノリ",
        "number": 122,
        "id": 890761,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_122_k336sfa5.png"
      },
      {
        "name": "ヒバニー",
        "number": 123,
        "id": 890762,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_123_m073z7hq.png"
      },
      {
        "name": "メッソン",
        "number": 124,
        "id": 890763,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_124_nth0rgfs.png"
      }
    ]
  },
  {
    "region": "paldea",
    "regionName": "パルデア",
    "productId": 890739,
    "image": "https://cdn.snkrdunk.com/upload_bg_removed/a530a052-e917-48ac-9f9b-a8ec0e85d20b.webp?size=l",
    "cards": [
      {
        "name": "ニャオハ",
        "number": 125,
        "id": 890764,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_125_b775ygf7.png"
      },
      {
        "name": "ホゲータ",
        "number": 126,
        "id": 890765,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_126_i1s034lw.png"
      },
      {
        "name": "クワッス",
        "number": 127,
        "id": 890766,
        "image": "https://www.30th.pokemon-card.com/images/cardset/cards/promo_127_m6p8f3c0.png"
      }
    ]
  }
]
const catalog = JSON.parse(fs.readFileSync('data/pokeca_data.json', 'utf8'))
const ids = JSON.parse(fs.readFileSync('data/snkrdunk-ids.json', 'utf8'))
for (const set of sets) {
  const boxId = '30th_card_set_' + set.region
  const names = set.cards.map(c => c.name).join('・')
  if (!catalog.boxes.some(b => b.box_id === boxId)) catalog.boxes.push({
    box_id: boxId, box_name: '30th CELEBRATION カードセット ' + names,
    code: 'M-P', release_ym: '2026-10', release_date: '2026-10-16', certainty: 'released',
    pack_price_yen: 360, msrp_yen: 1200, pack_image_url: set.image,
    note: set.regionName + '地方の御三家プロモカード3枚、30th CELEBRATION 2パック、紙製カードスタンド1個。定価1,200円（税込）。セット相場は未開封商品を追跡。https://www.30th.pokemon-card.com/product/cardset?slide=modal',
  })
  ids['box-' + boxId] = set.productId
  for (const c of set.cards) {
    const id = '30th-card-set-' + c.number
    if (!catalog.cards.some(card => card.id === id)) catalog.cards.push({
      id, box_id: boxId, card_name: c.name, card_no: c.number + '/M-P', rarity: 'PROMO',
      is_reprint: false, image_url: c.image,
      card_spec: { type: '未確認', stage: 'たね', hp: 0, note: '30th CELEBRATION カードセット封入のキラプロモ。' },
      materials: {
        player: { regulation_mark: 'unknown', rotation: 'unknown', competitive_usage: 'none' },
        collector: { illustrator: 'unknown', illustrator_popularity: 'unknown', artwork_type: 'original', rarity: 'PROMO' },
        common: { reprint_status: 'none', scarcity: 'normal', character_popularity: 'high' },
      },
      evidence_notes: { player: '対戦性能は未評価。', collector: set.regionName + '地方の最初のパートナーポケモン。', source: '2026-10-16 公式商品画像・カード番号照合：https://www.30th.pokemon-card.com/product/cardset?slide=modal / https://snkrdunk.com/apparels/' + c.id },
      note: '開封済みプロモ単体の成約を追跡。未開封セットや他番号の同名カードとは混在させない。',
    })
    ids[id] = c.id
  }
}
fs.writeFileSync('data/pokeca_data.json', JSON.stringify(catalog, null, 2) + '\n')
fs.writeFileSync('data/snkrdunk-ids.json', JSON.stringify(ids, null, 2) + '\n')
console.log('御三家セット9種・プロモ27枚を登録（価格は実成約取得で保存）')
