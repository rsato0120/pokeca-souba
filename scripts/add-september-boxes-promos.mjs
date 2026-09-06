// Idempotent additions; preserve all existing catalog entries.
import fs from 'node:fs'
import path from 'node:path'
const root = process.argv[2] ?? process.cwd()
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
const save = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + '\n')
const put = (list, key, value) => { if (!list.some(x => x[key] === value[key])) list.push(value) }
const d = read('data/pokeca_data.json')
put(d.boxes, 'box_id', { box_id: 'incandescent_arcana', box_name: '白熱のアルカナ', code: 'S11a', release_ym: '2022-09', certainty: 'released', pack_price_yen: 260, packs_per_box: 20, pack_image_url: 'https://www.pokemon-card.com/products/2022/images/af33240a361eb22b2dd1a43138df56dea02335a6.jpg', note: '2022年9月2日発売。公式商品情報：https://www.pokemon-card.com/products/s/s11a.html' })
put(d.boxes, 'box_id', { box_id: 'kanazawa_pikachu', box_name: 'カナザワのピカチュウ', code: 'S-P', release_ym: '2020-11', certainty: 'released', pack_price_yen: 0, note: 'ポケモンセンターカナザワオープン記念プロモ。配布版144/S-PとスペシャルBOX収録版147/S-Pを区別。' })
for (const [no, note, image] of [[144, '来店配布版（オープン記念ロゴ入り）', null], [147, 'スペシャルBOX収録版（キラ）', 'https://www.pokemon-card.com/assets/images/card_images/large/S-P/038844_P_KANAZAWANOPIKACHUU.jpg']]) {
 put(d.cards, 'id', { id: `kanazawa-pikachu-${no}`, card_no: `${no}/S-P`, rarity: 'PROMO', card_name: 'カナザワのピカチュウ', box_id: 'kanazawa_pikachu', is_reprint: false, ...(image ? { image_url: image } : {}), card_spec: { type: '雷', stage: '基本', hp: 60, note }, materials: { player: { regulation_mark: '—', rotation: 'unknown', competitive_usage: 'none' }, collector: { illustrator: 'Fuzichoco', illustrator_popularity: 'unknown', artwork_type: 'original', rarity: 'PROMO' }, common: { reprint_status: 'none', scarcity: 'normal', character_popularity: 'high' } }, evidence_notes: { player: 'プロモーションカード。', collector: note, source: 'https://www.pokemon-card.com/info/2020/20201016_002642.html' }, note })
}
delete d._meta?.output_format?.collector_view
d.cards.find(c => c.id === 'kanazawa-pikachu-144').image_url = 'https://cdn.snkrdunk.com/upload_bg_removed/20230409035254-0.webp'
if (d._meta?.output_format) d._meta.output_format._desc = '価格予想と総合見通し。'
save('data/pokeca_data.json', d)
const ids = read('data/snkrdunk-ids.json')
Object.assign(ids, { 'box-incandescent_arcana-shrink': 89881, 'kanazawa-pikachu-144': 120250, 'kanazawa-pikachu-147': 91113 })
save('data/snkrdunk-ids.json', ids)
const op = read('data/onepiece/catalog.json')
put(op.sets, 'id', { id: 'op05', code: 'OP-05', name: '新時代の主役', release_date: '2023-08-26', official_url: 'https://www.onepiece-cardgame.com/products/boosters/op05/', selection_url: 'https://snkrdunk.com/apparels/136035' })
// PROMO is a grouping, not a product with one release date.
put(op.sets, 'id', { id: 'promo', code: 'PROMO', name: 'プロモーションカード', release_date: '', official_url: 'https://www.onepiece-cardgame.com/cardlist/', selection_url: 'https://snkrdunk.com/articles/31060/' })
for (const [id, set, kind, name, img, scale] of [
 [136035, 'op05', 'box', '新時代の主役 未開封BOX', '20240303014653-0.webp', 1],
 [95888, 'promo', 'card', 'モンキー・D・ルフィ P（チャンピオンシップセット2022購入特典）[P-001]', '20220909043606-1.webp', 2.25],
 [94909, 'promo', 'card', 'モンキー・D・ルフィ P-P（プレミアムカードコレクション25周年エディション）[P-001]', '20220830082917-0.webp', 2.25],
]) put(op.products, 'id', { id: `${set}-${id}`, set_id: set, kind, name, card_no: kind === 'card' ? 'P-001' : null, snkrdunk_id: id, image_url: `https://cdn.snkrdunk.com/upload_bg_removed/${img}`, image_scale: scale, source_url: `https://snkrdunk.com/apparels/${id}` })
op.products.find(p => p.id === 'promo-95888').name = 'モンキー・D・ルフィ P（チャンピオンシップセット2022購入特典）[P-001]'
op.products.find(p => p.id === 'promo-94909').name = 'モンキー・D・ルフィ P-P（プレミアムカードコレクション25周年エディション）[P-001]'
save('data/onepiece/catalog.json', op)

