import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import GameTabs from '@/components/GameTabs'
import PriceHistoryChart from '@/components/PriceHistoryChart'
import { getOnePieceCatalog, getOnePiecePrices, onePieceShortName, isOnePiecePriceStale } from '@/lib/onepiece'

export const dynamicParams = false
export function generateStaticParams() { return getOnePieceCatalog().products.map(p => ({ productId: p.id })) }
export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  const p = getOnePieceCatalog().products.find(p => p.id === productId)
  return { title: `${p ? onePieceShortName(p.name) : '商品'}の相場・価格推移`, description: p ? `${p.name}のスニダン成約相場。` : undefined }
}
export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  const { products, sets } = getOnePieceCatalog()
  const product = products.find(p => p.id === productId)
  if (!product) notFound()
  const set = sets.find(s => s.id === product.set_id)!
  const prices = getOnePiecePrices(product.id)
  const latest = prices?.history[0]
  const yen = (value: number | undefined) => value == null ? '—' : `¥${value.toLocaleString('ja-JP')}`
  return <main className="wrap op-page"><SiteHeader /><GameTabs game="onepiece" />
    <nav className="op-breadcrumb" aria-label="パンくず"><Link href="/onepiece">ONE PIECE</Link><span> / </span><Link href={`/onepiece/sets/${set.id}`}>{set.name}</Link></nav>
    <section className="op-detail-hero">
      <div className="op-detail-image">{/* eslint-disable-next-line @next/next/no-img-element */}
        {product.image_url ? <img src={product.image_url} alt={onePieceShortName(product.name)} style={{ transform: `scale(${product.image_scale ?? 1})` }} /> : <span>{product.card_no ?? 'BOX'}</span>}
      </div>
      <div><p className="op-eyebrow">{set.code} · {product.card_no ?? '未開封BOX'}</p><h1>{onePieceShortName(product.name)}</h1>
        <p className="op-muted">{set.name} · {product.kind === 'card' ? '状態A（きれいな状態）' : '1箱あたり'}</p>
        <p className="op-muted">スニーカーダンク 成約平均</p><p className="op-detail-price">{latest ? yen(latest.avg) : '成約データ不足'}</p>
        <p className="op-muted">{latest ? `${latest.date}時点 · ${latest.sample_count}件の成約から算出` : '相場算出には30日以内に3件以上の成約が必要です。'}</p>
        {isOnePiecePriceStale(prices) && <p className="op-muted">取得時点で30日以上前の参考値です。最近の相場を算出できる成約件数が不足しています。</p>}
        <a className="op-buy-link" href={product.source_url} target="_blank" rel="noreferrer">スニダンでこの商品を見る ↗</a>
      </div>
    </section>
    <section className="op-chart-panel"><h2>価格推移</h2>
      {(prices?.history.length ?? 0) > 1 ? <PriceHistoryChart history={prices!.history} salesByDay={prices!.sales_by_day} unit={product.kind === 'box' ? '箱' : '枚'} movingAverages={false} /> : <p className="op-empty">価格推移を表示できる成約データがまだ足りません。</p>}
      <p className="op-footnote">各日までの直近30日以内から新しい日順に20件を目安に集計。カードは状態Aのみ、BOXは複数箱の取引を1箱単価に換算しています。グラフは取得できた実成約から算出し、取引がない日を補完しません。</p>
    </section>
    <section className="op-chart-panel"><h2>直近の相場記録</h2><div className="op-table-scroll"><table className="op-table"><thead><tr><th>成約日</th><th>平均</th><th>価格帯</th><th>算出件数</th></tr></thead><tbody>
      {prices?.history.slice(0, 10).map(r => <tr key={r.date}><td>{r.date}</td><td>{yen(r.avg)}</td><td>{yen(r.low)}〜{yen(r.high)}</td><td>{r.sample_count}件</td></tr>)}
    </tbody></table></div>{!latest && <p className="op-empty">記録なし</p>}</section>
    <p className="op-footnote">価格帯は採用成約の20〜80パーセンタイル。取得日時：{prices ? new Date(prices.fetched_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未取得'}（日本時間）。{prices && !prices.complete ? '成約件数は取得できた期間のみの集計です。' : ''} <a href={set.official_url} target="_blank" rel="noreferrer">公式商品情報</a></p>
  </main>
}
