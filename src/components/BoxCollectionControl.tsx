'use client'

import { useCollection, boxKey } from '@/hooks/useCollection'

// BOXページで未開封BOXをコレクションに追加するUI。カード側の CardCollectionControl と
// 同じ localStorage を共有し、マイコレクションの評価額にそのまま合算される。
//
// ⚠ シュリンクあり/なしを別枠にしている。同じ弾でも相場が数千円違うため
//   （ストームエメラルダ: あり¥13,990 / なし¥12,398）、まとめると評価額がずれる。
//   相場が取れていない側は枠を出さない（0円で数えると資産が過少になる）。

interface Props {
  boxId: string
  boxName: string
  /** シュリンクなし・ありの現在相場。取れていなければ null */
  noshrinkMid: number | null
  shrinkMid: number | null
}

export default function BoxCollectionControl({ boxId, boxName, noshrinkMid, shrinkMid }: Props) {
  const { getQty, setQty } = useCollection()

  if (noshrinkMid == null && shrinkMid == null) return null

  const stepper = (label: string, mid: number, shrink: boolean) => {
    const key = boxKey(boxId, shrink)
    const qty = getQty(key)
    return (
      <div key={key} className="boxcol-row" style={{ background: qty > 0 ? 'var(--panel)' : 'transparent' }}>
        <span className="boxcol-label" style={{ color: qty > 0 ? 'var(--accent)' : 'var(--ink-dim)', fontWeight: qty > 0 ? 700 : 500 }}>
          {label}
          <span className="boxcol-price">¥{mid.toLocaleString()}</span>
        </span>
        <span className="boxcol-steps">
          <button type="button" onClick={() => setQty(key, qty - 1)} disabled={qty <= 0} aria-label={`${label}を1減らす`}>−</button>
          <span className="boxcol-qty">{qty}</span>
          <button type="button" onClick={() => setQty(key, qty + 1)} aria-label={`${label}を1増やす`}>＋</button>
        </span>
      </div>
    )
  }

  return (
    <div className="boxcol">
      <div className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>
        MY COLLECTION · 持っている{boxName}を登録
      </div>
      {noshrinkMid != null && stepper('シュリンクなし', noshrinkMid, false)}
      {shrinkMid != null && stepper('シュリンクあり', shrinkMid, true)}
      <div className="source-note">
        登録するとマイコレクションの評価額に合算されます（この端末にだけ保存されます）。
      </div>
    </div>
  )
}
