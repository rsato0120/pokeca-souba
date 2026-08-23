'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import WatchButton from '@/components/WatchButton'

// カードスクリーナー。株の銘柄スクリーナーと同じ役割 —
// 「条件を指定して475枚から絞り込む」ための唯一の画面。
//
// 絞り込みも並べ替えも全部クライアントで完結させる（SSGのまま動かすため）。
// 1枚あたりの行データは20項目程度・475枚で数百KBに収まるので、
// ページに焼いてしまう方がAPIを生やすより速いし壊れにくい。

export interface ScreenerRow {
  id: string
  name: string
  rarity: string
  boxId: string
  boxName: string
  image: string | null
  /** 現在の代表値。0 = 相場データ未取得 */
  mid: number
  dayChange: number | null
  weekChange: number | null
  onSale: number | null
  /** AIの上昇確率(%) */
  upPct: number | null
  /** AIの3ヶ月後 本線の上昇率(%) */
  upsidePct: number | null
  psa10: number | null
  /** 全期間の高値からの下落率(%)。0に近いほど高値圏 */
  offHigh: number | null
  /** 全期間の値幅の中の位置(0=最安, 100=最高) */
  rangePos: number | null
}

interface Props {
  rows: ScreenerRow[]
  boxes: { box_id: string; box_name: string }[]
  rarities: string[]
  /** 相場指数の7日変化率(%)。各行の「市場比」はこれを引いて出す */
  index7d: number | null
}

type SortKey = 'mid' | 'dayChange' | 'weekChange' | 'onSale' | 'upPct' | 'upsidePct' | 'psa10' | 'offHigh' | 'rel' | 'name'
type Dir = 'asc' | 'desc'

const PAGE = 80

const COLUMNS: { key: SortKey; label: string; width: string; help?: string }[] = [
  { key: 'mid', label: '相場', width: '86px' },
  { key: 'dayChange', label: '前日比', width: '72px' },
  { key: 'weekChange', label: '7日比', width: '72px' },
  { key: 'rel', label: '市場比', width: '72px', help: '7日比 − 相場指数の7日比。正なら市場より強い' },
  { key: 'onSale', label: '出品', width: '58px', help: 'メルカリの出品中件数（供給圧）' },
  { key: 'upPct', label: 'AI上昇', width: '68px', help: 'AIが見る上昇確率' },
  { key: 'offHigh', label: '高値から', width: '76px', help: '全期間の高値からの下落率' },
  { key: 'psa10', label: 'PSA10', width: '86px' },
]

/** 市場比 = 7日比 − 相場指数の7日比。指数が出せない期間は null */
function relOf(r: ScreenerRow, index7d: number | null): number | null {
  return r.weekChange != null && index7d != null ? r.weekChange - index7d : null
}

function fmtPct(v: number | null, digits = 1): { text: string; color: string } {
  if (v == null) return { text: '—', color: 'var(--ink-faint)' }
  const color = v > 0.5 ? 'var(--up)' : v < -0.5 ? 'var(--down)' : 'var(--flat)'
  return { text: `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`, color }
}

export default function ScreenerTable({ rows, boxes, rarities, index7d }: Props) {
  const [q, setQ] = useState('')
  const [box, setBox] = useState('')
  const [rarity, setRarity] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [risingOnly, setRisingOnly] = useState(false)
  const [aiUpOnly, setAiUpOnly] = useState(false)
  const [psaOnly, setPsaOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('mid')
  const [dir, setDir] = useState<Dir>('desc')
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const min = priceMin ? Number(priceMin) : null
    const max = priceMax ? Number(priceMax) : null

    return rows.filter((r) => {
      if (query) {
        const hay = `${r.name} ${r.rarity} ${r.boxName}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      if (box && r.boxId !== box) return false
      if (rarity && r.rarity !== rarity) return false
      if (min != null && !(r.mid >= min)) return false
      if (max != null && !(r.mid > 0 && r.mid <= max)) return false
      if (risingOnly && !(r.weekChange != null && r.weekChange > 0)) return false
      if (aiUpOnly && !(r.upsidePct != null && r.upsidePct > 0)) return false
      if (psaOnly && r.psa10 == null) return false
      return true
    })
  }, [rows, q, box, rarity, priceMin, priceMax, risingOnly, aiUpOnly, psaOnly])

  const sorted = useMemo(() => {
    const val = (r: ScreenerRow): number | string | null => {
      switch (sort) {
        case 'name': return r.name
        case 'rel': return relOf(r, index7d)
        default: return r[sort]
      }
    }
    const sign = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      // 欠測は常に末尾。昇順でも「データ無し」が先頭に並ぶと使い物にならない
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'ja') * sign
      }
      return (va - vb) * sign
    })
  }, [filtered, sort, dir, index7d])

  const shown = sorted.slice(0, limit)

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      // 価格・変化率は「大きい順」、名前は「あいうえお順」が自然な初期方向
      setDir(key === 'name' ? 'asc' : 'desc')
    }
    setLimit(PAGE)
  }

  const reset = () => {
    setQ(''); setBox(''); setRarity(''); setPriceMin(''); setPriceMax('')
    setRisingOnly(false); setAiUpOnly(false); setPsaOnly(false)
    setSort('mid'); setDir('desc'); setLimit(PAGE)
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--fs-sm)',
    padding: '7px 10px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--hair)',
    background: 'var(--bg2)',
    color: 'var(--ink)',
    minWidth: 0,
  }

  const chip = (on: boolean): React.CSSProperties => ({
    fontFamily: 'var(--mono)',
    fontSize: 'var(--fs-xs)',
    letterSpacing: '0.04em',
    padding: '6px 12px',
    borderRadius: 'var(--r-pill)',
    border: `1px solid ${on ? 'var(--gold)' : 'var(--hair)'}`,
    background: on ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'transparent',
    color: on ? 'var(--gold)' : 'var(--ink-dim)',
    cursor: 'pointer',
    fontWeight: on ? 700 : 500,
  })

  return (
    <div>
      {/* ── 条件 ── */}
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          marginBottom: 'var(--sp-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-2)' }}>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
            placeholder="カード名・弾で検索"
            aria-label="カード名で絞り込む"
            style={{ ...inputStyle, gridColumn: 'span 2' }}
          />
          <select value={box} onChange={(e) => { setBox(e.target.value); setLimit(PAGE) }} aria-label="収録弾" style={inputStyle}>
            <option value="">すべての弾</option>
            {boxes.map((b) => <option key={b.box_id} value={b.box_id}>{b.box_name}</option>)}
          </select>
          <select value={rarity} onChange={(e) => { setRarity(e.target.value); setLimit(PAGE) }} aria-label="レアリティ" style={inputStyle}>
            <option value="">すべてのレアリティ</option>
            {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number" inputMode="numeric" value={priceMin}
              onChange={(e) => { setPriceMin(e.target.value); setLimit(PAGE) }}
              placeholder="下限¥" aria-label="価格の下限"
              style={{ ...inputStyle, width: '100%' }}
            />
            <span style={{ color: 'var(--ink-faint)' }}>–</span>
            <input
              type="number" inputMode="numeric" value={priceMax}
              onChange={(e) => { setPriceMax(e.target.value); setLimit(PAGE) }}
              placeholder="上限¥" aria-label="価格の上限"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => { setRisingOnly(v => !v); setLimit(PAGE) }} style={chip(risingOnly)}>
            7日で上昇
          </button>
          <button type="button" onClick={() => { setAiUpOnly(v => !v); setLimit(PAGE) }} style={chip(aiUpOnly)}>
            AIが上昇と予想
          </button>
          <button type="button" onClick={() => { setPsaOnly(v => !v); setLimit(PAGE) }} style={chip(psaOnly)}>
            PSA10相場あり
          </button>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>
            {filtered.length}件 / 全{rows.length}枚
          </span>
          <button
            type="button" onClick={reset}
            style={{ ...chip(false), borderStyle: 'dashed' }}
          >
            条件をクリア
          </button>
        </div>
      </div>

      {/* ── 一覧 ── */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--hair)', borderRadius: 'var(--r-lg)', background: 'var(--panel)' }}>
        <table className="data-table" style={{ minWidth: '840px' }}>
          <thead>
            <tr>
              <th className="dt-sticky dt-sortable" onClick={() => toggleSort('name')}>
                カード {sort === 'name' && (dir === 'asc' ? '▲' : '▼')}
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="dt-sortable"
                  onClick={() => toggleSort(c.key)}
                  title={c.help}
                  style={{ color: sort === c.key ? 'var(--gold)' : undefined, minWidth: c.width }}
                >
                  {c.label} {sort === c.key && (dir === 'asc' ? '▲' : '▼')}
                </th>
              ))}
              <th style={{ width: '44px' }} />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const day = fmtPct(r.dayChange)
              const week = fmtPct(r.weekChange)
              const rel = fmtPct(relOf(r, index7d))
              return (
                <tr key={r.id}>
                  <td className="dt-sticky">
                    <Link href={`/cards/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'inherit' }}>
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.image} alt="" loading="lazy" decoding="async"
                          referrerPolicy="no-referrer" className="row-thumb"
                        />
                      ) : (
                        <span className="row-thumb row-thumb-ph">—</span>
                      )}
                      <span style={{ minWidth: 0 }}>
                        <span className="row-name" style={{ display: 'block' }}>{r.name}</span>
                        <span className="row-meta">{r.rarity} · {r.boxName}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="dt-num dt-price">
                    {r.mid > 0 ? `¥${Math.round(r.mid).toLocaleString()}` : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                  </td>
                  <td className="dt-num" style={{ color: day.color }}>{day.text}</td>
                  <td className="dt-num" style={{ color: week.color }}>{week.text}</td>
                  <td className="dt-num" style={{ color: rel.color }}>{rel.text}</td>
                  <td className="dt-num" style={{ color: 'var(--ink-dim)' }}>{r.onSale ?? '—'}</td>
                  <td className="dt-num" style={{ color: 'var(--gold)' }}>
                    {r.upPct != null ? `${r.upPct}%` : '—'}
                  </td>
                  <td className="dt-num" style={{ color: 'var(--ink-dim)' }}>
                    {r.offHigh != null ? `−${r.offHigh.toFixed(1)}%` : '—'}
                  </td>
                  <td className="dt-num" style={{ color: '#6c8ebf' }}>
                    {r.psa10 != null ? `¥${r.psa10.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ textAlign: 'center', padding: 'var(--sp-2) 0' }}>
                    {/* 登録時の相場を控えておく。これが無いとウォッチリストの「登録来」が出せない */}
                    <WatchButton cardId={r.id} mid={r.mid} compact />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 'var(--fs-base)' }}>
          条件に合うカードがありません。条件をゆるめてみてください。
        </div>
      )}

      {sorted.length > shown.length && (
        <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)',
              padding: '10px 24px', borderRadius: 'var(--r-pill)',
              border: '1px solid var(--hair)', background: 'var(--bg2)',
              color: 'var(--ink-dim)', cursor: 'pointer', letterSpacing: '0.05em',
            }}
          >
            さらに{Math.min(PAGE, sorted.length - shown.length)}件を表示（残り{sorted.length - shown.length}件）
          </button>
        </div>
      )}
    </div>
  )
}
