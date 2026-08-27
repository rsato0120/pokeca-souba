import type { Badge, RankState } from '@/lib/badges'
import { RANKS } from '@/lib/badges'
import BallIcon from '@/components/BallIcon'

// 称号バッジの表示。獲得済みは金の札、次の称号は進捗バー付きで薄く出す。
// 「あと◯種」「¥62,300 / ¥100,000」と残りが見える形にして、集める動機にする。

function EarnedBadge({ badge }: { badge: Badge }) {
  return (
    <div
      title={`${badge.desc}（${badge.detail}）`}
      style={{
        display: 'flex', flexDirection: 'column', gap: '2px',
        padding: '10px 14px',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--r-md)',
        background: 'linear-gradient(160deg, rgba(169,123,31,0.10), rgba(169,123,31,0.02))',
        minWidth: 0,
      }}
    >
      <span style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--accent)', lineHeight: 1.3 }}>
        {badge.name}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>
        {badge.detail}
      </span>
    </div>
  )
}

function NextBadge({ badge }: { badge: Badge }) {
  return (
    <div style={{ padding: '10px 14px', border: '1px dashed var(--hair)', borderRadius: 'var(--r-md)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--sp-2)' }}>
        <span style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--ink-dim)' }}>
          {badge.name}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
          {badge.detail}
        </span>
      </div>
      {/* 進捗バー。比率は width で持ち、伸びる演出だけ .anim-grow の scaleX に任せる。
          ⚠ 比率まで inline の transform で書くと .anim-grow の最終キーフレーム
          （scaleX(1)）に上書きされ、全部のバーが満タンで表示される。 */}
      <div style={{ height: '4px', borderRadius: '999px', background: 'var(--hair)', marginTop: '8px', overflow: 'hidden' }}>
        <div
          className="anim-grow"
          style={{
            height: '100%', borderRadius: '999px', background: 'var(--accent)', opacity: 0.65,
            width: `${(badge.progress * 100).toFixed(1)}%`,
          }}
        />
      </div>
    </div>
  )
}

// 総合ランク。コレクションの「格」を1つだけ大きく出す枠。
function RankHero({ state }: { state: RankState }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
      <BallIcon rank={state.rank.id} size={52} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>
          コレクションランク
        </p>
        <p style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3 }}>
          {state.rank.name}
        </p>
        {state.next ? (
          <>
            {/* 幅が足りない時はボール名の途中で割らず、金額ごと次の行へ落とす */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                次は {state.next.name}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                {state.detail}
              </span>
            </div>
            {/* 比率は width で持つ（inline transform は .anim-grow の scaleX(1) に潰される） */}
            <div style={{ height: '5px', borderRadius: '999px', background: 'var(--hair)', marginTop: '5px', overflow: 'hidden' }}>
              <div className="anim-grow" style={{ height: '100%', borderRadius: '999px', background: 'var(--accent)', width: `${(state.progress * 100).toFixed(1)}%` }} />
            </div>
          </>
        ) : (
          <p style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--accent)', marginTop: '6px' }}>
            最高ランク到達　{state.detail}
          </p>
        )}
      </div>
    </div>
  )
}

export default function CollectionBadges({ rank, earned, next }: { rank: RankState; earned: Badge[]; next: Badge[] }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: 'var(--sp-4)' }}>
      <RankHero state={rank} />

      {/* 段の全体像。今どこにいて、あと何段あるかが一目で分かる */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap', paddingBottom: 'var(--sp-4)', marginBottom: 'var(--sp-4)', borderBottom: '1px solid var(--hair)' }}>
        {RANKS.map(r => {
          const reached = rank.rank.need >= r.need
          return (
            <span key={r.id} title={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', opacity: reached ? 1 : 0.3 }}>
              <BallIcon rank={r.id} size={18} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: reached ? 'var(--ink-dim)' : 'var(--ink-faint)' }}>
                {r.name.replace('ボール', '')}
              </span>
            </span>
          )
        })}
      </div>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', marginBottom: 'var(--sp-3)' }}>
        称号 {earned.length > 0 && `（${earned.length}）`}
      </p>

      {earned.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--sp-2)' }}>
          {earned.map(b => <EarnedBadge key={b.id} badge={b} />)}
        </div>
      )}

      {next.length > 0 && (
        <>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', margin: `${earned.length > 0 ? 'var(--sp-4)' : '0'} 0 var(--sp-2)` }}>
            次の称号
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--sp-2)' }}>
            {next.slice(0, 4).map(b => <NextBadge key={b.id} badge={b} />)}
          </div>
        </>
      )}
    </div>
  )
}
