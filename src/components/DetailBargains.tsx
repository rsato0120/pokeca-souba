import BargainListings, { type BargainRow } from './BargainListings'

export default function DetailBargains({ rows }: { rows: BargainRow[] }) {
  if (!rows.length) return null
  return (
    <section className="detail-bargains" aria-labelledby="detail-bargains-title">
      <div className="home-panel-head">
        <div><span>DEAL PICKS</span><h2 id="detail-bargains-title">このカードのお買い得出品</h2></div>
      </div>
      <p className="source-note">このカードの販売中の単品出品から、現在相場より15%以上安く、価格差も十分にあるものを表示しています。</p>
      <BargainListings rows={rows.slice(0, 3)} />
      <p className="source-note">広告・アフィリエイトリンク</p>
    </section>
  )
}
