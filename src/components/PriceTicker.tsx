import Link from 'next/link'

// トップ最上部の相場ティッカー（株価ボードのように右から左へ流れる帯）。
//
// クライアントコンポーネントにしていない: 流れる動きもホバー一時停止もCSSだけで書けるので、
// JSを足すとhydrationの面倒が増えるだけで得るものが無い。
//
// 途切れなく流すために**同じ並びを2回描いて track を -50% だけ動かす**。
// 1周すると2つ目のコピーの先頭が元の位置に来るので、継ぎ目が見えない。

export interface TickerItem {
  slug: string
  name: string
  rarity: string
  mid: number
  changePct: number
}

export default function PriceTicker({ items }: { items: TickerItem[] }) {
  // 少なすぎると流す意味が無い（隙間だらけになる）
  if (items.length < 6) return null

  const row = (item: TickerItem, key: string) => {
    const up = item.changePct > 0
    return (
      <Link key={key} href={`/cards/${item.slug}`} className="ticker-item">
        <span className="ticker-mark" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>
          {up ? '▲' : '▼'}
        </span>
        <span className="ticker-name">{item.name}</span>
        <span className="ticker-rarity">{item.rarity}</span>
        <span className="ticker-price">¥{item.mid.toLocaleString()}</span>
        <span style={{ color: up ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
          {up ? '+' : ''}{item.changePct.toFixed(1)}%
        </span>
      </Link>
    )
  }

  return (
    <div className="ticker" aria-label="本日の値動き">
      <div className="ticker-track">
        {items.map((it, i) => row(it, `a${i}`))}
        {/* 2周目。読み上げには不要なので支援技術からは隠す */}
        <span aria-hidden="true" style={{ display: 'contents' }}>
          {items.map((it, i) => row(it, `b${i}`))}
        </span>
      </div>
    </div>
  )
}
