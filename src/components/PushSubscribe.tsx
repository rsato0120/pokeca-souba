'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

// ウォッチリストの値動き通知（Web Push）。
//
// ウォッチリスト自体は localStorage にしか無い＝サーバーは誰が何を見ているか知らない。
// 通知を送るにはサーバー側に対象が要るので、**ONにしたときだけ**
// 「プッシュの宛先（endpoint）＋対象カードID」を Supabase に預ける。
// OFFにすれば行ごと消える。名前・メール・端末IDは一切送らない。
//
// 環境変数（VAPID公開鍵 / Supabase）が未設定なら、この枠は静かに消える。
// サイト本体は無傷のまま段階的に出せるようにしておく（投票機能と同じ方針）。

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

interface Props {
  /** 通知の対象にするカードID（ウォッチリストの中身） */
  cardIds: string[]
}

type State = 'idle' | 'working' | 'on' | 'denied' | 'error'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function PushSubscribe({ cardIds }: Props) {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Boolean(VAPID_PUBLIC_KEY) &&
      isSupabaseConfigured
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok)
    if (!ok) return

    // すでに購読済みならトグルをONで描く
    navigator.serviceWorker.getRegistration('/sw.js')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => { if (sub) setState('on') })
      .catch(() => {})
  }, [])

  /** 購読の宛先と対象カードをサーバーに預ける（同じ endpoint なら上書き） */
  const save = useCallback(async (sub: PushSubscription, ids: string[]) => {
    const supabase = getSupabase()
    if (!supabase) throw new Error('supabase unavailable')
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    const { error } = await supabase.rpc('upsert_push_subscription', {
      p_endpoint: json.endpoint ?? sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
      p_cards: ids,
    })
    if (error) throw error
  }, [])

  const enable = useCallback(async () => {
    setState('working')
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        setMessage('ブラウザの設定で通知がブロックされています。サイトの通知を「許可」に変えると受け取れます。')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }))
      await save(sub, cardIds)
      setState('on')
      setMessage('通知をONにしました。相場が大きく動いた日の朝にお知らせします。')
    } catch (e) {
      setState('error')
      setMessage(`通知の設定に失敗しました（${e instanceof Error ? e.message : '不明なエラー'}）。時間をおいて試してください。`)
    }
  }, [cardIds, save])

  const disable = useCallback(async () => {
    setState('working')
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        const supabase = getSupabase()
        // 先にサーバー側の行を消す。購読解除を先にやると endpoint が取れなくなり、
        // 宛先だけがサーバーに残って送信し続ける（届かないが無駄が残る）
        await supabase?.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setState('idle')
      setMessage('通知をOFFにしました。預かっていた宛先も削除しました。')
    } catch {
      setState('error')
      setMessage('通知の解除に失敗しました。ブラウザの設定からも解除できます。')
    }
  }, [])

  // ウォッチリストを増減したら、通知対象も追随させる。
  // ONのときだけ動き、OFFなら何も送らない。
  useEffect(() => {
    if (state !== 'on') return
    let cancelled = false
    const t = setTimeout(() => {
      navigator.serviceWorker.getRegistration('/sw.js')
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub) => { if (sub && !cancelled) return save(sub, cardIds) })
        .catch(() => {})
    }, 600)   // 星を連打したときに毎回送らないよう少し待つ
    return () => { cancelled = true; clearTimeout(t) }
  }, [cardIds, state, save])

  if (!supported) return null

  const on = state === 'on'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        flexWrap: 'wrap',
        background: 'var(--bg2)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-4)',
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', letterSpacing: 'var(--ls-wider)', color: 'var(--ink-faint)', marginBottom: '4px' }}>
          ALERT · 値動き通知
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--ink-dim)', lineHeight: 1.7 }}>
          ウォッチ中のカードが<strong style={{ color: 'var(--ink)' }}>1日で10%以上動いた</strong>とき、
          または<strong style={{ color: 'var(--ink)' }}>最高値・最安値を更新した</strong>ときに通知します。
        </div>
      </div>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={state === 'working'}
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--fs-sm)',
          letterSpacing: '0.05em',
          padding: '9px 18px',
          borderRadius: 'var(--r-pill)',
          border: `1px solid ${on ? 'var(--gold)' : 'var(--hair)'}`,
          background: on ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--panel)',
          color: on ? 'var(--gold)' : 'var(--ink-dim)',
          fontWeight: on ? 700 : 500,
          cursor: state === 'working' ? 'progress' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {state === 'working' ? '設定中…' : on ? '通知ON' : '通知をONにする'}
      </button>
      {message && (
        <div
          style={{
            flexBasis: '100%',
            fontSize: 'var(--fs-sm)',
            color: state === 'error' || state === 'denied' ? 'var(--down)' : 'var(--ink-faint)',
            lineHeight: 1.7,
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
