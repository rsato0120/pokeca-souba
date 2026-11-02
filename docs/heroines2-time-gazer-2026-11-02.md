# ヒロインズ2・タイムゲイザー追加（2026-11-02）

- EB-05「ヒロインズエディション Vol.2」：未開封BOX、主要パラレル・再録リーダー35種、ドン!!カード4種。
- S10D「タイムゲイザー」：シュリンクありBOX、ディアルガV SA、カイリキーV SA、ヒスイドレディアV SA、ナタネの活気SR、ディアルガVSTAR UR。
- EB系IDの価格・予想・予測実績の読み込みを許可。タイムゲイザーは既存の成約日別保存処理で素体とPSA10を独立管理する。

## 照合元

- https://www.onepiece-cardgame.com/products/eb05.html
- https://snkrdunk.com/articles/33110/
- https://snkrdunk.com/apparels/910479
- https://www.pokemon-card.com/ex/s10/
- https://snkrdunk.com/apparels/66738
- 各カードの登録商品ID・画像は当該スニダン商品ページで照合。

## 価格とアフィリエイト

価格は既存のPlaywright処理から取得。EB-05は40商品のうち35商品で必要件数を満たす価格があり、3商品は件数不足、2商品は成約なし。未取得価格やAI予想を補完しない。

タイムゲイザー5枚は実際の素体成約日・PSA10成約日を保存。薄商いの価格を取得日の新規成約として扱わない。

サイト内の購入リンク・A8素材ID・計測画像は既存実装を利用。タイムゲイザーの5枚とBOXのX用URLはA8の「フリー素材生成（SNS・note対応）」で掲載サイト「ポケモンカードAI相場予想（X）」、SNS「X（X.com）」を選んで発行し、生成された短縮URLを改変せず保存。

## 検証

- `npm run prepare:pack-images` / `npm run verify:pack-images`
- `node scripts/prepare-card-images.mjs` / `node scripts/verify-card-images.mjs`
- `npx tsx scripts/verify-onepiece.ts`
- `npx tsx scripts/verify-mercari-share-links.ts`（1282件）
- `npx tsx --test scripts/vintage-card-sales.test.ts`（7件）
- `npm run build -- --webpack`（1607ページ）/ `npx tsc --noEmit`
- 追加46ページの生成HTML、購入用A8リンク・PR表記、5枚のX共有URLを確認。
- 1280px / 390pxの両幅で両BOX画像・ヘッダーを目視確認。横はみ出しなし。箔押しナミと通常版、金ドンと通常版を区別して表示。
- 共有node_modulesへのジャンクションをTurbopackが拒否したため、ローカルの本番ビルドはWebpackで実施。アプリのビルド設定は変更しない。
