@AGENTS.md

# ポケカ相場予想ツール「相場（SOUBA）」— 開発ガイド

## プロジェクト概要

ポケモンカードの相場をAIが予想するWebツール。SSG（静的生成）＋JSONファイルで運用。DBなし。

- 公開URL: https://pokeca-souba.vercel.app
- GitHub: https://github.com/rsato0120/pokeca-souba

## 技術スタック

- Next.js 16.2.9 App Router（SSG）/ TypeScript
- Vercel（GitHub push → 自動デプロイ）
- Google Gemini API（`@google/generative-ai`）
- データ: `data/pokeca_data.json`、予想: `data/forecasts/{id}.json`、価格履歴: `data/prices/{id}.json`

## AI利用方針（重要）

AIは**分析・コメント生成のみ**担当。価格はPlaywright + Mercariスクレイピングで取得する。

| 用途 | 手段 |
|---|---|
| 価格取得 | `scripts/scrape-prices.ts`（Playwright + Mercari） |
| 予想生成・ランキング調整 | `src/lib/forecast.ts` → `gemini-3.1-flash-lite`（500RPD） |

`generateForecast(card, currentLow, currentHigh)` — 価格は引数で渡す（自己取得しない）

## ディレクトリ構成

```
src/
  app/
    page.tsx              # トップページ（Server Component）
    boxes/[boxId]/        # 収録弾カード一覧
    cards/[cardId]/       # カード詳細
    screener/             # カードスクリーナー（全カードを横断で絞り込み・並べ替え）
    watchlist/            # ウォッチリスト（localStorage + 値動き通知）
  components/
    SearchBar.tsx         # 検索バー（'use client'）
    MarketIndexChart.tsx  # 相場指数のパネル（トップ）
    ScreenerTable.tsx     # スクリーナーの表（絞り込み・並べ替えはクライアント完結）
    OrderBook.tsx         # 売り板（最安出品・出品中央値・出品件数）
    RangePosition.tsx     # 全期間レンジ内の位置
  lib/
    data.ts               # JSON読み込み関数
    forecast.ts           # AI予想生成（generateForecast / adjustRankings）
    index-series.ts       # 相場指数（等ウェイト連鎖指数）と市場比
  hooks/
    useWatchlist.ts       # ウォッチリスト（localStorage `pokeca-watchlist-v1`）
  types/
    pokeca.ts             # 型定義
scripts/
  scrape-prices.ts        # Playwright + Mercariスクレイピング（Step 1）
  update-forecasts.ts     # AI予想生成バッチ（Step 2）— scrape-prices.ts の後に実行
  send-alerts.ts          # ウォッチリストの値動き通知（Web Push）。鍵が無ければ何もしない
data/
  pokeca_data.json        # boxes + cards
  forecasts/              # AI予想JSON
  prices/                 # 価格履歴JSON（30日rolling）— scrape-prices.ts が更新
public/
  sw.js                   # 通知用サービスワーカー（キャッシュはしない）
.github/workflows/
  update-forecasts.yml    # 毎日JST 9:00: scrape → forecast → commit → 通知 の順
```

## 相場指数（`src/lib/index-series.ts`）

個別カードの騰落を「市場と比べて」読むための基準線。全体・レアリティ別・弾別を作る。

- **等ウェイトの連鎖指数**。`index_t = index_{t-1} × trimmedMean(p_t / p_{t-1})`（両日に観測があるカードだけ）
- **時価総額加重にしない**：¥50万のSAR1枚に指数が支配されるため
- **代表値は刈り込み平均（上下10%カット）**。⚠ 中央値は使えない — 薄商いカードは前日据え置きが多く、
  半数超が「変化なし」になって指数が何日も 100.00 で固まる（実装して確認済み）
- カードの「市場比」＝ そのカードの7日比 − 同期間の指数の7日比。カード詳細では**その弾の指数**を優先する

## 重要な実装ルール

1. **AI呼び出しは `src/lib/forecast.ts` に隔離**。他ファイルから直接Gemini APIを呼ばない
2. **価格取得はPlaywrightのみ**。Gemini Google Search groundingは使用しない（20RPD制限廃止）
3. **カードスラッグは `card.id`** を使用（`card_no` ではない）
4. **`await props.params`** でparams取得（Next.js 16のPromise型）
5. **価格グラフY軸は動的計算**（固定値だとSAR/MURが範囲外になる）
6. **SearchBarは `'use client'`**、データはServer Componentからpropsで渡す
7. **実績ランキングの `records[7]`** = 7日前（履歴は新しい順にソート済み）

## カード追加手順

1. `data/pokeca_data.json` の `cards` 配列に追加
2. Bulbapediaで画像URL確認（`https://archives.bulbagarden.net/media/upload/...`）
3. `npx tsx scripts/scrape-prices.ts` で価格取得
4. `$env:GEMINI_API_KEY = "..."; npx tsx scripts/update-forecasts.ts` で予想生成
5. `git add data/ && git commit && git push`

## 日次更新コマンド（ローカル実行）

```powershell
# Step 1: Mercariから価格取得
npx tsx scripts/scrape-prices.ts

# Step 2: AI予想生成
$env:GEMINI_API_KEY = "（.env.localの値）"
npx tsx scripts/update-forecasts.ts

git add data/
git commit -m "update prices and forecasts $(Get-Date -Format 'yyyy-MM-dd')"
git push
```

## ⚠️ Mercariスクレイピングの注意点

- GitHub ActionsのIPがブロックされる可能性あり（その場合ローカル実行で回避）
- データ不足（5件未満）の場合は既存価格を維持してスキップ
- 除外キーワード: 傷あり / ジャンク / まとめ / セット / PSA / BGS / CGC

## 購入リンク（アフィリエイト対応）

カード詳細ページ（`src/app/cards/[cardId]/page.tsx`）の `shops` 配列にURLが定義されている。
アフィリエイトID取得後は各URLにトラッキングパラメータを追記するだけ。

```typescript
// アフィリエイトパラメータ追加例
url: `https://www.cardrush-pokemon.jp/search/?keyword=${q}&a8=XXXXXXXX`
```
