import type { RankId } from '@/lib/badges'

// 総合ランクのボール。画像を置かずインラインSVGで描く（外部アセットを増やさず、
// ダークテーマでも縁だけ色を持たせれば破綻しない）。
//
// 形は共通で、上半分の色と中央の印だけを段ごとに変える。

const STYLE: Record<RankId, { top: string; bottom: string; ring: string; mark: string | null }> = {
  monster: { top: '#e0313b', bottom: '#f4f5f7', ring: '#2b2f36', mark: null },
  super:   { top: '#2f6fb5', bottom: '#f4f5f7', ring: '#2b2f36', mark: null },
  hyper:   { top: '#2b2f36', bottom: '#f4f5f7', ring: '#2b2f36', mark: '#f2b705' },
  master:  { top: '#6f4fa6', bottom: '#f4f5f7', ring: '#2b2f36', mark: '#e56fa8' },
}

export default function BallIcon({ rank, size = 44 }: { rank: RankId; size?: number }) {
  const s = STYLE[rank]
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      {/* 下半分 → 上半分の順に塗り、真ん中に帯とボタンを重ねる */}
      <circle cx="24" cy="24" r="21" fill={s.bottom} />
      <path d="M3 24a21 21 0 0 1 42 0z" fill={s.top} />
      <rect x="3" y="21.5" width="42" height="5" fill={s.ring} />
      <circle cx="24" cy="24" r="21" fill="none" stroke={s.ring} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="6.5" fill={s.bottom} stroke={s.ring} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="2.6" fill={s.ring} opacity="0.35" />

      {/* ハイパーは上半分の左右に差し色、マスターは上部に2つの点（記号で段を見分ける） */}
      {rank === 'hyper' && s.mark && (
        <>
          <path d="M10 15.5 L16 9.5 L19.5 13 L14 19z" fill={s.mark} />
          <path d="M38 15.5 L32 9.5 L28.5 13 L34 19z" fill={s.mark} />
        </>
      )}
      {rank === 'master' && s.mark && (
        <>
          <circle cx="16" cy="12.5" r="3.4" fill={s.mark} />
          <circle cx="32" cy="12.5" r="3.4" fill={s.mark} />
        </>
      )}
    </svg>
  )
}
