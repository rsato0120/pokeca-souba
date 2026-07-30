# Supabase セットアップ（「みんなの予想」投稿機能）

投稿機能だけを Supabase に載せるハイブリッド構成。
**価格・予想・カードデータは従来どおり JSON + SSG のまま**で、Supabase には一切触らせない。

## なぜこの分け方か

- SSG が壊れない（ビルドが Supabase に依存しない）
- 価格データの git 履歴が残る＝これまでどおり汚染レコードの特定・削除ができる
- 環境変数が未設定なら投稿UIだけが静かに消える（`src/lib/supabase.ts` が null を返す）ので、
  キーが無いローカル・プレビューでもサイト本体は無傷

## 手順

### 1. プロジェクト作成
[supabase.com](https://supabase.com) で新規プロジェクトを作成（リージョンは Tokyo 推奨）。

### 2. 匿名サインインを有効化
Dashboard → **Authentication → Sign In / Providers → Anonymous sign-ins** を ON。
これを忘れると投票ボタンが「投稿の準備に失敗しました」で止まる。

### 3. スキーマを流す
Dashboard → **SQL Editor** に [`schema.sql`](./schema.sql) を貼って実行。
何度流しても壊れない書き方にしてある。

### 4. 環境変数
Dashboard → **Project Settings → API** から URL と anon key をコピーし、
`.env.local`（gitignore 済み）と **Vercel の Environment Variables** の両方に設定する。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

`NEXT_PUBLIC_` 付きはブラウザに露出するが、anon key は公開前提のキーなので問題ない。
**守るのは RLS のほう**（`schema.sql` のポリシー）。`service_role` キーは絶対にここに置かない。

### 5. 確認
`npm run dev` → 任意のカード詳細ページ → AI予想シナリオの下に「みんなの予想」が出る。
強気/弱気を押すとその場で匿名ユーザーが発行され、票が入る。

## 設計メモ

- **1カード1ユーザー1票**（`unique (card_id, user_id)`）。押し直しは upsert で更新。
- **匿名ユーザーは「投票しようとした瞬間」に初めて発行**する。マウント時に作ると
  一度も投稿しない閲覧者ぶんまで `auth.users` が膨らむため。
- 集計はクライアント側（1カードぶん最大300行を取得してカウント）。
  票が増えて重くなったら count クエリか RPC/ビューに切り替える。
- select ポリシーは `using (true)` なので、クエリを自作すれば `user_id`（匿名UUID）は見える。
  個人情報は含まないが、隠したい場合は公開用ビューを作ってそちらだけ read 許可にする。

## 無料枠の目安

匿名ユーザーも MAU に計上される（無料枠 50,000 MAU）。現在の規模なら当分問題にならない。
匿名サインインには IP あたりのレート制限があるので、急にバズった場合は Dashboard の
Auth Rate Limits を確認すること。
