'use client'

import { useState, type ReactNode } from 'react'

// カード詳細のグラフ2枚をタブでまとめる器。
//
// ⚠ 中身の2つは**統合しない**。
//   PriceForecastChart … 過去30日(実線)＋AI予測90日(破線)を1本の時間軸に。現在地に縦線。
//   PriceHistoryChart  … 実績のみ。期間切替(7/30/90日)・出来高・移動平均・全期間の高値安値ライン。
//   1枚にすると、履歴側の7日表示に3ヶ月先の予測を描くことになり軸が破綻する
//   （7日表示から7日移動平均を外したのと同じ理由）。役割が違うので並べるのではなく
//   切り替える。以前は同じページの離れた位置に2枚あり、どちらを見ればいいのか分からなかった。
//
// 器だけなので、どちらのチャートのロジックにも手を入れていない。

export default function CardCharts({
  forecastChart,
  historyChart,
  historyExtras,
}: {
  forecastChart: ReactNode
  historyChart: ReactNode
  /** 履歴タブの上に出す補助表示（全期間の高値安値・値幅の位置など） */
  historyExtras?: ReactNode
}) {
  const [tab, setTab] = useState<'forecast' | 'history'>('forecast')

  const btn = (id: 'forecast' | 'history', label: string, sub: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`chart-tab${tab === id ? ' is-active' : ''}`}
      aria-pressed={tab === id}
    >
      <span className="chart-tab-label">{label}</span>
      <span className="chart-tab-sub">{sub}</span>
    </button>
  )

  return (
    <div className="chart-shell">
      <div className="chart-tabs">
        {btn('forecast', '相場と予測', '実績＋AIの見通し')}
        {btn('history', '詳細チャート', '期間切替・出来高・移動平均')}
      </div>

      {tab === 'forecast' ? (
        forecastChart
      ) : (
        <>
          {historyExtras}
          {historyChart}
        </>
      )}
    </div>
  )
}
