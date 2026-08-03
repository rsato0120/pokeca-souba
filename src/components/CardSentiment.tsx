'use client'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { STANCES, STANCE_LABEL, STANCE_COLOR, type Stance } from '@/lib/stance'

// 「みんなの予想」＝カードごとの投票＋一言。
// AI予想の真横に置いて対比させるのがこの機能の主眼なので、AI側の確率も受け取る。
//
// 選択肢は AI と同じ 上昇/横ばい/下落 の3区分（2026-08-04 に強気/弱気の2択から変更）。
// 2択だと横ばい派の行き場が無く、その票が上昇か下落に押し込まれて分布が歪むため、
// 「AIとみんなの予想を並べて見比べる」という主眼が成立しなかった。

type VoteRow = { stance: Stance; comment: string | null; created_at: string }

const MAX_COMMENT = 50
const MAX_NAME = 16

export default function CardSentiment({
  cardId,
  ai,
}: {
  cardId: string
  ai: { up: number; flat: number; down: number }
}) {
  const sb = getSupabase()
  const [rows, setRows] = useState<VoteRow[] | null>(null)
  const [myStance, setMyStance] = useState<Stance | null>(null)
  const [myComment, setMyComment] = useState('')
  const [myName, setMyName] = useState('')
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
    // 表示名は的中率ランキングでしか使わないので、取れなくても投票は成立させる
    const { data: profile } = await client
      .from('profiles')
      .select('display_name')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (profile?.display_name) setMyName(profile.display_name)
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

  const submit = useCallback(async (stance: Stance, comment: string, name: string) => {
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
      setBusy(false)
      return
    }

    // 表示名は任意。ここで失敗しても投票は既に保存されているので巻き戻さず、
    // 「投票は通ったが名前は保存できなかった」ことが分かる文言を出す。
    let nameError: string | null = null
    const trimmedName = name.trim().slice(0, MAX_NAME)
    if (trimmedName !== '') {
      const { error: profileError } = await sb
        .from('profiles')
        .upsert({ user_id: uid, display_name: trimmedName }, { onConflict: 'user_id' })
      if (profileError) {
        // 23505=一意制約違反（他の人が使っている名前）, 23514=check違反（空白のみ/「ゲスト」始まり）
        nameError = profileError.code === '23505'
          ? `表示名「${trimmedName}」は既に他の方が使っています。別の名前にしてください（投票は保存済みです）`
          : profileError.code === '23514'
          ? 'その表示名は使えません（「ゲスト」で始まる名前は不可）。投票は保存済みです'
          : '表示名を保存できませんでした（投票は保存済みです）'
      }
    }

    setMyStance(stance)
    if (nameError) setError(nameError)
    else setSavedNote(myStance === null ? '投票しました' : '投票を更新しました')
    await load(sb)
    setBusy(false)
  }, [sb, busy, cardId, ensureUserId, load, myStance])

  // 環境変数が未設定のときは何も描画しない（サイト本体は無傷のまま）
  if (!sb) return null

  const counts = {
    up: rows?.filter(r => r.stance === 'up').length ?? 0,
    flat: rows?.filter(r => r.stance === 'flat').length ?? 0,
    down: rows?.filter(r => r.stance === 'down').length ?? 0,
  }
  const total = counts.up + counts.flat + counts.down
  // 合計をぴったり100%にするため、最後の区分は引き算で出す（四捨五入で101%になるのを防ぐ）
  const pct = {
    up: total > 0 ? Math.round((counts.up / total) * 100) : 0,
    flat: total > 0 ? Math.round((counts.flat / total) * 100) : 0,
    down: 0,
  }
  pct.down = total > 0 ? Math.max(0, 100 - pct.up - pct.flat) : 0

  const comments = (rows ?? []).filter(r => r.comment && r.comment.trim() !== '').slice(0, 8)

  const voteBtn = (stance: Stance): React.CSSProperties => {
    const active = myStance === stance
    const accent = STANCE_COLOR[stance]
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

  const aiPct: Record<Stance, number> = { up: ai.up, flat: ai.flat, down: ai.down }

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--hair)', borderRadius: '8px', padding: '20px', marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mincho)', fontSize: '16px', fontWeight: 700 }}>みんなの予想</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)' }}>
          {rows === null ? '読み込み中…' : `${total}票`}
        </span>
      </div>

      {/* AI予想との対比。この並びが機能の主眼なので票が0でも枠は出す。
          3区分を同じ順・同じ色で並べることで、AIと人の食い違いが一目で分かる */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div style={{ border: '1px solid var(--hair)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>AI予想</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {STANCES.map(s => (
              <span key={s} style={{ color: STANCE_COLOR[s], fontWeight: 700 }}>
                {STANCE_LABEL[s]} {aiPct[s]}%
              </span>
            ))}
          </div>
        </div>
        <div style={{ border: '1px solid var(--hair)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>みんなの予想</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {total === 0 ? (
              <span style={{ color: 'var(--ink-faint)' }}>まだ票がありません</span>
            ) : (
              STANCES.map(s => (
                <span key={s} style={{ color: STANCE_COLOR[s], fontWeight: 700 }}>
                  {STANCE_LABEL[s]} {pct[s]}%
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--hair)', marginBottom: '16px' }}>
          {STANCES.map(s => (
            <div
              key={s}
              style={{
                width: `${pct[s]}%`,
                background: STANCE_COLOR[s],
                // 票が入って割合が変わったとき、幅がぬるっと動くようにする。
                // ここは scaleX ではなく width を遷移させる（3本が隣り合っていて、
                // scaleX だと隙間が空いてしまうため）
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        {STANCES.map(s => (
          <button key={s} type="button" disabled={busy} onClick={() => submit(s, myComment, myName)} style={voteBtn(s)}>
            {STANCE_LABEL[s]} {myStance === s ? '✓' : ''}
          </button>
        ))}
      </div>

      {/* 一言・表示名は任意。投票済みの人だけに出して、投票の心理的ハードルを上げない */}
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
          <input
            type="text"
            maxLength={MAX_NAME}
            value={myName}
            placeholder={`表示名（任意・${MAX_NAME}字まで）`}
            onChange={e => setMyName(e.target.value)}
            style={{
              flex: '0 1 150px', padding: '7px 10px', borderRadius: '6px',
              border: '1px solid var(--hair)', background: 'var(--bg2)',
              color: 'var(--ink)', fontSize: '13px',
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(myStance, myComment, myName)}
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
                color: STANCE_COLOR[c.stance],
                border: `1px solid ${STANCE_COLOR[c.stance]}`,
                borderRadius: '4px', padding: '1px 5px',
              }}>
                {STANCE_LABEL[c.stance]}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>{c.comment}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px', lineHeight: 1.7 }}>
        投票はログイン不要（1カード1票・押し直しで変更できます）。投稿内容は他の閲覧者にも表示されます。
        表示名を入れると<a href="/ranking" style={{ color: 'var(--gold)' }}>的中率ランキング</a>に名前が出ます（先着順・他の方と同じ名前は使えません）。
      </p>
    </div>
  )
}
