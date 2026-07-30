'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// 投稿機能（みんなの予想）専用のブラウザクライアント。
// 価格・予想データは従来どおり JSON + SSG のままで、Supabase には触らせない。
//
// 環境変数が無いときは null を返す。こうしておくと、
//   ・キー未設定のローカル/プレビューでもビルドと表示が壊れない
//   ・投稿UIだけが静かに消える（サイト本体は無傷）
// という段階的ロールアウトができる。

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null
  // クライアント生成は1回だけ（毎レンダリングで作るとセッション監視が多重に張られる）
  client ??= createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}

export const isSupabaseConfigured = Boolean(url && anonKey)
