import fs from 'node:fs'

// 発売情報: https://altema.jp/pokemoncard/packlist
// 商品名: https://www.pokemon-card.com/ex/25th/chronicle/
// 価格履歴は作らず、既存の成約取得パイプラインで更新する。
const catalogPath = 'data/pokeca_data.json'
const idsPath = 'data/snkrdunk-ids.json'
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'))
const sets = [
  ['holon_research_tower', 'ホロンの研究塔', 'PCG6', '2005-10-28', 26, 11],
  ['holon_phantom', 'ホロンの幻影', 'PCG7', '2006-01-27', 27, 10],
  ['miracle_crystal', 'きせきの結晶', 'PCG8', '2006-03-10', 28, 11],
  ['offense_defense_furthest_ends', 'さいはての攻防', 'PCG9', '2006-06-29', 29, 11],
]
for (const [box_id, box_name, code, release_date, image, cardsPerPack] of sets) {
  if (catalog.boxes.some(box => box.box_id === box_id)) continue
  catalog.boxes.push({ box_id, box_name, code, release_ym: release_date.slice(0, 7), release_date,
    certainty: 'released', pack_price_yen: 315, packs_per_box: 20,
    pack_image_url: `https://img.altema.jp/pokemoncard/pack/icon/${image}.jpg`,
    note: `${release_date}発売。1パック${cardsPerPack}枚入り、発売当時の税込定価315円。δ-デルタ種を収録したPCG期の拡張パック。掲載カードは一部。商品情報：https://www.pokemon-card.com/ex/25th/chronicle/ ／ https://altema.jp/pokemoncard/packlist`,
  })
}
const rows = [
  ['pcg6-umbreon-delta-69-1ed', 'holon_research_tower', 'ブラッキーδ-デルタ種 (1ED)', '069/086', 'R', '悪・鋼', '1進化', 70, 'Ryo Ueda', 92005, 'https://pcg-search.com/img/pcg/pcg6069.png', '1ED'],
  ['pcg7-rayquaza-delta-15-unlimited', 'holon_phantom', 'レックウザδ-デルタ種', '015/052', 'R', '水・鋼', 'たね', 80, 'Mitsuhiro Arita', 92057, 'https://cdn.snkrdunk.com/upload_bg_removed/7308345.webp?size=l', '再販'],
  ['pcg8-charizard-delta-32-1ed', 'miracle_crystal', 'リザードンδ-デルタ種 (1ED)', '032/075', 'R', '雷・鋼', '2進化', 120, 'unknown', 91980, 'https://cdn.snkrdunk.com/upload_bg_removed/7fc5e0c0-94aa-43cf-8869-3908a6423380.webp?size=l', '1ED'],
  ['pcg9-charizard-star-delta-52-1ed', 'offense_defense_furthest_ends', 'リザードン☆δ-デルタ種 (1ED)', '052/068', '☆', '悪', 'たね', 90, 'Masakazu Fukuda', 93260, 'https://cdn.snkrdunk.com/upload_bg_removed/74fdddd2-b1c0-4489-bfd0-e3a03caec4e7.webp?size=l', '1ED'],
]
for (const [id, box_id, card_name, card_no, rarity, type, stage, hp, illustrator, productId, image_url, edition] of rows) {
  if (!catalog.cards.some(card => card.id === id)) catalog.cards.push({
    id, box_id, card_name, card_no, rarity, is_reprint: false, image_url,
    card_spec: { type, stage, hp, note: `PCG期のδ-デルタ種。${edition}版。` },
    materials: {
      player: { regulation_mark: 'unknown', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator, illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'out_of_print', character_popularity: 'high' },
    },
    evidence_notes: { player: '現行スタンダード対象外のPCG期カード。',
      collector: `${card_name}の${edition}版。通常と異なるタイプを持つδ-デルタ種。`,
      source: `2026-10-10 商品名・カード番号・版を照合：https://snkrdunk.com/apparels/${productId}` },
    note: `スニダンの${edition}版商品区分を追跡。別の版・復刻版と価格を混在させない。素体とPSA10は別に追跡。`,
  })
  ids[id] = productId
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n')
console.log('デルタ種収録4パック・代表カード4枚を登録（価格は成約取得後に表示）')
