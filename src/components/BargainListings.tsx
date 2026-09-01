import Link from 'next/link'

export interface BargainRow {
  listingId: string
  slug: string
  name: string
  rarity: string
  cardImage: string | null
  listingImage: string | null
  title: string
  listingPrice: number
  marketPrice: number
  savings: number
  discountPct: number
  url: string
}

export default function BargainListings({ rows }: { rows: BargainRow[] }) {
  if (rows.length === 0) {
    return <div className="market-rank-empty">条件を満たす出品は現在ありません。</div>
  }

  return (
    <div className="bargain-list">
      {rows.map((row) => (
        <article key={row.listingId} className="bargain-row">
          <Link href={`/cards/${row.slug}`} className="bargain-card-link">
            {row.listingImage || row.cardImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.listingImage ?? row.cardImage ?? ''} alt="" />
            ) : (
              <span className="bargain-image-ph">{row.rarity}</span>
            )}
            <span className="bargain-main">
              <strong>{row.name}</strong>
              <small>{row.rarity} · 相場 ¥{row.marketPrice.toLocaleString()}</small>
              <span>{row.title}</span>
            </span>
          </Link>
          <div className="bargain-price">
            <strong>¥{row.listingPrice.toLocaleString()}</strong>
            <b>相場より {row.discountPct.toFixed(1)}%安い</b>
            <small>−¥{row.savings.toLocaleString()}</small>
          </div>
          <a href={row.url} target="_blank" rel="nofollow noreferrer" className="bargain-buy-link">
            メルカリで見る →
          </a>
        </article>
      ))}
    </div>
  )
}
