// One-time, idempotent M6a catalog import from SNKRDUNK's public product API.
import fs from 'node:fs'

const idsByNumber = {
  104: 891182, 105: 891183, 106: 882272, 107: 891184, 108: 891185,
  109: 891186, 110: 891187, 111: 882273, 112: 891188, 113: 882274,
  114: 882275, 115: 882276, 116: 891189, 117: 892717, 118: 891190,
  119: 896988, 120: 882277, 121: 896989, 122: 882278, 123: 891191,
  124: 891192, 125: 891193, 126: 882279, 127: 882280, 128: 896990,
  129: 896991, 130: 891194, 131: 896992, 132: 891195, 133: 891196,
  134: 881428, 135: 881429, 136: 886016, 137: 882281, 138: 892638,
  139: 892639, 140: 892640, 141: 892641, 142: 886017, 143: 892642,
  144: 884224, 145: 892643, 146: 892644, 147: 892645, 148: 892646,
  149: 892647, 150: 892648, 151: 892649, 152: 892650, 153: 892651,
  154: 892652, 155: 892653, 156: 892654, 157: 892655, 158: 892656,
  159: 892657, 160: 882282, 161: 892658, 162: 892659, 163: 886018,
  164: 892660, 165: 886019,
}

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const save = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
const rarityFor = no => no <= 123 ? 'AR' : no <= 133 ? 'SAR' : no <= 135 ? 'FUR' : '30th'
const fetchProduct = async apparelId => {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(`https://snkrdunk.com/v1/apparels/${apparelId}`, {
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 1_000))
    }
  }
  throw new Error(`${apparelId}: ${lastError instanceof Error ? lastError.message : lastError}`)
}

const products = []
for (const [numberText, apparelId] of Object.entries(idsByNumber)) {
  const product = await fetchProduct(apparelId)
  const no = Number(numberText)
  if (!product.localizedName?.includes(`[M6a ${numberText}/103]`)) {
    throw new Error(`${apparelId}: unexpected product ${product.localizedName}`)
  }
  products.push({ no, apparelId, product })
  console.log(`${numberText}/103 ${product.localizedName}`)
}

const data = read('data/pokeca_data.json')
const box = {
  box_id: '30th_celebration',
  box_name: '30th CELEBRATION',
  code: 'M6a',
  release_ym: '2026-09',
  release_date: '2026-09-16',
  certainty: 'released',
  pack_price_yen: 360,
  packs_per_box: 20,
  pack_image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/28a1b458-ce7c-45f4-88e6-60f94a3c1992.webp?size=l',
  note: '2026年9月16日発売。1パック6枚、1BOX20パック、希望小売価格7,200円。スニダン商品ID 881421（シュリンク付き）・881427（シュリンクなし）。',
}
data.boxes = [box, ...data.boxes.filter(item => item.box_id !== box.box_id)]

const imported = products.map(({ no, apparelId, product }) => {
  const rarity = rarityFor(no)
  const listedName = product.localizedName.split(' [M6a ')[0]
  const cardName = rarity === '30th' ? listedName : listedName.replace(new RegExp(` ${rarity}$`), '')
  const historical = no >= 136
  return {
    id: `30th-celebration-${String(no).padStart(3, '0')}`,
    card_no: `${String(no).padStart(3, '0')}/103`,
    rarity,
    card_name: cardName,
    box_id: box.box_id,
    is_reprint: historical,
    image_url: `${product.primaryMedia.imageUrl}?size=l`,
    card_spec: {
      type: '不明',
      stage: '不明',
      hp: 0,
      note: historical ? '30周年特別仕様カード。' : `${rarity}収録カード。`,
    },
    materials: {
      player: {
        regulation_mark: historical ? '—' : '不明',
        rotation: 'unknown', competitive_usage: 'none',
      },
      collector: {
        illustrator: '不明', illustrator_popularity: 'unknown',
        artwork_type: historical ? 'reused' : 'original', rarity,
      },
      common: {
        reprint_status: historical ? 'reprinted' : 'none',
        scarcity: 'normal',
        character_popularity: 'unknown',
      },
    },
    evidence_notes: {
      player: '発売前のため大会採用実績なし。',
      collector: historical ? '歴代カードから選ばれた30周年特別仕様。' : `M6aの${rarity}収録カード。`,
      source: `https://snkrdunk.com/apparels/${apparelId}`,
    },
    note: `スニダン公開商品ID ${apparelId}から取得。`,
  }
})
const importedIds = new Set(imported.map(card => card.id))
data.cards = [...imported, ...data.cards.filter(card => !importedIds.has(card.id))]
save('data/pokeca_data.json', data)

const snkrdunkIds = read('data/snkrdunk-ids.json')
snkrdunkIds['box-30th_celebration-shrink'] = 881421
snkrdunkIds['box-30th_celebration-noshrink'] = 881427
for (const card of imported) {
  const no = Number(card.card_no.split('/')[0])
  snkrdunkIds[card.id] = idsByNumber[no]
}
save('data/snkrdunk-ids.json', snkrdunkIds)

console.log(`Imported ${imported.length} M6a cards and 1 box.`)
