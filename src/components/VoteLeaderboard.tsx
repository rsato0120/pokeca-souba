'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  rankUsers, HORIZON_DAYS, WINDOW_DAYS, MIN_SCORED,
  type PriceMatrix, type RawVote, type ScoredUser,
} from '@/lib/vote-score'
import { FLAT_BAND_PCT } from '@/lib/stance'

// 的中率ランキング。票は Supabase、価格はビルド時に焼いた PriceMatrix を使い、
// 採点はブラウザで行う。こうするとバッチも service_role キーも要らない。
// （票の側に投票時価格を持たせない理由は vote-score.ts のコメント参照）

type Profile = { user_id: string; display_name: string }

// 表示名を設定していない人の自動表示名。UUID先頭6桁＝約1600万通りで、
// 未設定者どうしがぶつかる余地をほぼ潰す（設定済みの名前は profiles の一意索引で重複不可）。
// この「ゲスト」始まりの名前は check 制約で自称できないようにしてある（なりすまし防止）。
function guestName(userId: string): string {
  return `ゲスト${userId.slice(0, 6)}`
}

export default function VoteLeaderboard({ prices, baseDate }: { prices: PriceMatrix; baseDate: string }) {
  const sb = getSupabase()
  const [ranked, setRanked] = useState<ScoredUser[] | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sb) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void (async () => {
      // 採点対象は直近 WINDOW_DAYS 日の票だけ。全期間を引くと票が増えたとき青天井になる
      const since = new Date(Date.now() - (WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await sb
        .from('card_votes')
        .select('card_id, user_id, stance, updated_at')
        .gte('updated_at', since)
        .limit(5000)
      if (error) { setError('ランキングの読み込みに失敗しました'); return }

      const rows = rankUsers((data ?? []) as RawVote[], prices, baseDate)
      setRanked(rows)
      if (rows.length === 0) return

      const { data: profiles } = await sb
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', rows.map(r => r.userId))
      setNames(new Map(((profiles ?? []) as Profile[]).map(p => [p.user_id, p.display_name])))
    })()
  }, [sb, prices, baseDate])

  if (!sb) return null

  return (
    <div className="sec">
      <div className="sec-head">
        <span className="sec-no" style={{ color: 'var(--accent)' }}>—</span>
        <span className="sec-title">予想的中率ランキング</span>
        <span className="sec-sub">投票から{HORIZON_DAYS}日後の値動きで採点</span>
      </div>

      {error ? (
        <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--down)' }}>{error}</div>
      ) : ranked === null ? (
        <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>読み込み中…</div>
      ) : ranked.length === 0 ? (
        <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)', lineHeight: 1.8 }}>
          集計中です。投票から{HORIZON_DAYS}日が経つと採点され、{MIN_SCORED}件以上の予想が採点された人からここに並びます。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ranked.map((u, i) => (
            <div key={u.userId} className="row" style={{ gridTemplateColumns: '32px 1fr auto' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', fontWeight: 700,
                color: i < 3 ? 'var(--accent)' : 'var(--ink-faint)',
              }}>
                {i + 1}
              </div>
              <div>
                <div className="row-name">{names.get(u.userId) ?? guestName(u.userId)}</div>
                <div className="row-meta">
                  {u.scored}件の予想が採点済み · 的中 {u.hits}件
                </div>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', textAlign: 'right', minWidth: '56px' }}>
                <span style={{ color: u.accuracyPct >= 50 ? 'var(--up)' : 'var(--ink-dim)', fontWeight: 700 }}>
                  {u.accuracyPct}%
                </span>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>的中率</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', marginTop: 'var(--sp-3)', lineHeight: 1.8 }}>
        直近{WINDOW_DAYS}日の投票が対象です。投票日の相場と{HORIZON_DAYS}日後の相場を比べ、
        変化率が +{FLAT_BAND_PCT}% より上なら「上昇」、−{FLAT_BAND_PCT}% より下なら「下落」、
        その間なら「横ばい」を的中とします。{MIN_SCORED}件以上採点された人だけを掲載しています。
        表示名はカード詳細ページの投票欄から設定できます（未設定の方はゲスト表示）。
      </p>
    </div>
  )
}
