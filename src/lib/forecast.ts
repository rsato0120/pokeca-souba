import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Card, Forecast, Trend } from '@/types/pokeca'

// ─── 現在相場取得（Google Search grounding） ─────────────────────

async function fetchCurrentPrice(
  card: Card,
  apiKey: string
): Promise<{ low: number; high: number }> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} } as any],
  })

  const prompt = `ポケモンカード「${card.card_name}」（${card.rarity}）の現在の日本市場での相場価格を調べてください。
カードラッシュ・遊々亭・駿河屋・メルカリなどの実勢価格をもとに、美品の平均的な売買価格レンジを教えてください。
必ず以下のJSON形式のみで回答してください（前後の文章・コードブロック不要）:
{"low": 最安値の目安(円・整数), "high": 最高値の目安(円・整数)}`

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text()
    const match = raw.match(/\{[\s\S]*?"low"[\s\S]*?"high"[\s\S]*?\}/)
    if (!match) throw new Error('price JSON not found')
    const parsed = JSON.parse(match[0])
    const low = Number(parsed.low)
    const high = Number(parsed.high)
    if (!low || !high || low <= 0 || high <= 0) throw new Error('invalid price values')
    return { low, high }
  } catch (e) {
    console.error('[fetchCurrentPrice] failed:', e instanceof Error ? e.message : e)
    return { low: 2500, high: 3500 }
  }
}

// ─── プロンプト構築 ──────────────────────────────────────────────

function buildPrompt(card: Card, currentLow: number, currentHigh: number): string {
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

  return `あなたはポケモンカードの相場分析の専門家です。
以下のカード情報をもとに、今後1〜2ヶ月の相場予想を生成してください。

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
- 再録状況: ${common.reprint_status}
- 品薄度: ${common.scarcity}
- キャラ人気: ${common.character_popularity}

## 補足情報（証拠メモ）
- プレイヤー視点: ${card.evidence_notes.player}
- コレクター視点: ${card.evidence_notes.collector}

## 出力ルール
1. 断言しない。「上がります」ではなく確率＋根拠で示す
2. player_view と collector_view を分けて分析する
3. 再録 → 供給増加 → 下落圧力、スタン落ち間近 → 実需減少、などの因果を使う
4. 根拠文は日本語で2〜3文、具体的に書く
5. overall の up_pct + flat_pct + down_pct = 100 にする
6. price_forecast は現在の参考相場から合理的に算出する（current_low=${currentLow}, current_high=${currentHigh} を起点とする）

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
    "base_low": 整数,
    "base_high": 整数,
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
      base_low: Number(parsed.price_forecast.base_low),
      base_high: Number(parsed.price_forecast.base_high),
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

export async function generateForecast(card: Card): Promise<Forecast> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY が設定されていません。.env.local に追加してください。')
  }

  // Step 1: Google Search grounding で現在相場を取得
  const { low: currentLow, high: currentHigh } = await fetchCurrentPrice(card, apiKey)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  })

  // Step 2: 取得した現在相場をプロンプトに反映して予想生成
  const prompt = buildPrompt(card, currentLow, currentHigh)

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
以下の${items.length}枚のカードを比較し、今後1〜2ヶ月の上昇期待度を相対的に評価し直してください。

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
