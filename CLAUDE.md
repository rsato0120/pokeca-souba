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

## モデル使い分け（重要）

| 用途 | モデル | 理由 |
|---|---|---|
| 価格取得（Google Search grounding） | `gemini-2.5-flash-lite` | grounding はGemini 2.5系のみ対応 |
| 予想生成・ランキング調整 | `gemini-3.1-flash-lite` | 500RPD と余裕あり |

- `src/lib/forecast.ts` の `fetchCurrentPrice()` → `gemini-2.5-flash-lite`
- `src/lib/forecast.ts` の `generateForecast()` / `adjustRankings()` → `gemini-3.1-flash-lite`

## ディレクトリ構成

```
src/
  app/
    page.tsx              # トップページ（Server Component）
    boxes/[boxId]/        # 収録弾カード一覧
    cards/[cardId]/       # カード詳細
  components/
    SearchBar.tsx         # 検索バー（'use client'）
  lib/
    data.ts               # JSON読み込み関数
    forecast.ts           # AI予想生成（generateForecast / adjustRankings）
  types/
    pokeca.ts             # 型定義
scripts/
  update-forecasts.ts     # 毎日更新バッチ（2段階：個別生成→ランキング調整）
data/
  pokeca_data.json        # boxes + cards
  forecasts/              # AI予想JSON
  prices/                 # 価格履歴JSON（30日rolling）
.github/workflows/
  update-forecasts.yml    # 毎日JST 9:00自動実行
```

## 重要な実装ルール

1. **AI呼び出しは `src/lib/forecast.ts` に隔離**。他ファイルから直接Gemini APIを呼ばない
2. **カードスラッグは `card.id`** を使用（`card_no` ではない）
3. **`await props.params`** でparams取得（Next.js 16のPromise型）
4. **価格グラフY軸は動的計算**（固定値だとSAR/MURが範囲外になる）
5. **SearchBarは `'use client'`**、データはServer Componentからpropsで渡す
6. **実績ランキングの `records[7]`** = 7日前（履歴は新しい順にソート済み）

## カード追加手順

1. `data/pokeca_data.json` の `cards` 配列に追加
2. Bulbapediaで画像URL確認（`https://archives.bulbagarden.net/media/upload/...`）
3. `npx tsx scripts/update-forecasts.ts` で予想生成
4. `git add data/ && git commit && git push`

## 日次更新コマンド（ローカル実行）

```powershell
$env:GEMINI_API_KEY = "（.env.localの値）"
npx tsx scripts/update-forecasts.ts
git add data/
git commit -m "update forecasts $(Get-Date -Format 'yyyy-MM-dd')"
git push
```

## 購入リンク（アフィリエイト対応）

カード詳細ページ（`src/app/cards/[cardId]/page.tsx`）の `shops` 配列にURLが定義されている。
アフィリエイトID取得後は各URLにトラッキングパラメータを追記するだけ。

```typescript
// アフィリエイトパラメータ追加例
url: `https://www.cardrush-pokemon.jp/search/?keyword=${q}&a8=XXXXXXXX`
```
