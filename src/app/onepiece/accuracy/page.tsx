import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import { computeAccuracy, HORIZONS } from '@/lib/accuracy'
import { getOnePieceCatalog, getOnePiecePrices, getOnePiecePredictionLog, onePieceShortName } from '@/lib/onepiece'
import { onePieceMarketId, marketCardHref } from '@/lib/market-links'
export const metadata = { title: 'ONE PIECE AI予想の的中実績' }
export default function Page() {
  const stats = computeAccuracy(getOnePieceCatalog().products.map(p => ({ id: onePieceMarketId(p.id), name: onePieceShortName(p.name), rarity: p.kind === 'box' ? 'BOX' : 'カード', history: getOnePiecePrices(p.id)?.history ?? [], log: getOnePiecePredictionLog(p.id) })))
  return <main className="wrap"><SiteHeader /><h1>ONE PIECE AI予想の的中実績</h1>
    <p className="source-note">保存した予想と、その後の実成約相場で方向を検証します。予想の保存開始：{stats.firstPredictionDate ?? '準備中'}。予想記録 {stats.totalPredictions}件。</p>
    <div className="home-dashboard-grid">{HORIZONS.map(h => <section className="home-panel" key={h}><h2>{h}日後の結果</h2><p>{stats.byHorizon[h].resolved ? `的中率 ${stats.byHorizon[h].rate}%（${stats.byHorizon[h].hits} / ${stats.byHorizon[h].resolved}件）` : '判定できる期間が経過するまで集計中です。'}</p></section>)}</div>
    <div className="op-table-scroll"><table className="op-table"><thead><tr><th>商品</th><th>予想日</th><th>期間</th><th>実際の変化</th><th>判定</th></tr></thead><tbody>{stats.recent.map(r => <tr key={`${r.cardId}-${r.predictedOn}-${r.horizon}`}><td><Link prefetch={false} href={marketCardHref(r.cardId)}>{r.cardName}</Link></td><td>{r.predictedOn}</td><td>{r.horizon}日</td><td>{r.changePct}%</td><td>{r.hit ? '的中' : '不的中'}</td></tr>)}</tbody></table></div>
    <p className="source-note">上昇確率と下落確率の差が10ポイント以上ならその方向、差が小さい予想は横ばい（±10%以内）として採点。目標日以降14日以内の最初の実測値を使います。過去の成績は将来の結果を保証しません。</p>
  </main>
}
