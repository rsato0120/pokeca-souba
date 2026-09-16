import Link from 'next/link'

export interface DailySalesShareRow {
  href: string
  name: string
  rarity: string
  sales: number
}

export default function DailySalesShare({
  date,
  rows,
  game,
  pageUrl,
}: {
  date: string
  rows: DailySalesShareRow[]
  game: 'pokemon' | 'onepiece'
  pageUrl: string
}) {
  if (!date || rows.length === 0) return null

  const gameName = game === 'pokemon' ? 'ポケカ' : 'ワンピカード'
  const dateLabel = date.replaceAll('-', '/')
  const tweetText = [
    `【${gameName} 今日の成約数TOP3】${dateLabel}`,
    ...rows.map((row, index) => `${index + 1}位 ${row.name}（${row.rarity}） ${row.sales.toLocaleString('ja-JP')}件`),
    '',
    'スニダン実成約の取得範囲内で集計',
    game === 'pokemon' ? '#ポケカ #ポケカ相場' : '#ワンピカード #ワンピカード相場',
  ].join('\n')

  return (
    <section className="daily-sales-share" aria-labelledby={`${game}-daily-sales-title`}>
      <div className="daily-sales-share-head">
        <div>
          <span>DAILY SALES</span>
          <h2 id={`${game}-daily-sales-title`}>今日の成約数 TOP3</h2>
          <small>{dateLabel} 集計</small>
        </div>
        <a
          className="daily-sales-share-button"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(pageUrl)}`}
          target="_blank"
          rel="noreferrer"
        >
          𝕏でシェア
        </a>
      </div>
      <ol className="daily-sales-share-list">
        {rows.map((row, index) => (
          <li key={row.href}>
            <Link href={row.href}>
              <span>{index + 1}</span>
              <span className="daily-sales-share-copy"><strong>{row.name}</strong><small>{row.rarity}</small></span>
              <b>{row.sales.toLocaleString('ja-JP')}件</b>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
