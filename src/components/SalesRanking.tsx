import Link from 'next/link'
import type { MarketListing } from '@/types/pokeca'

export interface SalesRankRow {
  slug: string
  name: string
  rarity: string
  image: string | null
  mid: number
  sales7d: number
  onSale: number | null
  onSaleCapped: boolean
  listings: MarketListing[]
}

export default function SalesRanking({ rows }: { rows: SalesRankRow[] }) {
  if (rows.length === 0) {
    return <div className="market-rank-empty">成約データを集計中です。</div>
  }

  return (
    <ol className="market-rank-list">
      {rows.map((row, index) => (
        <li key={row.slug} className="market-rank-item">
          <Link href={`/cards/${row.slug}`} className="market-rank-card">
            <span className="market-rank-number">{index + 1}</span>
            {row.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.image} alt="" className="market-rank-thumb" />
            ) : (
              <span className="market-rank-thumb market-rank-thumb-placeholder">{row.rarity}</span>
            )}
            <span className="market-rank-main">
              <strong>{row.name}</strong>
              <span>{row.rarity} · 相場 ¥{Math.round(row.mid).toLocaleString()}</span>
            </span>
            <span className="market-rank-metrics">
              <strong>{row.sales7d}件</strong>
              <span>直近7日</span>
            </span>
            <span className="market-rank-stock">
              {row.onSale != null ? `${row.onSale.toLocaleString()}件${row.onSaleCapped ? '以上' : ''}` : '—'}
              <small>出品中</small>
            </span>
          </Link>

          {row.listings.length > 0 && (
            <div className="market-listings" aria-label={`${row.name}の出品`}>
              {row.listings.map((listing) => (
                <a
                  key={listing.id}
                  href={listing.url}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="market-listing"
                >
                  {listing.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.image_url} alt="" />
                  ) : null}
                  <span className="market-listing-title">{listing.title}</span>
                  <strong>¥{listing.price.toLocaleString()}</strong>
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
