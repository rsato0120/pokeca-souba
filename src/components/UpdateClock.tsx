'use client'
import { useEffect, useState } from 'react'
import { getNextMarketUpdateMs, POKEMON_UPDATE_MINUTE_JST } from '@/lib/update-schedule'

// 「最終更新」と「次の更新開始まで」。
//
// 静的サイトは開いても何も動かないので、生きていることが伝わらない。時計だけは
// 秒単位で動くので、データが1日2回しか変わらなくても「回っている」ことが見える。
//
// 最終更新の表記はサーバー側で作った文字列を受け取る（クライアントで日付を整形すると
// タイムゾーンの違いでハイドレーション不一致になる）。カウントダウンはマウント後に出す。

function hhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function UpdateClock({ updatedLabel, minute = POKEMON_UPDATE_MINUTE_JST }: { updatedLabel: string | null; minute?: number }) {
  const [left, setLeft] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => setLeft(hhmmss(getNextMarketUpdateMs(Date.now(), minute) - Date.now()))
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
          次の更新開始まで <span style={{ fontVariantNumeric: 'tabular-nums' }}>{left}</span>
        </span>
      )}
    </span>
  )
}
