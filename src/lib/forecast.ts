import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Card, Forecast, PriceRecord, Trend } from '@/types/pokeca'

// ─── プロンプト構築 ──────────────────────────────────────────────

function buildPrompt(card: Card, currentLow: number, currentHigh: number, priceHistory: PriceRecord[]): string {
  const { collector, common } = card.materials

  const reprintLabel: Record<string, string> = {
    none: '再録なし',
    reprinted: '再録済み（供給増）',
    reprint_planned: '再録予定あり（供給増加見込み）',
  }

  const scarcityLabel: Record<string, string> = {
    normal: '普通',
    scarce: '入手困難（品薄）',
    out_of_print: '絶版（流通量極小）',
  }

  const charPopLabel: Record<string, string> = {
    high: '高い',
    mid: '普通',
    unknown: '不明',
  }

  // 価格履歴の集計
  const midOf = (r: PriceRecord) => r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2

  let historySection = ''
  if (priceHistory.length >= 2) {
    const now = Date.now()
    const avgOf = (records: PriceRecord[]) =>
      Math.round(records.reduce((s, r) => s + midOf(r), 0) / records.length)

    const p7 = priceHistory.filter(r => new Date(r.date).getTime() >= now - 7 * 86400000)
    const p30 = priceHistory.filter(r => new Date(r.date).getTime() >= now - 30 * 86400000)
    const oldest = priceHistory[priceHistory.length - 1]
    const newest = priceHistory[0]
    const oldMid = midOf(oldest)
    const newMid = midOf(newest)
    const changePct = Math.round(((newMid - oldMid) / oldMid) * 100)
    const trendStr = changePct > 5 ? '上昇傾向' : changePct < -5 ? '下落傾向' : '横ばい'

    historySection = `\n## 実際の価格履歴（参考）\n`
    if (p7.length > 0) historySection += `- 7日間平均: ¥${avgOf(p7)}（${p7.length}日分）\n`
    if (p30.length > 0) historySection += `- 30日間平均: ¥${avgOf(p30)}（${p30.length}日分）\n`
    historySection += `- 直近${priceHistory.length}日間の傾向: ${trendStr}（${changePct >= 0 ? '+' : ''}${changePct}%）\n`

    // 在庫・需給シグナル（メルカリ出品中件数）
    const withSale = priceHistory.filter(r => r.on_sale != null)
    if (withSale.length > 0) {
      const latestSale = withSale[0].on_sale!
      const oldestSale = withSale[withSale.length - 1].on_sale!
      const saleChangePct = withSale.length >= 2
        ? Math.round(((latestSale - oldestSale) / Math.max(oldestSale, 1)) * 100)
        : null

      const supplySignal = latestSale < 10
        ? '極めて少ない（市場タイト）'
        : latestSale < 30
        ? '少ない（需要優位）'
        : latestSale < 80
        ? '普通'
        : '多い（供給過多リスク）'

      historySection += `\n## 需給シグナル（メルカリ出品中件数）\n`
      historySection += `- 現在の出品中件数: ${latestSale}件 → ${supplySignal}\n`
      if (saleChangePct != null) {
        const trend = saleChangePct > 20 ? '増加傾向（供給増・価格下落圧力）'
          : saleChangePct < -20 ? '減少傾向（品薄・価格上昇圧力）'
          : '横ばい'
        historySection += `- 出品数トレンド: ${saleChangePct >= 0 ? '+' : ''}${saleChangePct}%（${trend}）\n`
      }

      // 成約相場 vs 出品最安値の乖離で「急騰」と「急落」を分離する
      // 成約(sold)＝結果指標、出品最安(ask_low)＝先行指標。両者の関係＋在庫トレンドで方向を判定。
      const latestAsk = withSale[0].ask_low ?? null
      const soldNow = midOf(withSale[0])
      if (latestAsk != null && soldNow > 0) {
        const gapPct = Math.round(((latestAsk - soldNow) / soldNow) * 100)
        const invUp = saleChangePct != null && saleChangePct > 20      // 在庫増
        const invDown = saleChangePct != null && saleChangePct < -20    // 在庫減
        // gap>0: 出品が成約より高い（売り手強気/品薄）, gap<0: 出品が成約より安い（投げ売り）
        let momentum: string
        if (gapPct <= -8 && invUp) momentum = '値下がりしそう（安値の出品が増えていて、売り急ぎの傾向）'
        else if (gapPct <= -8) momentum = 'やや下がり気味（売れた価格より安い出品が出てきている）'
        else if (gapPct >= 8 && invDown) momentum = '値上がりしそう（在庫が減り、出品価格が売れた価格より高い＝品薄）'
        else if (gapPct >= 8) momentum = 'やや上がり気味（出品価格が売れた価格より高めで強気）'
        else momentum = '横ばい（出品価格と売れた価格がほぼ同じ）'
        historySection += `- 出品最安値: ¥${latestAsk}（成約相場との乖離 ${gapPct >= 0 ? '+' : ''}${gapPct}%）\n`
        historySection += `- 値動きの方向: ${momentum}\n`
      }
    }
  }

  return `あなたはポケモンカードの「コレクター相場」（観賞用・保有価値）の分析専門家です。
対戦での実需（プレイヤー需要）は考慮に入れず、コレクター需要・希少性・キャラ/絵師人気・需給を軸に、
以下のカードの今後6ヶ月の相場予想（1ヶ月後・3ヶ月後・6ヶ月後）を生成してください。

## カード情報
- カード名: ${card.card_name}
- レアリティ: ${card.rarity}
- 収録弾: ${card.box_id}

## コレクター需要の材料
- イラストレーター: ${collector.illustrator}
- 絵師人気: ${collector.illustrator_popularity}
- イラスト: ${collector.artwork_type === 'original' ? '描き下ろし' : collector.artwork_type === 'reused' ? '流用' : '不明'}
- レアリティ: ${collector.rarity}

## 共通材料
- 再録状況: ${reprintLabel[common.reprint_status] ?? common.reprint_status}
- 品薄度: ${scarcityLabel[common.scarcity] ?? common.scarcity}
- キャラ人気: ${charPopLabel[common.character_popularity] ?? common.character_popularity}

## 補足情報（証拠メモ）
- コレクター視点: ${card.evidence_notes.collector}
${historySection}
## 出力ルール
1. 断言しない。「上がります」ではなく確率＋根拠で示す
2. コレクター視点（観賞・保有価値）で分析する。対戦採用の有無は判断材料にしない
3. 上昇圧力と下落圧力の両方を公平に検討し、このカード固有の材料から方向を判断する。機械的にどちらか一方へ倒さないこと。
   【下落圧力の例】再録／再録予定→供給増、出品数の増加→供給過多
   【上昇圧力の例】品薄・絶版→希少性プレミア、人気絵師の描き下ろし→コレクター需要、キャラ人気が高い→長期保有需要、出品数の減少→需給逼迫
4. すべてのカードが下落するわけではない。新弾直後の供給増は一要因にすぎず、希少・人気絵師・品薄・絶版など強い材料を持つカードは横ばい〜上昇も十分ありうる。材料の強弱に応じてカードごとに明確に差別化し、up_pct を団子にしない（強い材料なら40〜70%、弱い材料なら10〜25%など幅を持たせる）
5. 根拠文は日本語で2〜3文、具体的に書く
6. overall の up_pct + flat_pct + down_pct = 100 にする
7. price_forecast は3時点（1ヶ月後・3ヶ月後・6ヶ月後）の本線予想価格を出す。起点は current_low=${currentLow}, current_high=${currentHigh}
8. up/down は6ヶ月後の上振れ・下振れシナリオ価格

## 出力形式（JSON のみ、コードブロック不要）
{
  "collector_view": {
    "trend": "up" | "flat" | "down",
    "probability": 0〜100の整数,
    "reason": "根拠文（日本語）"
  },
  "overall": {
    "up_pct": 整数,
    "flat_pct": 整数,
    "down_pct": 整数,
    "reason": "総合根拠文（日本語）"
  },
  "price_forecast": {
    "current_low": 整数,
    "current_high": 整数,
    "m1_low": 整数,
    "m1_high": 整数,
    "m3_low": 整数,
    "m3_high": 整数,
    "m6_low": 整数,
    "m6_high": 整数,
    "up_low": 整数,
    "up_high": 整数,
    "down_low": 整数,
    "down_high": 整数
  },
  "disclaimer": "本予想はAIが公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。"
}`
}

// ─── レスポンス検証 ──────────────────────────────────────────────

function isValidTrend(v: unknown): v is Trend {
  return v === 'up' || v === 'flat' || v === 'down'
}

function parseForecastJson(raw: string, card: Card): Forecast {
  // コードブロックが混入した場合に除去
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned)

  // 必須フィールド検証
  if (!isValidTrend(parsed.collector_view?.trend)) throw new Error('invalid collector_view.trend')

  const upPct = Number(parsed.overall?.up_pct ?? 0)
  const flatPct = Number(parsed.overall?.flat_pct ?? 0)
  const downPct = Number(parsed.overall?.down_pct ?? 0)
  if (upPct + flatPct + downPct !== 100) throw new Error('overall pct sum != 100')

  return {
    card_no: card.card_no,
    rarity: card.rarity,
    generated_at: new Date().toISOString(),
    collector_view: {
      trend: parsed.collector_view.trend,
      probability: Number(parsed.collector_view.probability),
      reason: String(parsed.collector_view.reason),
    },
    overall: {
      up_pct: upPct,
      flat_pct: flatPct,
      down_pct: downPct,
      reason: String(parsed.overall.reason),
    },
    price_forecast: {
      current_low: Number(parsed.price_forecast.current_low),
      current_high: Number(parsed.price_forecast.current_high),
      m1_low: Number(parsed.price_forecast.m1_low),
      m1_high: Number(parsed.price_forecast.m1_high),
      m3_low: Number(parsed.price_forecast.m3_low),
      m3_high: Number(parsed.price_forecast.m3_high),
      m6_low: Number(parsed.price_forecast.m6_low),
      m6_high: Number(parsed.price_forecast.m6_high),
      up_low: Number(parsed.price_forecast.up_low),
      up_high: Number(parsed.price_forecast.up_high),
      down_low: Number(parsed.price_forecast.down_low),
      down_high: Number(parsed.price_forecast.down_high),
    },
    disclaimer: String(
      parsed.disclaimer ??
        '本予想はAIが公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。'
    ),
  }
}

// ─── メイン関数（AI呼び出しはここに隔離） ────────────────────────

export async function generateForecast(
  card: Card,
  currentLow: number,
  currentHigh: number,
  priceHistory: PriceRecord[] = []
): Promise<Forecast> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY が設定されていません。.env.local に追加してください。')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  })

  const prompt = buildPrompt(card, currentLow, currentHigh, priceHistory)

  // リトライ（最大2回）
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const raw = result.response.text()
      return parseForecastJson(raw, card)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  throw lastError ?? new Error('generateForecast: unknown error')
}

// ─── ランキング調整パス（決定論的スプレッド） ─────────────────────
//
// 旧実装は全カードを1プロンプトでLLMに再ランクさせていたが、
// 「隣接5%差」×「範囲10〜75」を200枚超に課すのはスケール的に破綻し、
// 上位が上限に張り付き（60/55/50/45に団子）中間層が10%へ圧縮された。
// → LLM呼び出しを撤廃し、個別予想を連続スコア化 → 順位を対数カーブへ
//   マッピングする。上位ほど間隔が広く裾は緩やかになり、序列が滑らかに出る。
// 完全に決定論的（再現性あり）＆API消費ゼロ。

const UP_MAX = 70 // 最上位カードの up_pct
const UP_MIN = 10 // 最下位カードの up_pct

const POP_SCORE: Record<string, number> = { high: 2, mid: 1, unknown: 0 }
const SCARCITY_SCORE: Record<string, number> = { out_of_print: 2, scarce: 1, normal: 0 }

// 各カードの「上昇期待度」を並べ替えるための連続スコア。
// 個別予想の up_pct を主軸に、net確信度・コレクター視点・コレクター材料でタイブレーク。
function rankingScore(card: Card, forecast: Forecast): number {
  const { up_pct, down_pct } = forecast.overall
  const signed = (v: { trend: Trend; probability: number }) =>
    (v.trend === 'up' ? 1 : v.trend === 'down' ? -1 : 0) * v.probability

  const material =
    (POP_SCORE[card.materials.collector.illustrator_popularity] ?? 0) +
    (POP_SCORE[card.materials.common.character_popularity] ?? 0) +
    (SCARCITY_SCORE[card.materials.common.scarcity] ?? 0)

  return (
    up_pct * 1000 + // AIの上昇%を最優先バンドに
    (up_pct - down_pct) * 5 + // ネット上昇でup同値を分離
    signed(forecast.collector_view) * 0.5 + // コレクター視点の確信度
    material
  )
}

export function adjustRankings(
  items: Array<{ cardId: string; card: Card; forecast: Forecast }>
): Map<string, { up_pct: number; flat_pct: number; down_pct: number }> {
  if (items.length <= 1) {
    return new Map(items.map(({ cardId, forecast }) => [cardId, forecast.overall]))
  }

  // スコア降順（同点は cardId で安定ソート）に並べる
  const ordered = [...items].sort((a, b) => {
    const diff = rankingScore(b.card, b.forecast) - rankingScore(a.card, a.forecast)
    return diff !== 0 ? diff : a.cardId.localeCompare(b.cardId)
  })

  const n = ordered.length
  // up = UP_MAX - k·ln(rank+1) が rank=n-1 で UP_MIN になるよう k を決める
  const k = (UP_MAX - UP_MIN) / Math.log(n)

  const resultMap = new Map<string, { up_pct: number; flat_pct: number; down_pct: number }>()
  ordered.forEach(({ cardId, forecast }, rank) => {
    const up = Math.max(
      UP_MIN,
      Math.min(UP_MAX, Math.round(UP_MAX - k * Math.log(rank + 1)))
    )
    // 残り(100-up)を、元の flat:down 比を保ったまま配分する
    const { flat_pct: origFlat, down_pct: origDown } = forecast.overall
    const rem = 100 - up
    const denom = origFlat + origDown
    const down = denom > 0 ? Math.round((rem * origDown) / denom) : Math.round(rem / 2)
    const flat = rem - down
    resultMap.set(cardId, { up_pct: up, flat_pct: flat, down_pct: down })
  })

  return resultMap
}
