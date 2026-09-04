'use client'
import { useEffect, useState } from 'react'

// 「最終更新」と「次の更新まで」。
//
// 静的サイトは開いても何も動かないので、生きていることが伝わらない。時計だけは
// 秒単位で動くので、データが1日2回しか変わらなくても「回っている」ことが見える。
//
// 最終更新の表記はサーバー側で作った文字列を受け取る（クライアントで日付を整形すると
// タイムゾーンの違いでハイドレーション不一致になる）。カウントダウンはマウント後に出す。

const UPDATE_HOURS_JST = [9, 21]

function nextUpdateMs(now: number, minute: number): number {
  // JSTの壁時計に直してから次の更新時刻を探し、UTCのミリ秒に戻す
  const jstNow = now + 9 * 3600_000
  const dayStart = Math.floor(jstNow / 86400_000) * 86400_000
  for (let d = 0; d <= 1; d++) {
    for (const h of UPDATE_HOURS_JST) {
      const t = dayStart + d * 86400_000 + h * 3600_000 + minute * 60_000
      if (t > jstNow) return t - 9 * 3600_000
    }
  }
  return now
}

function hhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function UpdateClock({ updatedLabel, minute = 0 }: { updatedLabel: string | null; minute?: number }) {
  const [left, setLeft] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => setLeft(hhmmss(nextUpdateMs(Date.now(), minute) - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [minute])

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
      {updatedLabel && (
        <span>
          <span className="live-dot" aria-hidden="true" />
          最終更新 {updatedLabel}
        </span>
      )}
      {left && (
        <span style={{ color: 'var(--ink-faint)' }}>
          次の更新まで <span style={{ fontVariantNumeric: 'tabular-nums' }}>{left}</span>
        </span>
      )}
    </span>
  )
}
