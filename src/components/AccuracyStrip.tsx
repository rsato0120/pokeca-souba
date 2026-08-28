import Link from 'next/link'
import type { AccuracySummary, Dir } from '@/lib/accuracy'

// AI予想実績のダイジェスト。トップの看板2つの直後に置き、「AIが見つけた」と言い切る前に
// **その予想がどれだけ当たってきたか**を先に見せる。
//
// 数字は既存の src/lib/accuracy.ts（/accuracy ページと同じ計算）をそのまま使う。
// 的中判定は「上昇/下落は符号、横ばいは±10%以内」で、みんなの予想の的中率と同じ式。
//
// ⚠ 確定した予想が少ないうちは出さない。母数10件で「的中率70%」と出すのは、
//   数字の見た目だけ作って中身が無い。MIN_RESOLVED 未満なら枠ごと隠す。
const MIN_RESOLVED = 20

const DIR_LABEL: Record<Dir, string> = { up: '強気', flat: '様子見', down: '弱気' }

export default function AccuracyStrip({ summary }: { summary: AccuracySummary }) {
  // 30日予想を主に見せる（7日は値動きのノイズを拾いやすい）
  const stat = summary.byHorizon[30] ?? summary.byHorizon[7]
  if (!stat || stat.resolved < MIN_RESOLVED) return null

  const horizon = summary.byHorizon[30] && summary.byHorizon[30].resolved >= MIN_RESOLVED ? 30 : 7

  const dirs: Dir[] = ['up', 'down']

  return (
    <div className="acc-strip">
      <div className="acc-main">
        <div className="pulse-label">AI予想の的中率（{horizon}日先）</div>
        <div className="acc-rate">
          {stat.rate.toFixed(1)}<span className="acc-rate-unit">%</span>
        </div>
        <div className="acc-sub">{stat.resolved}件の予想が答え合わせ済み</div>
      </div>

      <div className="acc-dirs">
        {dirs.map(d => {
          const b = stat.byDir[d]
          if (!b || b.resolved === 0) return null
          const rate = (b.hits / b.resolved) * 100
          return (
            <div key={d} className="acc-dir">
              <div className="pulse-label">{DIR_LABEL[d]}予想</div>
              <div className="acc-dir-rate" style={{ color: d === 'up' ? 'var(--up)' : 'var(--down)' }}>
                {rate.toFixed(0)}%
              </div>
              <div className="acc-dir-n">{b.resolved}件</div>
            </div>
          )
        })}
        <div className="acc-dir">
          <div className="pulse-label">判定待ち</div>
          <div className="acc-dir-rate" style={{ color: 'var(--ink-dim)' }}>{summary.pendingCount}</div>
          <div className="acc-dir-n">件</div>
        </div>
      </div>

      <Link href="/accuracy" className="acc-link">
        予想と結果を1件ずつ見る →
      </Link>
    </div>
  )
}
