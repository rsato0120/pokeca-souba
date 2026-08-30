// AI が書いた文章に「いつ時点の分析か」を必ず添えるためのラッパー。
//
// ⚠ なぜ要るか（2026-08-30）:
//   AI文は日次バッチで生成され、生成日のまま何日も残る。一方で価格・出品数・前日比は
//   毎日更新される。そのため同じ画面に「売り板: 92件」と「AI文: 出品43件」が並ぶ事故が
//   実際に起きた（エリカのおもてなし）。
//   プロンプト側は 2026-08-30 に**本文へ数値を書くことを禁止**したが、それ以前に生成された
//   文章が大量に残っている（実測 567件中445件＝78.5%が金額・件数・%を含む）。
//   445件の一括再生成は Gemini の 500RPD を超えるため行わず、
//   **① 生成時点を明記して現在値と混同させない ② 日次バッチの通常更新（STALE_DAYS=3）で
//   2〜3日かけて新ルールの文章に入れ替わるのを待つ** という運用にした。
//
// 現在値は必ず「市場価格」「売り板」など構造化された欄が出す。AI文は解釈だけを担当する。

function asOfLabel(generatedAt: string | undefined): string | null {
  if (!generatedAt) return null
  const t = Date.parse(generatedAt)
  if (Number.isNaN(t)) return null
  // UTC → JST(+9h)
  const jst = new Date(t + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10).replace(/-/g, '.')
}

export default function ForecastNote({
  text,
  generatedAt,
  size = 14,
}: {
  text: string
  generatedAt?: string
  size?: number
}) {
  const asOf = asOfLabel(generatedAt)
  return (
    <>
      <p style={{ fontSize: `${size}px`, color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: asOf ? '6px' : '18px' }}>
        {text}
      </p>
      {asOf && (
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '10px',
            color: 'var(--ink-faint)',
            letterSpacing: '0.04em',
            marginBottom: '18px',
          }}
        >
          ※ {asOf} 時点の分析です。文中の数量表現は現在値と一致しないことがあります（現在値は上の市場価格・売り板欄をご覧ください）。
        </p>
      )}
    </>
  )
}
