import type { CardScore } from '@/lib/score'

// カード詳細の「AI投資スコア」と「AI予想の根拠」。
//
// スコアだけ出しても信用されないので、**何を見て何点になったか**を必ず並べる。
// プラス要因・マイナス要因を色で分け、評価できなかった項目は「対象外」として明示する
// （材料が揃っている銘柄と揃っていない銘柄が同じ顔で並ぶと、点差が実力差に見える）。

export default function CardScorePanel({ score }: { score: CardScore }) {
  const pos = score.factors.filter(f => f.points > 0)
  const neg = score.factors.filter(f => f.points < 0)
  const maxAbs = Math.max(1, ...score.factors.map(f => Math.abs(f.points)))

  return (
    <div className="score-panel">
      <div className="score-head">
        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>AI投資スコア</div>
          <div className="score-total">
            {score.total}<span className="score-total-max"> / 100</span>
          </div>
        </div>
        <div className="score-bars">
          {score.bars.map(b => (
            <div key={b.label} className="score-bar-row" title={b.detail}>
              <span className="score-bar-label">{b.label}</span>
              <span className="score-bar-track">
                <span className="score-bar-fill" style={{ width: `${b.value}%` }} />
              </span>
              <span className="score-bar-val">{b.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="score-factors">
        <div className="pulse-label" style={{ marginBottom: 'var(--sp-2)' }}>スコアの内訳</div>
        {[...pos, ...neg].map(f => (
          <div key={f.key} className="score-factor">
            <span className="score-factor-label">{f.label}</span>
            <span className="score-factor-bar">
              <span
                className="score-factor-fill"
                style={{
                  width: `${(Math.abs(f.points) / maxAbs) * 100}%`,
                  background: f.points >= 0 ? 'var(--up)' : 'var(--down)',
                  marginLeft: f.points >= 0 ? '50%' : `${50 - (Math.abs(f.points) / maxAbs) * 50}%`,
                  maxWidth: '50%',
                }}
              />
            </span>
            <span
              className="score-factor-pts"
              style={{ color: f.points >= 0 ? 'var(--up)' : 'var(--down)' }}
            >
              {f.points >= 0 ? '+' : ''}{f.points}
            </span>
            <span className="score-factor-detail">{f.detail}</span>
          </div>
        ))}
      </div>

      {score.missing.length > 0 && (
        <p className="anom-missing">対象外: {score.missing.join(' / ')}</p>
      )}

      <div className="source-note">
        スコアは 50 を起点に各要因の寄与を足したものです。海外相場・検索量は当サイトでデータを取得していないため要因に含めていません。
      </div>
    </div>
  )
}
