import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Card, Forecast, Trend } from '@/types/pokeca'

// ─── プロンプト構築 ──────────────────────────────────────────────

function buildPrompt(card: Card): string {
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
6. price_forecast は現在の参考相場から合理的に算出する（current_low=2500, current_high=3500 を起点とする）

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

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4, // 低め＝安定した出力
    },
  })

  const prompt = buildPrompt(card)

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
