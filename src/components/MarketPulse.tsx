import type { MarketTemp } from '@/lib/market-temp'

// ファーストビュー右の市場サマリー。SOUBA INDEX を「サイト独自の市場指数」として大きく見せる。
//
// ⚠ ここに出すのは**実データで裏が取れる値だけ**。仕様に挙がっていた「取引件数(24h)」は出さない。
//   成約件数はスニダンの売買履歴が唯一の実データ源で、直近7日に成約日を持つカードは
//   556系列中213（38%）、未開封BOXは61系列すべてゼロ（2026-08-28 実測）。
//   24時間という窓では母数がさらに落ちるため、「市場全体の取引件数」として出せる数字にならない。
//   代わりに騰落銘柄数（advance/decline）を出している。指数と意味が地続きで、全銘柄で計算できる。

export interface MarketPulseProps {
  index: number | null
  indexDayPct: number | null
  indexDate: string | null
  temp: MarketTemp
  advancers: number
  decliners: number
  bullish: number
  bearish: number
}

function pctText(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function MarketPulse(p: MarketPulseProps) {
  const dayTone = p.indexDayPct == null ? 'var(--ink-faint)' : p.indexDayPct > 0 ? 'var(--up)' : p.indexDayPct < 0 ? 'var(--down)' : 'var(--ink-dim)'

  return (
    <aside className="pulse">
      <div className="pulse-head">
        <span className="pulse-eyebrow">SOUBA INDEX</span>
        {p.indexDate && (
          <span className="pulse-date">
            {Number(p.indexDate.slice(5, 7))}/{Number(p.indexDate.slice(8, 10))} 時点
          </span>
        )}
      </div>

      <div className="pulse-index">{p.index != null ? p.index.toFixed(2) : '—'}</div>
      <div className="pulse-day" style={{ color: dayTone }}>
        前日比 {pctText(p.indexDayPct)}
      </div>

      {/* 市場温度。指数の水準だけでは熱いか冷えているか読めないので、需給を温度に翻訳する */}
      <div className="pulse-temp">
        <div>
          <div className="pulse-label">今日の市場</div>
          <div className="pulse-mood">
            <span aria-hidden>{p.temp.emoji}</span> {p.temp.label}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pulse-label">市場温度</div>
          <div className="pulse-degree">{p.temp.temp}<span className="pulse-degree-unit">℃</span></div>
        </div>
      </div>

      {/* 温度の帯。0=氷河期 / 100=過熱 */}
      <div className="pulse-gauge" role="img" aria-label={`市場温度 ${p.temp.temp} / 100`}>
        <div className="pulse-gauge-fill" style={{ width: `${p.temp.temp}%` }} />
      </div>

      <div className="pulse-grid">
        <div>
          <div className="pulse-label">値上がり</div>
          <div className="pulse-num" style={{ color: 'var(--up)' }}>{p.advancers}<span className="pulse-unit">銘柄</span></div>
        </div>
        <div>
          <div className="pulse-label">値下がり</div>
          <div className="pulse-num" style={{ color: 'var(--down)' }}>{p.decliners}<span className="pulse-unit">銘柄</span></div>
        </div>
        <div>
          <div className="pulse-label">AI強気</div>
          <div className="pulse-num" style={{ color: 'var(--up)' }}>{p.bullish}<span className="pulse-unit">枚</span></div>
        </div>
        <div>
          <div className="pulse-label">AI弱気</div>
          <div className="pulse-num" style={{ color: 'var(--down)' }}>{p.bearish}<span className="pulse-unit">枚</span></div>
        </div>
      </div>

      <div className="source-note">
        市場温度は騰落レシオ・指数の7日変化・AIの強弱を合成した0〜100の指標です（指数の計算自体は変えていません）。
      </div>
    </aside>
  )
}
