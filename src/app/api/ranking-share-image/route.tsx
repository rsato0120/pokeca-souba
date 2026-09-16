import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { getAllCards, getCardSlug, getPriceHistory } from '@/lib/data'
import { getOnePieceCatalog, getOnePiecePrices, onePieceRarity } from '@/lib/onepiece'
import { buildOnePieceRanking } from '@/lib/onepiece-ranking'

export const runtime = 'nodejs'

type ShareRow = { id: string; image: string | null; rarity: string; sales: number }

async function embedCardImage(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { next: { revalidate: 3600 } })
    if (!response.ok) return null
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .trim()
      .resize(260, 360, { fit: 'contain', withoutEnlargement: true })
      .flatten({ background: '#171820' })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

function pokemonRows(): { date: string; rows: ShareRow[] } {
  const cards = getAllCards()
  const date = cards.map(card => getPriceHistory(getCardSlug(card))?.history[0]?.date ?? '').sort().at(-1) ?? ''
  const rows = cards.flatMap(card => {
    const sales = Number(getPriceHistory(getCardSlug(card))?.sales_by_day?.[date] ?? 0)
    return sales > 0 ? [{ id: getCardSlug(card), image: card.image_url ?? null, rarity: card.rarity, sales }] : []
  }).sort((a, b) => b.sales - a.sales || a.id.localeCompare(b.id)).slice(0, 3)
  return { date, rows }
}

function onePieceRows(): { date: string; rows: ShareRow[] } {
  const { products } = getOnePieceCatalog()
  const observations = Object.fromEntries(products.map(product => [product.id, getOnePiecePrices(product.id)]))
  const ranking = buildOnePieceRanking(products, observations)
  const rows = ranking.rows.filter(row => row.kind === 'card' && row.salesToday > 0)
    .sort((a, b) => b.salesToday - a.salesToday || b.sales7d - a.sales7d || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(row => ({ id: row.id, image: row.image_url, rarity: onePieceRarity(row), sales: row.salesToday }))
  return { date: ranking.baseDate ?? '', rows }
}

export async function GET(request: Request) {
  const onePiece = new URL(request.url).searchParams.get('game') === 'onepiece'
  const { date, rows } = onePiece ? onePieceRows() : pokemonRows()
  const renderedRows = await Promise.all(rows.map(async row => ({ ...row, image: await embedCardImage(row.image) })))
  const accent = onePiece ? '#e7472f' : '#7c63ff'
  const label = onePiece ? 'ONE PIECE CARD' : 'POKEMON CARD'

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '64px 72px', background: '#0d0e14', color: '#f7f4ed', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', color: accent, fontSize: 24, fontWeight: 700, letterSpacing: 4 }}>SOUBA · DAILY SALES</div>
        <div style={{ display: 'flex', color: '#9b9dab', fontSize: 24 }}>{date.replaceAll('-', '/')} JST</div>
      </div>
      <div style={{ display: 'flex', marginTop: 18, fontSize: 50, fontWeight: 800 }}>{label} DAILY SALES TOP 3</div>
      <div style={{ display: 'flex', gap: 18, marginTop: 28 }}>
        {renderedRows.map((row, index) => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, height: 290, padding: '20px 24px', border: '1px solid #30323c', borderRadius: 18, background: '#171820' }}>
            <div style={{ display: 'flex', position: 'relative', width: 150, height: 238, alignItems: 'center', justifyContent: 'center' }}>
              {row.image ? <img src={row.image} alt="" width={150} height={220} style={{ objectFit: 'contain' }} /> : null}
              <div style={{ display: 'flex', position: 'absolute', left: -10, top: -4, alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 26, background: accent, color: '#fff', fontSize: 26, fontWeight: 800 }}>{index + 1}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 18 }}>
              <div style={{ display: 'flex', color: '#a8aab5', fontSize: 18 }}>RARITY</div>
              <div style={{ display: 'flex', marginTop: 2, fontSize: 25, fontWeight: 700 }}>{row.rarity}</div>
              <div style={{ display: 'flex', marginTop: 24, color: '#45d394', fontSize: 36, fontWeight: 800 }}>{row.sales.toLocaleString('en-US')}</div>
              <div style={{ display: 'flex', color: '#a8aab5', fontSize: 17 }}>SALES</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', color: '#777a87', fontSize: 18 }}>SNKRDUNK COMPLETED SALES · pokeca-souba.vercel.app</div>
    </div>,
    { width: 1200, height: 630 },
  )
}
