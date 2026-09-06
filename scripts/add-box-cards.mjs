import fs from 'node:fs'
import path from 'node:path'
const root = process.argv[2] ?? process.cwd()
const additions = JSON.parse(fs.readFileSync(new URL('./box-card-additions.json', import.meta.url), 'utf8'))
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const save = (p,d) => fs.writeFileSync(path.join(root,p),JSON.stringify(d,null,2)+'\n')
const data=read('data/pokeca_data.json'), ids=read('data/snkrdunk-ids.json'), op=read('data/onepiece/catalog.json')
for (const {snkrdunk_id,...card} of additions.cards) {
 if(!data.boxes.some(b=>b.box_id===card.box_id)) throw new Error(`Missing BOX ${card.box_id}`)
 if(!data.cards.some(c=>c.id===card.id)) data.cards.push(card)
 ids[card.id]=snkrdunk_id
}
for(const p of additions.products) {
 if(!op.sets.some(s=>s.id===p.set_id)) throw new Error(`Missing set ${p.set_id}`)
 if(!op.products.some(c=>c.id===p.id)) op.products.push(p)
}
save('data/pokeca_data.json',data); save('data/snkrdunk-ids.json',ids); save('data/onepiece/catalog.json',op)
console.log(`Registered ${additions.cards.length} Pokemon / ${additions.products.length} ONE PIECE cards`)
