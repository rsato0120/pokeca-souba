'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

// コレクション評価額が登録者の中でどのあたりかを出す。
//
// マイコレクション本体は localStorage 完結のまま（何を持っているかは送らない）。
// ここで送るのは **評価額の合計・種類数・枚数という数値3つだけ**で、しかもオプトイン。
// 今まで完全にローカルだった機能が黙って送信を始めるのは筋が悪いので、
// 明示的にボタンを押した人だけが参加する。
//
// 他人の生の金額は決して降りてこない（collection_totals の select は自分の行のみ）。
// 順位と分布の代表値は security definer の集計関数ごしにだけ取れる。

// 母数がこれ未満なら「上位◯%」は出さない。
// 数人しかいない状態で「上位20%」と出すのは、数字として意味が無いどころか嘘に近い。
// （みんなの予想で MIN_VOTES=3 にしたら節が一度も出なかったのと同じ轍）
const MIN_SAMPLE = 20
// 中央値は割合より早く意味を持ちはじめるので、しきい値は分けて低めに置く
const MIN_SAMPLE_MEDIAN = 5

// スキーマの check 制約と揃える。桁を間違えた入力が制約違反エラーになって
// 「登録に失敗しました」だけ出るのを防ぐため、クライアント側でも頭を止める
const MAX_TOTAL = 1_000_000_000

type Stats = { my_rank: number; sample_count: number; median_yen: number; p90_yen: number }

export default function CollectionRank({
  totalYen,
  kinds,
  qty,
}: {
  totalYen: number
  kinds: number
  qty: number
}) {
  const sb = getSupabase()
  const [registered, setRegistered] = useState<boolean | null>(null)  // null=判定中
  const [stats, setStats] = useState<Stats | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 評価額は毎日動くので再訪のたびに送り直すが、同じ値なら書かない。
  // boolean ではなく「最後に送った金額」を持つ（枚数を足した直後に順位が
  // 古いまま固まるのを防ぐ）
  const lastSyncedRef = useRef<number | null>(null)

  const clamped = Math.min(Math.round(totalYen), MAX_TOTAL)

  const fetchStats = useCallback(async (client: SupabaseClient, mine: number) => {
    const { data, error } = await client.rpc('collection_percentile', { mine })
    if (error) { setError('順位を取得できませんでした'); return }
    // returns table は行の配列で返る（1行だけ）
    const row = (Array.isArray(data) ? data[0] : data) as Stats | undefined
    if (row) setStats(row)
  }, [])

  const save = useCallback(async (client: SupabaseClient, uid: string) => {
    const { error } = await client
      .from('collection_totals')
      .upsert({ user_id: uid, total_yen: clamped, kinds, qty }, { onConflict: 'user_id' })
    return error
  }, [clamped, kinds, qty])

  // 既に登録済みの人だけ、開いた時点の評価額に更新して順位を引き直す。
  // 未登録の人にはここで匿名ユーザーを発行しない（CardSentiment と同じ方針。
  // マウント時に作ると、参加しない閲覧者ぶんまで auth.users が膨らむ）
  useEffect(() => {
    if (!sb || clamped <= 0) return
    if (registered === false) return                 // 未登録と分かったらもう問い合わせない
    if (lastSyncedRef.current === clamped) return
    // ＋−ボタンを連打すると評価額が1クリックごとに変わる。そのたびに往復すると
    // 書き込みが暴れるので、手が止まってから送る
    const timer = setTimeout(() => {
      lastSyncedRef.current = clamped
      void (async () => {
        const { data: { session } } = await sb.auth.getSession()
        if (!session?.user) { setRegistered(false); return }
        const { data: mine } = await sb
          .from('collection_totals')
          .select('total_yen')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (!mine) { setRegistered(false); return }
        setRegistered(true)
        if (mine.total_yen !== clamped) await save(sb, session.user.id)
        await fetchStats(sb, clamped)
      })()
    }, 600)
    return () => clearTimeout(timer)
  }, [sb, clamped, registered, save, fetchStats])

  const register = useCallback(async () => {
    if (!sb || busy) return
    setBusy(true); setError(null)
    const { data: { session } } = await sb.auth.getSession()
    let uid = session?.user?.id ?? null
    if (!uid) {
      const { data, error } = await sb.auth.signInAnonymously()
      if (error) { setError('登録の準備に失敗しました。時間をおいて試してください'); setBusy(false); return }
      uid = data.user?.id ?? null
    }
    if (!uid) { setError('登録の準備に失敗しました'); setBusy(false); return }

    const saveError = await save(sb, uid)
    if (saveError) { setError('登録に失敗しました'); setBusy(false); return }
    lastSyncedRef.current = clamped   // 直後に上の同期エフェクトが同じ値を書き直さないように
    setRegistered(true)
    await fetchStats(sb, clamped)
    setBusy(false)
  }, [sb, busy, save, fetchStats, clamped])

  const unregister = useCallback(async () => {
    if (!sb || busy) return
    setBusy(true); setError(null)
    const { data: { session } } = await sb.auth.getSession()
    if (session?.user) {
      const { error } = await sb.from('collection_totals').delete().eq('user_id', session.user.id)
      if (error) { setError('解除に失敗しました'); setBusy(false); return }
    }
    lastSyncedRef.current = null
    setRegistered(false)
    setStats(null)
    setBusy(false)
  }, [sb, busy])

  // 環境変数が未設定なら何も出さない（サイト本体は無傷のまま）
  if (!sb || clamped <= 0) return null

  const panel: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--hair)',
    borderRadius: '12px', padding: '20px', marginBottom: '16px',
  }
  const label: React.CSSProperties = {
    fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)',
    letterSpacing: '0.05em', marginBottom: '6px',
  }

  if (registered !== true) {
    return (
      <div style={panel}>
        <p style={label}>みんなの中での位置</p>
        <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.7, marginBottom: '14px' }}>
          評価額を登録すると、コレクションを登録している人の中で
          <strong style={{ fontWeight: 700 }}>自分が上位何%か</strong>が分かります。
          送るのは<strong style={{ fontWeight: 700 }}>合計金額と枚数だけ</strong>で、
          どのカードを持っているかは送信しません。いつでも解除できます。
        </p>
        <button
          type="button"
          disabled={busy || registered === null}
          onClick={register}
          style={{
            padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--gold)',
            background: 'transparent', color: 'var(--gold)', fontFamily: 'var(--mono)',
            fontSize: '13px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            opacity: busy || registered === null ? 0.6 : 1,
          }}
        >
          {busy ? '登録中…' : '¥' + clamped.toLocaleString() + ' を登録して順位を見る'}
        </button>
        {error && <p style={{ fontSize: '12px', color: 'var(--down)', marginTop: '10px' }}>{error}</p>}
      </div>
    )
  }

  const n = stats?.sample_count ?? 0
  const rank = stats?.my_rank ?? 0
  // 上位◯% ＝ 自分の順位 ÷ 母数。1位でも 0% にはしない
  const topPct = n > 0 ? Math.max(1, Math.round((rank / n) * 100)) : null
  const showPct = stats != null && n >= MIN_SAMPLE

  return (
    <div style={panel}>
      <p style={label}>みんなの中での位置</p>
      {stats === null ? (
        <p style={{ fontSize: '13px', color: 'var(--ink-faint)' }}>読み込み中…</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            {showPct ? (
              <>
                <span style={{ fontSize: '30px', fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1, color: 'var(--gold)' }}>
                  上位{topPct}%
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--ink-dim)' }}>
                  {n}人中 {rank}位
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1, color: 'var(--gold)' }}>
                  {n}人中 {rank}位
                </span>
              </>
            )}
          </div>

          {!showPct && (
            // 母数が足りないうちに割合を出すと、数人しかいないのに「上位10%」と
            // 見えてしまう。何が足りないのかを正直に書いて順位だけ出す
            <p style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '10px', lineHeight: 1.7 }}>
              「上位◯%」は登録者が{MIN_SAMPLE}人を超えると表示されます（いまは{n}人）。
            </p>
          )}

          {n >= MIN_SAMPLE_MEDIAN && (
            <p style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--ink-faint)', marginTop: '10px' }}>
              登録者の中央値 ¥{stats.median_yen.toLocaleString()}
              　／　上位10%ライン ¥{stats.p90_yen.toLocaleString()}
            </p>
          )}

          <p style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px', lineHeight: 1.7 }}>
            自己申告のため実際の保有と一致しない登録も含まれます。開くたびに最新の評価額へ更新されます。
            <button
              type="button"
              disabled={busy}
              onClick={unregister}
              style={{
                marginLeft: '6px', padding: 0, border: 'none', background: 'none',
                color: 'var(--ink-faint)', fontSize: '11px', textDecoration: 'underline',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              登録を解除する
            </button>
          </p>
          {error && <p style={{ fontSize: '12px', color: 'var(--down)', marginTop: '8px' }}>{error}</p>}
        </>
      )}
    </div>
  )
}
