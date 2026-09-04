'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { OnePieceProduct, OnePieceSet } from '@/types/onepiece'

export type OnePieceListing = OnePieceProduct & { avg: number | null; date: string | null; count: number | null; stale: boolean }
export default function OnePieceCatalog({ products, sets, initialKind = 'all', initialSet = '' }: {
  products: OnePieceListing[]; sets: OnePieceSet[]; initialKind?: 'all' | 'card' | 'box'; initialSet?: string
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(initialKind)
  const [setId, setSetId] = useState(initialSet)
  const [sort, setSort] = useState('price')
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\s・]/g, '')
  const visible = products.filter(p => (kind === 'all' || p.kind === kind) && (!setId || p.set_id === setId)
    && normalize(`${p.name} ${p.card_no ?? ''} ${p.set_id}`).includes(normalize(query)))
    .sort((a, b) => sort === 'price' ? (b.avg ?? -1) - (a.avg ?? -1) : b.set_id.localeCompare(a.set_id) || (b.avg ?? -1) - (a.avg ?? -1))
  return <section className="op-catalog" aria-label="ONE PIECEの商品検索">
    <div className="op-toolbar">
      <label className="op-search">カード名・カード番号で検索<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ルフィ、OP17-079…" /></label>
      <label>並び順<select value={sort} onChange={e => setSort(e.target.value)}><option value="price">価格が高い順</option><option value="set">新しい弾順</option></select></label>
    </div>
    <div className="op-filters" aria-label="商品種別">{([['all', 'すべて'], ['card', '高額カード'], ['box', '未開封BOX']] as const).map(([value, label]) =>
      <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}</div>
    <div className="op-filters" aria-label="収録弾"><button type="button" aria-pressed={!setId} onClick={() => setSetId('')}>全5弾</button>
      {sets.map(s => <button key={s.id} type="button" aria-pressed={setId === s.id} onClick={() => setSetId(s.id)}>{s.name}</button>)}
    </div>
    <p className="op-muted">{visible.length}件 · スニダン成約平均 · カードは状態A／BOXは1箱単価</p>
    {!visible.length && <p className="op-empty">該当する商品がありません。検索条件を変更してください。</p>}
    <div className="op-product-grid">{visible.map(p => <Link className="op-product" href={`/onepiece/products/${p.id}`} key={p.id}>
      <div className={`op-product-image${p.kind === 'box' ? ' is-box' : ''}`}>
        {/* External product imagery keeps the exact parallel visible. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" style={{ transform: `scale(${p.image_scale ?? 1})` }} /> : <span>{p.kind === 'box' ? 'BOX' : p.card_no}</span>}
      </div>
      <div className="op-product-info"><span className="op-eyebrow">{sets.find(s => s.id === p.set_id)?.code} · {p.kind === 'box' ? '未開封BOX' : p.card_no}</span>
        <h3>{p.name.split('[')[0].trim()}</h3>
        <div className="op-price">{p.avg == null ? '成約データ不足' : `¥${p.avg.toLocaleString('ja-JP')}`}</div>
        {p.stale && <span className="op-muted">参考値（30日以上前の相場）<br /></span>}
        <span className="op-muted">{p.date ? `${p.date} · ${p.count ?? '—'}件` : '相場算出に必要な件数を確認中'}</span>
      </div>
    </Link>)}</div>
  </section>
}
