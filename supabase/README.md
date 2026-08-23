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

## コレクション総額の「上位◯%」（`collection_totals`）

マイコレクション本体は今までどおり **localStorage 完結**。所持カードの中身はサーバーに送らない。
`collection_totals` に入るのは **評価額の合計・種類数・枚数の3つだけ**で、しかもオプトイン
（マイコレクションのボタンを押した人だけ登録される）。

- **⚠️ ここだけ select を `using (true)` にしない。** 票は公開前提の意見だが総額は個人の資産額で、
  全開放すると「誰でも全ユーザーの総額一覧を引ける」＝資産額リストになる。
  自分の行だけ読め、他人の数字は集計関数 `collection_percentile(mine)` の戻り
  （順位・母数・中央値・上位10%ライン）としてしか出ない。
- 関数は `security definer`（RLSを意図的に迂回する）なので **`set search_path` を必ず付ける**。
- **母数が20人未満のうちは画面に「上位◯%」を出さない**（`CollectionRank.tsx` の `MIN_SAMPLE`）。
  数人しかいない状態の割合は意味を持たない。それまでは「N人中R位」だけ出す。
- 自己申告なので枚数の水増しは可能。`total_yen` に10億円の check 制約を置いて、
  桁違いの1件が分布の上端を壊さないようにしている。
- `updated_at` は持っているが集計では**まだ絞っていない**。母数が増えたら
  「直近90日に更新された行だけ」に変える余地がある（今やると母数が消える）。

## 無料枠の目安

匿名ユーザーも MAU に計上される（無料枠 50,000 MAU）。現在の規模なら当分問題にならない。
匿名サインインには IP あたりのレート制限があるので、急にバズった場合は Dashboard の
Auth Rate Limits を確認すること。

## みんなの注目ランキング（`card_view_visits`）

トップの「みんなの注目ランキング」＝**直近7日でカード詳細を開かれた人数**の多い順（`TrendingCards.tsx`）。
カード詳細を開くとその場で1件記録され、同じページに「直近7日の閲覧 N人・◯位」が出る（`CardViewCounter.tsx`）。

- **数え方は 1カード・1日・1訪問者につき1**。リロード連打では増えない。二重に数えないための識別子は
  `md5(その日の日付 + IP)` ＝**日が変われば別人になる使い捨ての値**で、IPそのものも端末IDも保存しない。
  端末側でも「今日このカードを数えたか」を localStorage（`pokeca-viewed-v1`）に持ち、
  2回目以降は `p_count=false`（読むだけ）で呼ぶ。
- **⚠ このテーブルにもポリシーを1本も置かない**（`collection_totals` と同じ方針、`card_votes` とは逆）。
  RLS を有効にしてポリシーが無い＝クライアントからは読み書きとも一切できず、出入りは
  `record_card_view()` / `card_view_ranking()`（どちらも `security definer` ＋ `set search_path`）だけ。
  生の行には訪問者ハッシュが入るので、票のように `using (true)` で開けてはいけない。
- **匿名サインインは要らない**（RPC は `anon` に grant 済み）。閲覧しただけで `auth.users` は増えない。
- 保持は31日。cron を持たないので `record_card_view()` が **1%の確率で古い行を掃除**する。
- しきい値は `TrendingCards.tsx` の `MIN_VIEWERS`（2人未満は載せない）と `CardViewCounter.tsx` の
  `MIN_VIEWERS` / `MIN_RANKED`。**閲覧が貯まるまではセクションもバッジも自分で消える**ので、
  流し込んだ直後に何も出なくても壊れてはいない。
- 「急上昇」バッジは**ひとつ前の7日**と比べて2倍以上のとき。初週は前期間が0なので付かない
  （＝「初日は全部NEW」のような無意味な表示にならない）。
- プライバシーポリシー（`src/app/privacy/page.tsx`）に閲覧記録の記載を追加済み。
  ここに送るものを増やしたら必ず同じ場所を直すこと。

---

## ウォッチリストの値動き通知（Web Push）

`/watchlist` の「通知をONにする」を動かすための設定。**未設定でも壊れない** — 鍵が無ければ
通知の枠が画面に出ず、日次バッチの送信ステップも何もせず抜ける。

### 1. スキーマを流す

`schema.sql` を再度流す（`push_subscriptions` テーブルと2つの関数が追加されている）。
何度流しても壊れない書き方。

### 2. VAPID鍵を作る

```powershell
npx web-push generate-vapid-keys
```

`Public Key` と `Private Key` が出る。この鍵ペアが通知の送信元の身元になるので、
**一度決めたら変えない**（変えると既存の購読が全部無効になる）。

### 3. 環境変数

| 変数 | 置き場所 | 中身 |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local` と **Vercel** | 公開鍵。これが無いと通知UIが出ない |
| `VAPID_PUBLIC_KEY` | **GitHub Secrets** | 同じ公開鍵 |
| `VAPID_PRIVATE_KEY` | **GitHub Secrets** | 秘密鍵。絶対に `NEXT_PUBLIC_` を付けないこと |
| `VAPID_SUBJECT` | **GitHub Secrets** | `mailto:自分のメール` かサイトURL |
| `SUPABASE_SERVICE_ROLE_KEY` | **GitHub Secrets** | 購読テーブルを読むための鍵。RLSを迂回できるので厳重に |
| `NEXT_PUBLIC_SUPABASE_URL` | **GitHub Secrets** にも | バッチから接続するため（Vercel側は設定済みのはず） |

### 4. 動作確認

```powershell
# 送らずに「今日どのカードが通知対象か」だけ見る
npx tsx scripts/send-alerts.ts --dry
```

ブラウザ側は `/watchlist` で ☆ を登録 → 「通知をONにする」→ 許可。
**localhost と https でしか動かない**（Service Worker の制約）。

### 送る条件

- 前日比 **±10%以上**（±20%を超える動きは汚染の疑いが濃いので送らない）
- 全期間の**高値／安値を当日更新**

1通に並ぶのは最大3枚＋「ほか◯件」。同じ日に複数回届いても通知欄では1つにまとまる（tagを日付で固定）。

### プライバシー

ウォッチリスト本体は端末の localStorage にしかない。通知をONにしたときだけ
「プッシュの宛先（endpoint とその鍵）＋対象カードID」を預かり、OFFにすれば行ごと消える。
名前・メール・端末IDは受け取らない。
