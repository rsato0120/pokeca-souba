import Link from 'next/link'

// カード詳細の左カラム（カード画像の下の空き）に置く関連カード。
// PCでは縦並び、狭い画面では横スクロールに切り替える（縦のまま置くと
// 本文＝AI予想が画面外まで押し下げられる）。

export type RelatedItem = {
  id: string
  name: string
  rarity: string
  boxName: string
  image: string | null
  price: number | null
}

export default function RelatedCards({ items }: { items: RelatedItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="related">
      <p className="related-head">同じカードの別バージョン</p>
      <div className="related-list">
        {items.map(it => (
          <Link key={it.id} href={`/cards/${it.id}`} className="related-item">
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt={it.name} referrerPolicy="no-referrer" className="related-thumb" />
            ) : (
              <div className="related-thumb" />
            )}
            <span className="related-body">
              <span className="related-name">
                {it.name}
                <span className="related-rarity">{it.rarity}</span>
              </span>
              <span className="related-box">{it.boxName}</span>
              <span className="related-price">
                {it.price != null ? `¥${it.price.toLocaleString()}` : '—'}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
