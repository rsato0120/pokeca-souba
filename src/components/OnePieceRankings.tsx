'use client'

import { useState } from 'react'
import Link from 'next/link'
import OnePieceImage from './OnePieceImage'
import type { OnePieceRankingRow } from '@/lib/onepiece-ranking'
import type { OnePieceSet } from '@/types/onepiece'
import styles from './OnePieceRankings.module.css'

const tabs = [
  ['sales', '売れ筋'], ['up', '値上がり'], ['down', '値下がり'], ['price', '高額カード'], ['boxes', 'BOX'],
] as const
type Tab = typeof tabs[number][0]
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

export default function OnePieceRankings({ rows, sets, initialTab }: { rows: OnePieceRankingRow[]; sets: OnePieceSet[]; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(tabs.find(([id]) => id === initialTab)?.[0] ?? 'sales')
  const [setId, setSetId] = useState('')
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [boxSort, setBoxSort] = useState('sales')
  const normalize = (v: string) => v.normalize('NFKC').toLowerCase().replace(/\s/g, '')
  const moving = tab === 'up' || tab === 'down'
  const ranked = rows.filter(p => p.kind === (tab === 'boxes' ? 'box' : 'card') && (!setId || p.set_id === setId)
    && normalize(`${p.name} ${p.card_no ?? ''}`).includes(normalize(query)))
    .filter(p => tab === 'sales' || (tab === 'boxes' && boxSort === 'sales') ? p.sales7d > 0
      : moving ? p[period] != null && (tab === 'up' ? p[period]! > 0 : p[period]! < 0) : true)
    .sort((a, b) => (moving ? (tab === 'up' ? b[period]! - a[period]! : a[period]! - b[period]!)
      : tab === 'price' || (tab === 'boxes' && boxSort === 'price') ? b.avg - a.avg : b.sales7d - a.sales7d) || a.id.localeCompare(b.id))
  const visible = ranked.slice(0, 50)
  const note = moving ? `${period === 'day' ? '前日' : '7日前'}と集計基準日の両方に価格記録がある商品の騰落率。比較日が欠ける商品は掲載しません。`
    : tab === 'price' || (tab === 'boxes' && boxSort === 'price') ? '記録日の成約平均価格が高い順。価格の記録日は商品ごとに異なります。'
      : '集計基準日を含む直近7日間の成約件数が多い順。成約が確認できた商品を掲載しています。'
  return <div>
    <div className="rank-tabs" role="tablist" aria-label="ランキングの種類">{tabs.map(([id, label], index) => <button
      key={id} id={`op-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="op-ranking-panel"
      tabIndex={tab === id ? 0 : -1} className={`rank-tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}
      onKeyDown={e => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
        e.preventDefault()
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        setTab(tabs[next][0]); document.getElementById(`op-tab-${tabs[next][0]}`)?.focus()
      }}>{label}</button>)}</div>
    <div className="op-toolbar">
      <label className="op-search">カード名・カード番号<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ルフィ、OP13-118…" /></label>
      <label>収録弾<select value={setId} onChange={e => setSetId(e.target.value)}><option value="">すべての弾</option>{sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {moving && <label>比較期間<select value={period} onChange={e => setPeriod(e.target.value as 'day' | 'week')}><option value="day">前日比</option><option value="week">7日比</option></select></label>}
      {tab === 'boxes' && <label>並び順<select value={boxSort} onChange={e => setBoxSort(e.target.value)}><option value="sales">売れ筋順</option><option value="price">価格が高い順</option></select></label>}
    </div>
    <section id="op-ranking-panel" role="tabpanel" aria-labelledby={`op-tab-${tab}`} tabIndex={0}>
      <p className="source-note">{note}</p>
      <p className={styles.count} aria-live="polite">{ranked.length}件{ranked.length > 50 ? ' · 上位50件を表示' : ''}</p>
      {!visible.length && <div className="op-empty">条件に合う成約データがありません。収録弾や検索条件{moving ? '、比較期間' : ''}を変更してください。</div>}
      <ol className={styles.list}>{visible.map((p, index) => <li key={p.id}><Link href={`/onepiece/products/${p.id}`} className={styles.row}>
        <span className={`${styles.rank} ${index < 3 ? styles.podium : ''}`}>{index + 1}</span>
        <OnePieceImage product={p} className={styles.image} />
        <span className={styles.copy}><strong>{p.name.split('[')[0].trim()}</strong><small>{sets.find(s => s.id === p.set_id)?.name} · {p.card_no ?? '未開封BOX'}</small><small>価格記録 {p.date}</small></span>
        <span className={styles.metric}><strong className={moving ? (p[period]! > 0 ? 'is-up' : 'is-down') : ''}>{moving ? `${p[period]! > 0 ? '+' : ''}${p[period]!.toFixed(1)}%` : tab === 'price' || (tab === 'boxes' && boxSort === 'price') ? yen(p.avg) : `${p.sales7d.toLocaleString('ja-JP')}件`}</strong>
          <small>{moving ? `${period === 'day' ? '前日比' : '7日比'} · ${yen(p.avg)}` : tab === 'price' || (tab === 'boxes' && boxSort === 'price') ? `7日間 ${p.sales7d}件成約` : `7日間 · ${yen(p.avg)}`}</small></span>
      </Link></li>)}</ol>
    </section>
  </div>
}
