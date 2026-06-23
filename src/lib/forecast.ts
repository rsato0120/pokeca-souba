import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Card, Forecast, PriceRecord, Trend } from '@/types/pokeca'

// ─── プロンプト構築 ──────────────────────────────────────────────

function buildPrompt(card: Card, currentLow: number, currentHigh: number, priceHistory: PriceRecord[]): string {
  const { player, collector, common } = card.materials

  const rotationLabel: Record<string, string> = {
    soon: '来期スタン落ち予定（重要な下落圧力）',
    upcoming: '数期先にスタン落ち予定',
    far: '当分スタン落ちなし（需要継続しやすい）',
    unknown: 'スタン落ち時期不明',
  }

  const usageLabel: Record<string, string> = {
    high: '高（トップデッキ級）',
    mid: '中（採用実績あり）',
    low: '低（稀に採用）',
    none: 'なし',
  }

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

  return `あなたはポケモンカードの相場分析の専門家です。
以下のカード情報をもとに、今後6ヶ月の相場予想（1ヶ月後・3ヶ月後・6ヶ月後）を生成してください。

## カード情報
- カード名: ${card.card_name}
- レアリティ: ${card.rarity}
- 収録弾: ${card.box_id}
- タイプ: ${card.card_spec.type} / HP${card.card_spec.hp}

## プレイヤー需要の材料
- レギュレーションマーク: ${player.regulation_mark}
- スタン落ち: ${rotationLabel[player.rotation] ?? player.rotation}
- 競技採用度: ${usageLabel[player.competitive_usage] ?? player.competitive_usage}

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
- プレイヤー視点: ${card.evidence_notes.player}
- コレクター視点: ${card.evidence_notes.collector}
${historySection}
## 出力ルール
1. 断言しない。「上がります」ではなく確率＋根拠で示す
2. player_view と collector_view を分けて分析する
3. 再録 → 供給増加 → 下落圧力、スタン落ち間近 → 実需減少、などの因果を使う
4. 根拠文は日本語で2〜3文、具体的に書く
5. overall の up_pct + flat_pct + down_pct = 100 にする
6. price_forecast は3時点（1ヶ月後・3ヶ月後・6ヶ月後）の本線予想価格を出す。起点は current_low=${currentLow}, current_high=${currentHigh}
7. up/down は6ヶ月後の上振れ・下振れシナリオ価格

## 出力形式（JSON のみ、コードブロック不要）
{
  "player_view": {
    "trend": "up" | "flat" | "down",
    "probability": 0〜100の整数,
    "reason": "根拠文（日本語）"
  },
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
  if (!isValidTrend(parsed.player_view?.trend)) throw new Error('invalid player_view.trend')
  if (!isValidTrend(parsed.collector_view?.trend)) throw new Error('invalid collector_view.trend')

  const upPct = Number(parsed.overall?.up_pct ?? 0)
  const flatPct = Number(parsed.overall?.flat_pct ?? 0)
  const downPct = Number(parsed.overall?.down_pct ?? 0)
  if (upPct + flatPct + downPct !== 100) throw new Error('overall pct sum != 100')

  return {
    card_no: card.card_no,
    rarity: card.rarity,
    generated_at: new Date().toISOString(),
    player_view: {
      trend: parsed.player_view.trend,
      probability: Number(parsed.player_view.probability),
      reason: String(parsed.player_view.reason),
    },
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

// ─── ランキング調整パス ───────────────────────────────────────────

type RankEntry = { card_id: string; up_pct: number; flat_pct: number; down_pct: number }

export async function adjustRankings(
  items: Array<{ cardId: string; card: Card; forecast: Forecast }>
): Promise<Map<string, { up_pct: number; flat_pct: number; down_pct: number }>> {
  if (items.length <= 1) {
    return new Map(items.map(({ cardId, forecast }) => [cardId, forecast.overall]))
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY が設定されていません。')
  }

  const cardList = items.map(({ cardId, card, forecast }) =>
    `- card_id: ${cardId}
  カード: ${card.card_name} ${card.rarity}（${card.materials.collector.illustrator}）
  レアリティ: ${card.rarity} / 絵師人気: ${card.materials.collector.illustrator_popularity} / キャラ人気: ${card.materials.common.character_popularity}
  初期スコア: 上昇${forecast.overall.up_pct}% 横ばい${forecast.overall.flat_pct}% 下落${forecast.overall.down_pct}%
  個別分析: ${forecast.overall.reason}`
  ).join('\n\n')

  const prompt = `あなたはポケモンカード相場の専門家です。
以下の${items.length}枚のカードを比較し、今後6ヶ月の上昇期待度を相対的に評価し直してください。

## カード一覧（初期スコア付き）
${cardList}

## 調整ルール
1. カード同士を比較し、相対的な優劣を反映した数値にする
2. 隣接するランク間は最低5%の差をつける（全カードが同じ数値になってはいけない）
3. up_pct + flat_pct + down_pct = 100（各カード）
4. 初期スコアの大小関係を尊重しつつ、差を明確にする
5. up_pct の範囲は 10〜75 の間に収める

## 出力形式（JSONのみ、コードブロック不要）
[
  { "card_id": "xxx", "up_pct": 整数, "flat_pct": 整数, "down_pct": 整数 },
  ...
]`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: { temperature: 0.3 },
  })

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed: RankEntry[] = JSON.parse(raw)

    const resultMap = new Map<string, { up_pct: number; flat_pct: number; down_pct: number }>()
    for (const entry of parsed) {
      const up = Number(entry.up_pct)
      const flat = Number(entry.flat_pct)
      const down = Number(entry.down_pct)
      if (up + flat + down === 100 && entry.card_id) {
        resultMap.set(entry.card_id, { up_pct: up, flat_pct: flat, down_pct: down })
      }
    }
    return resultMap
  } catch (e) {
    console.error('[adjustRankings] failed, keeping original scores:', e instanceof Error ? e.message : e)
    return new Map(items.map(({ cardId, forecast }) => [cardId, forecast.overall]))
  }
}
