import { mercariAffiliateUrl, MERCARI_A8_IMPRESSION_URL } from '@/lib/bargains'

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
        <a
          key={row.listingId}
          href={mercariAffiliateUrl(row.url)}
          target="_blank"
          rel="nofollow noreferrer"
          className="bargain-row"
          aria-label={`${row.name}の出品をメルカリで見る`}
        >
          <span className="bargain-card-link">
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
          </span>
          <div className="bargain-price">
            <strong>¥{row.listingPrice.toLocaleString()}</strong>
            <b>相場より {row.discountPct.toFixed(1)}%安い</b>
            <small>−¥{row.savings.toLocaleString()}</small>
          </div>
          <span className="bargain-buy-link">
            メルカリで見る →
          </span>
        </a>
      ))}
      {/* A8インプレッション計測タグ（メルカリ） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MERCARI_A8_IMPRESSION_URL} width={1} height={1} alt="" style={{ position: 'absolute', width: 1, height: 1, border: 0 }} />
    </div>
  )
}
