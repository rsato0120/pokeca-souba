'use client'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

// 「みんなの予想」＝カードごとの強気/弱気投票＋一言。
// AI予想の真横に置いて対比させるのがこの機能の主眼なので、AI側の確率も受け取る。

type Stance = 'bull' | 'bear'
type VoteRow = { stance: Stance; comment: string | null; created_at: string }

const MAX_COMMENT = 50

export default function CardSentiment({ cardId, ai }: { cardId: string; ai: { up: number; down: number } }) {
  const sb = getSupabase()
  const [rows, setRows] = useState<VoteRow[] | null>(null)
  const [myStance, setMyStance] = useState<Stance | null>(null)
  const [myComment, setMyComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const load = useCallback(async (client: SupabaseClient) => {
    const { data, error } = await client
      .from('card_votes')
      .select('stance, comment, created_at')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) { setError('投稿の読み込みに失敗しました'); return }
    setRows((data ?? []) as VoteRow[])

    // 既にこの端末で投票済みなら自分の票を復元する（未ログインなら何もしない）
    const { data: { session } } = await client.auth.getSession()
    if (!session?.user) return
    const { data: mine } = await client
      .from('card_votes')
      .select('stance, comment')
      .eq('card_id', cardId)
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (mine) {
      setMyStance(mine.stance as Stance)
      setMyComment(mine.comment ?? '')
    }
  }, [cardId])

  useEffect(() => {
    if (!sb) return
    // 外部システム（Supabase）からの初回取得。await を挟むので同期的な setState ではないが、
    // ルールは呼び出し先まで追えないため明示的に抑制する（useCollection.ts と同じ扱い）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(sb)
  }, [sb, load])

  // 匿名ユーザーは「投票しようとした瞬間」に初めて発行する。
  // マウント時に作ると、一度も投稿しない閲覧者ぶんまで auth.users が膨らむ。
  const ensureUserId = useCallback(async (client: SupabaseClient): Promise<string | null> => {
    const { data: { session } } = await client.auth.getSession()
    if (session?.user) return session.user.id
    const { data, error } = await client.auth.signInAnonymously()
    if (error) return null
    return data.user?.id ?? null
  }, [])

  const submit = useCallback(async (stance: Stance, comment: string) => {
    if (!sb || busy) return
    setBusy(true); setError(null); setSavedNote(null)
    const uid = await ensureUserId(sb)
    if (!uid) { setError('投稿の準備に失敗しました。時間をおいて試してください'); setBusy(false); return }

    const trimmed = comment.trim().slice(0, MAX_COMMENT)
    const { error } = await sb
      .from('card_votes')
      .upsert(
        { card_id: cardId, user_id: uid, stance, comment: trimmed === '' ? null : trimmed },
        { onConflict: 'card_id,user_id' },
      )
    if (error) {
      setError('投稿に失敗しました')
    } else {
      setMyStance(stance)
      setSavedNote(myStance === null ? '投票しました' : '投票を更新しました')
      await load(sb)
    }
    setBusy(false)
  }, [sb, busy, cardId, ensureUserId, load, myStance])

  // 環境変数が未設定のときは何も描画しない（サイト本体は無傷のまま）
  if (!sb) return null

  const bull = rows?.filter(r => r.stance === 'bull').length ?? 0
  const bear = rows?.filter(r => r.stance === 'bear').length ?? 0
  const total = bull + bear
  const bullPct = total > 0 ? Math.round((bull / total) * 100) : 0
  const bearPct = total > 0 ? 100 - bullPct : 0
  const comments = (rows ?? []).filter(r => r.comment && r.comment.trim() !== '').slice(0, 8)

  const voteBtn = (stance: Stance): React.CSSProperties => {
    const active = myStance === stance
    const accent = stance === 'bull' ? 'var(--up)' : 'var(--down)'
    return {
      flex: 1,
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${active ? accent : 'var(--hair)'}`,
      background: active ? accent : 'transparent',
      color: active ? 'var(--bg)' : 'var(--ink-dim)',
      fontFamily: 'var(--mono)',
      fontSize: '13px',
      fontWeight: 700,
      letterSpacing: '0.04em',
      cursor: busy ? 'default' : 'pointer',
      opacity: busy ? 0.6 : 1,
    }
  }

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--hair)', borderRadius: '8px', padding: '20px', marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mincho)', fontSize: '16px', fontWeight: 700 }}>みんなの予想</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)' }}>
          {rows === null ? '読み込み中…' : `${total}票`}
        </span>
      </div>

      {/* AI予想との対比。この並びが機能の主眼なので票が0でも枠は出す */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div style={{ border: '1px solid var(--hair)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>AI予想</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>
            <span style={{ color: 'var(--up)', fontWeight: 700 }}>↑ {ai.up}%</span>
            <span style={{ color: 'var(--down)', fontWeight: 700, marginLeft: '10px' }}>↓ {ai.down}%</span>
          </div>
        </div>
        <div style={{ border: '1px solid var(--hair)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>みんなの予想</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>
            {total === 0 ? (
              <span style={{ color: 'var(--ink-faint)' }}>まだ票がありません</span>
            ) : (
              <>
                <span style={{ color: 'var(--up)', fontWeight: 700 }}>強気 {bullPct}%</span>
                <span style={{ color: 'var(--down)', fontWeight: 700, marginLeft: '10px' }}>弱気 {bearPct}%</span>
              </>
            )}
          </div>
        </div>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--hair)', marginBottom: '16px' }}>
          <div style={{ width: `${bullPct}%`, background: 'var(--up)' }} />
          <div style={{ width: `${bearPct}%`, background: 'var(--down)' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <button type="button" disabled={busy} onClick={() => submit('bull', myComment)} style={voteBtn('bull')}>
          強気 {myStance === 'bull' ? '✓' : ''}
        </button>
        <button type="button" disabled={busy} onClick={() => submit('bear', myComment)} style={voteBtn('bear')}>
          弱気 {myStance === 'bear' ? '✓' : ''}
        </button>
      </div>

      {/* 一言は任意。投票済みの人だけに出して、投票の心理的ハードルを上げない */}
      {myStance && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            maxLength={MAX_COMMENT}
            value={myComment}
            placeholder={`一言（任意・${MAX_COMMENT}字まで）`}
            onChange={e => setMyComment(e.target.value)}
            style={{
              flex: '1 1 200px', padding: '7px 10px', borderRadius: '6px',
              border: '1px solid var(--hair)', background: 'var(--bg2)',
              color: 'var(--ink)', fontSize: '13px',
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(myStance, myComment)}
            style={{
              padding: '7px 16px', borderRadius: '6px', border: '1px solid var(--gold)',
              background: 'transparent', color: 'var(--gold)', fontFamily: 'var(--mono)',
              fontSize: '12px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            保存
          </button>
        </div>
      )}

      {(savedNote || error) && (
        <p style={{ fontSize: '12px', color: error ? 'var(--down)' : 'var(--ink-faint)', marginBottom: '10px' }}>
          {error ?? savedNote}
        </p>
      )}

      {comments.length > 0 && (
        <div style={{ borderTop: '1px solid var(--hair)', paddingTop: '12px' }}>
          {comments.map((c, i) => (
            <div key={`${c.created_at}-${i}`} style={{ display: 'flex', gap: '10px', alignItems: 'baseline', padding: '5px 0' }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700, flexShrink: 0,
                color: c.stance === 'bull' ? 'var(--up)' : 'var(--down)',
                border: `1px solid ${c.stance === 'bull' ? 'var(--up)' : 'var(--down)'}`,
                borderRadius: '4px', padding: '1px 5px',
              }}>
                {c.stance === 'bull' ? '強気' : '弱気'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>{c.comment}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px', lineHeight: 1.7 }}>
        投票はログイン不要（1カード1票・押し直しで変更できます）。投稿内容は他の閲覧者にも表示されます。
      </p>
    </div>
  )
}
