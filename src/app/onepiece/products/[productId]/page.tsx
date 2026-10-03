import MercariLink from '@/components/MercariLink'
import SearchBar from '@/components/SearchBar'
import BoxSelector from '@/components/BoxSelector'
import PackImage from '@/components/PackImage'
import { aiVerdict } from '@/lib/verdict'
import CardCharts from '@/components/CardCharts'
import PriceForecastChart from '@/components/PriceForecastChart'
import OnePieceForecast from '@/components/OnePieceForecast'
import WatchButton from '@/components/WatchButton'
import CardSentiment from '@/components/CardSentiment'
import CardViewCounter from '@/components/CardViewCounter'
import PriceExtremesSummary from '@/components/PriceExtremesSummary'
import { onePieceMarketId } from '@/lib/market-links'
import { onePieceRawExtremes } from '@/lib/onepiece-market'
import { getOnePieceForecast } from '@/lib/onepiece'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import CardCollectionControl from '@/components/CardCollectionControl'
import PriceHistoryChart from '@/components/PriceHistoryChart'
import { mercariAffiliateUrl, MERCARI_A8_IMPRESSION_URL } from '@/lib/bargains'
import { getOnePieceCatalog, getOnePiecePrices, onePieceShortName, onePieceRarity, isOnePiecePriceStale } from '@/lib/onepiece'
import DetailBargains from '@/components/DetailBargains'
import OnePieceImage from '@/components/OnePieceImage'
import OnePieceSetCards from '@/components/OnePieceSetCards'
import CardScorePanel from '@/components/CardScorePanel'
import { computeOnePieceScore } from '@/lib/onepiece-score'
import { getOnePieceDetailBargains } from '@/lib/detail-bargains'

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
  const forecast = getOnePieceForecast(product.id)
  const psa10 = prices?.psa10_history?.[0]
  const marketId = onePieceMarketId(product.id)
  const searchKeyword = product.kind === 'box'
    ? `ワンピースカード ${set.name} 未開封 BOX`
    : `ワンピースカード ${onePieceShortName(product.name)} ${product.card_no ?? ''}`.trim()
  const mercariUrl = mercariAffiliateUrl(`https://jp.mercari.com/search?keyword=${encodeURIComponent(searchKeyword)}&status=on_sale`)
  const yen = (value: number | undefined) => value == null ? '—' : `¥${value.toLocaleString('ja-JP')}`
  const tweetText = [onePieceShortName(product.name), latest ? `スニダン成約相場 ${yen(latest.avg)}（${latest.date}）` : '相場データを確認', `https://pokeca-souba.vercel.app/onepiece/products/${product.id}`, '#ワンピースカード #ワンピカード'].join('\n')
  const extremes = onePieceRawExtremes(prices)
  const investmentScore = computeOnePieceScore(prices, forecast)
  const signal = forecast ? aiVerdict(forecast.overall) : null
  const controls = <><WatchButton cardId={marketId} mid={latest?.avg ?? 0} /><CardCollectionControl cardId={'onepiece:' + product.id} hasPsa10={psa10?.psa10 != null} rawLabel={product.kind === 'box' ? '未開封BOX（箱）' : 'カード（枚）'} /><p className="source-note"><Link prefetch={false} href="/onepiece/portfolio">マイコレクションを見る →</Link></p><MercariLink href={mercariUrl} className="pill" target="_blank" rel="sponsored nofollow noreferrer">メルカリで探す ↗</MercariLink><p className="source-note">広告・アフィリエイトリンク</p>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={MERCARI_A8_IMPRESSION_URL} width="1" height="1" alt="" /></>
  const marketPanel = <div className="panel" style={{ background: 'var(--bg2)', marginBottom: 'var(--sp-4)' }}><div className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>MARKET · 市場価格</div><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}><div><div className="stat-label">スニダン実成約{product.kind === 'box' ? '・1箱単価' : '・状態A'}</div><span className="stat-value" style={{ color: 'var(--accent)' }}>{latest ? yen(latest.avg) : 'データ不足'}</span></div>{product.kind === 'card' && <div><div className="stat-label">PSA10相場</div><span className="stat-value" style={{ color: '#6c8ebf' }}>{psa10 ? yen(psa10.psa10 ?? undefined) : '—'}</span></div>}</div><p className="source-note">{latest ? latest.date + '時点 · ' + latest.sample_count + '件の成約から算出' : '成約データを集計中です。'}{isOnePiecePriceStale(prices) ? ' · 古い参考値です。' : ''}</p></div>
  return <main className="wrap" style={product.kind === 'card' ? { maxWidth: '820px' } : undefined}>
    <Link prefetch={false} href="/onepiece" style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)', letterSpacing: '0.06em', display: 'inline-block', padding: '18px 0 10px' }}>← トップへ戻る</Link><SiteHeader />
    {product.kind === 'box' ? <>
      <BoxSelector basePath="/onepiece/sets" current={set.id} marginTop={0} marginBottom={24} boxes={sets.map(s=>({box_id:s.id,box_name:s.name,release_ym:s.release_date.slice(0,7)}))} />
      <div className="box-set-header">{product.image_url && <PackImage src={product.image_url} alt={set.name} className="box-pack-art" />}<div style={{ flex: 1 }}><div className="eyebrow">BOX · 収録弾</div><h1 style={{ fontFamily: 'var(--mincho)', fontWeight: 800, marginBottom: 10 }}>{set.name}</h1><p className="source-note">{set.release_date} 発売 · {products.filter(p=>p.set_id===set.id && p.kind==='card').length}枚収録（掲載中）</p></div></div>
      {marketPanel}{controls}
    </> : <>
      <div style={{ marginBottom: 30 }}><SearchBar basePath="/onepiece/products" cards={products.filter(p=>p.kind==='card').map(p=>({slug:p.id,card_name:onePieceShortName(p.name),rarity:onePieceRarity(p),box_name:sets.find(s=>s.id===p.set_id)?.name ?? '',up_pct:null}))} /></div>
      <CardViewCounter cardId={marketId} />
      <div className="card-detail-grid" style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 30, alignItems: 'start', marginBottom: 24 }}>
        <div className="card-detail-col-card"><div className="card-detail-figure"><OnePieceImage product={product} className="pokecard holo" />{signal && <div style={{ marginTop: 12, textAlign: 'center', color: signal.color }}>{signal.dot} {signal.label}</div>}</div></div>
        <div style={{ paddingTop: 4 }}><div className="eyebrow" style={{ marginBottom: 6 }}>FORECAST · 今後 6ヶ月</div><h1 style={{ fontFamily: 'var(--mincho)', fontSize: 26, fontWeight: 800, letterSpacing: '0.02em', marginBottom: 12, lineHeight: 1.3 }}>{onePieceShortName(product.name)}<span className="rare-badge">{onePieceRarity(product)}</span></h1><p className="source-note" style={{ marginBottom: 20 }}><Link prefetch={false} href={'/onepiece/sets/' + set.id}>{set.name}</Link> · {product.card_no} · {set.release_date} 発売</p>
          <div style={{ border: '1px solid var(--hair)', borderLeft: '3px solid ' + (signal?.color ?? 'var(--ink-faint)'), borderRadius: 8, padding: '16px 18px', marginBottom: 12, background: 'var(--panel)' }}><div className="stat-label">6ヶ月以内に上昇する確率</div><div className="stat-value" style={{ color: signal?.color }}>{forecast ? forecast.overall.up_pct + '%' : 'データ不足'}</div><p className="source-note">{forecast?.overall.reason ?? '予想に必要な履歴を集計中です。'}</p></div>
          {marketPanel}{controls}
        </div>
      </div>
    </>}
    {product.kind === 'box' && <section className="chart-shell">
      <h2>収録カード</h2>
      <p className="op-footnote">このBOXに収録されている掲載対象カードです。</p>
      <OnePieceSetCards setId={set.id} />
    </section>}
    <DetailBargains rows={getOnePieceDetailBargains(product.id).slice(0, 3)} />
    <p><a className="op-buy-link" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`} target="_blank" rel="noreferrer">𝕏 でシェア</a></p>
    <section className="chart-shell"><h2>価格推移・詳細チャート</h2>
      {(prices?.history.length ?? 0) > 0 ? <CardCharts forecastChart={forecast ? <PriceForecastChart history={prices!.history} forecast={forecast.price_forecast} /> : null} historyChart={<PriceHistoryChart rawExtras={<PriceExtremesSummary extremes={extremes} mid={latest?.avg ?? 0} />} extremes={extremes ? { high: extremes.high.value, low: extremes.low.value } : null} history={prices!.history} psa10History={prices!.psa10_history} psa10ArchivedExtremes={prices!.psa10_archived_extremes} salesByDay={prices!.sales_by_day} psa10SalesByDay={prices!.psa10_sales_by_day} unit={product.kind === 'box' ? '箱' : '枚'} movingAverages={false} />} /> : <p className="op-empty">価格推移を表示できる成約データがまだ足りません。</p>}
      <p className="op-footnote">各日までの直近30日以内から新しい日順に20件を目安に集計。素体は状態A、PSA10は鑑定済みPSA10のみを別々に集計し、BOXは複数箱の取引を1箱単価に換算しています。グラフは取得できた実成約から算出し、取引がない日を補完しません。</p>
    </section>
    {investmentScore && <CardScorePanel score={investmentScore} />}
    {forecast ? <OnePieceForecast forecast={forecast} /> : <p className="source-note">AI予想は履歴と直近の成約データが十分そろった商品から生成します。</p>}
    <CardSentiment cardId={marketId} ai={forecast ? { up: forecast.overall.up_pct, flat: forecast.overall.flat_pct, down: forecast.overall.down_pct } : null} />
    <section className="op-chart-panel"><h2>直近の相場記録</h2><div className="op-table-scroll"><table className="op-table"><thead><tr><th>成約日</th><th>平均</th><th>価格帯</th><th>算出件数</th></tr></thead><tbody>
      {prices?.history.slice(0, 10).map(r => <tr key={r.date}><td>{r.date}</td><td>{yen(r.avg)}</td><td>{yen(r.low)}〜{yen(r.high)}</td><td>{r.sample_count}件</td></tr>)}
    </tbody></table></div>{!latest && <p className="op-empty">記録なし</p>}</section>
    <p className="op-footnote">価格帯は採用成約の20〜80パーセンタイル。取得日時：{prices ? new Date(prices.fetched_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未取得'}（日本時間）。{prices && !prices.complete ? '成約件数は取得できた期間のみの集計です。' : ''} <a href={set.official_url} target="_blank" rel="noreferrer">公式商品情報</a></p>
  </main>
}
