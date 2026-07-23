import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Box, Card, Forecast, PriceRecord, PsaPop, Trend } from '@/types/pokeca'
import type { BoxCalibration } from './calibration'

// カード単体の材料・価格履歴だけでは判断できない文脈（弾の状況・レア間の位置・自己較正）。
// すべて呼び出し側がディスクから組み立てて渡す。未指定でも動く（該当セクションが出ないだけ）。
export interface ForecastContext {
  box?: Box | null
  boxHistory?: PriceRecord[] | null
  /** 同名カードの他レアリティの相場（このカード自身は含めない） */
  siblings?: Array<{ rarity: string; mid: number }> | null
  calibration?: BoxCalibration | null
  psaPop?: PsaPop | null
}

// ─── プロンプト構築 ──────────────────────────────────────────────

// 内容の目視確認（scripts/_preview_ctx.ts 等）ができるよう export している
export function buildPrompt(
  card: Card,
  currentLow: number,
  currentHigh: number,
  priceHistory: PriceRecord[],
  ctx: ForecastContext = {}
): string {
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

    // 成約総件数（sold_total）の増分＝実際に売れた枚数。回転の速さは需要の強さを直接表す。
    // メルカリ成約を取得した日のみ記録されるため、スニダン採用カードでは欠けることがある。
    const withSold = priceHistory.filter(r => r.sold_total != null)
    if (withSold.length >= 2) {
      const newestSold = withSold[0]
      const oldestSold = withSold[withSold.length - 1]
      const days = Math.max(
        1,
        Math.round((new Date(newestSold.date).getTime() - new Date(oldestSold.date).getTime()) / 86400000)
      )
      const perDay = (newestSold.sold_total! - oldestSold.sold_total!) / days
      if (perDay >= 0) {
        const velocityLabel = perDay >= 5 ? '非常に速い（毎日売れている＝実需が厚い）'
          : perDay >= 1.5 ? '速い（活発に取引されている）'
          : perDay >= 0.5 ? '普通'
          : '遅い（買い手が少なく、値付けが崩れやすい）'
        historySection += `\n## 取引の回転（メルカリ成約件数の増加ペース）\n`
        historySection += `- 直近${days}日で約${Math.round(perDay * 10) / 10}枚/日が成約 → ${velocityLabel}\n`
      }
    }
  }

  // ── PSA10プレミアム: 鑑定品にどれだけ上乗せが付くか＝美品/コレクター需要の強さ
  let psaSection = ''
  const psaRec = priceHistory.find(r => r.psa10 != null && Number(r.psa10) > 0)
  if (psaRec) {
    const psa10 = Number(psaRec.psa10)
    const base = midOf(psaRec)
    if (base > 0) {
      const mult = psa10 / base
      const label = mult >= 8 ? '非常に高い（鑑定に出す価値が大きく、美品需要が強い。素体の下値も固い）'
        : mult >= 4 ? '高い（コレクター需要がしっかりある）'
        : mult >= 2.5 ? '標準的'
        : '低い（鑑定妙味が薄く、コレクター需要は限定的）'
      psaSection = `\n## PSA10（鑑定品）相場\n`
      psaSection += `- PSA10: ¥${Math.round(psa10).toLocaleString()}（素体の${Math.round(mult * 10) / 10}倍）→ プレミアは${label}\n`

      const psaSeries = priceHistory.filter(r => r.psa10 != null && Number(r.psa10) > 0)
      if (psaSeries.length >= 2) {
        const oldPsa = Number(psaSeries[psaSeries.length - 1].psa10)
        const psaChange = Math.round(((psa10 - oldPsa) / oldPsa) * 100)
        if (Math.abs(psaChange) >= 5) {
          psaSection += `- PSA10の推移: ${psaChange >= 0 ? '+' : ''}${psaChange}%（鑑定品が先に動くことがあり、素体の先行指標になりうる）\n`
        }
      }
    }
  }

  // ── PSA鑑定枚数: 鑑定済みが何枚あるか＝「良品の供給量」。価格と違い後戻りしない硬い指標。
  let popSection = ''
  const pop = ctx.psaPop
  if (pop) {
    const popLabel = pop.psa10 < 300 ? '非常に少ない（鑑定済みの良品が希少）'
      : pop.psa10 < 1500 ? '少なめ'
      : pop.psa10 < 6000 ? '標準的'
      : '非常に多い（鑑定品が潤沢に出回っており、PSA10であること自体の希少性は低い）'
    const gemLabel = pop.gem_rate >= 90 ? '非常に高い（10が出やすく、PSA10の供給は今後も増えやすい）'
      : pop.gem_rate >= 75 ? '高い'
      : pop.gem_rate >= 55 ? '普通'
      : '低い（10が出にくく、PSA10のプレミアは維持されやすい）'
    popSection = `\n## PSA鑑定枚数（良品の供給量）\n`
    popSection += `- PSA10: ${pop.psa10.toLocaleString()}枚 / 総鑑定 ${pop.total.toLocaleString()}枚 → ${popLabel}\n`
    popSection += `- PSA10率: ${pop.gem_rate}% → ${gemLabel}\n`
  }

  // ── 相場の厚み: 何件の取引で決まった値か。薄い相場は極端な予想を避ける根拠になる
  let liquiditySection = ''
  const latest = priceHistory[0]
  if (latest?.source) {
    const srcLabel = latest.source === 'snkrdunk' ? 'スニーカーダンクの素体取引' : 'メルカリ成約'
    liquiditySection = `\n## 相場の厚み\n- 現在相場の出所: ${srcLabel}\n`
    if (latest.sample_count != null) {
      const n = latest.sample_count
      const thickness = n <= 3 ? '非常に薄い（少数の取引で決まった値。実勢と乖離している可能性がある）'
        : n <= 8 ? '薄め（参考程度に扱う）'
        : '十分'
      liquiditySection += `- 算出に使った取引件数: ${n}件 → ${thickness}\n`
    }
  }

  // ── 弾の状況: 発売からの経過と、弾そのもの（未開封BOX）の地合い
  let setSection = ''
  const box = ctx.box
  if (box) {
    setSection = `\n## 収録弾の状況\n- 弾名: ${box.box_name}（${box.code}・${box.release_ym}発売）\n`
    const m = /^(\d{4})-(\d{2})$/.exec(box.release_ym)
    if (m) {
      const released = new Date(Number(m[1]), Number(m[2]) - 1, 1).getTime()
      const months = Math.max(0, Math.round((Date.now() - released) / (30.44 * 86400000)))
      const stage = months < 3 ? '発売直後（開封が続き供給が最も多い時期。下落圧力が強い）'
        : months < 12 ? '流通中（供給は続くが開封のピークは越えた）'
        : months < 36 ? '市場消化が進んだ時期（供給は中古のみ。良品は減り始める）'
        : '旧弾（絶版。供給は中古のみで、良品の希少性が年々上がる）'
      setSection += `- 発売から約${months}ヶ月 → ${stage}\n`
    }
    const bh = ctx.boxHistory ?? []
    if (bh.length > 0) {
      const boxNow = midOf(bh[0])
      setSection += `- 未開封BOX相場: ¥${Math.round(boxNow).toLocaleString()}\n`
      if (box.pack_price_yen && box.packs_per_box) {
        const msrp = box.pack_price_yen * box.packs_per_box
        const premium = Math.round(((boxNow - msrp) / msrp) * 100)
        setSection += `- 定価(¥${msrp.toLocaleString()})比: ${premium >= 0 ? '+' : ''}${premium}%（BOXのプレミア＝弾全体の人気度）\n`
      }
      if (bh.length >= 2) {
        const boxOld = midOf(bh[bh.length - 1])
        const boxChange = Math.round(((boxNow - boxOld) / boxOld) * 100)
        const dir = boxChange > 5 ? '弾全体が上昇基調（追い風）' : boxChange < -5 ? '弾全体が下落基調（向かい風）' : '弾全体は横ばい'
        setSection += `- BOX相場の推移: ${boxChange >= 0 ? '+' : ''}${boxChange}% → ${dir}\n`
      }
    }
  }

  // ── レア間の位置: 同名カードの別レアリティと比べて何倍か（弾内でのチェイス度）
  let siblingSection = ''
  const siblings = ctx.siblings ?? []
  if (siblings.length > 0) {
    const selfMid = (currentLow + currentHigh) / 2
    const list = siblings
      .slice()
      .sort((a, b) => a.mid - b.mid)
      .map(s => `${s.rarity} ¥${Math.round(s.mid).toLocaleString()}`)
      .join(' / ')
    siblingSection = `\n## 同名カードの他レアリティ\n- ${list}\n`
    const cheapest = Math.min(...siblings.map(s => s.mid))
    if (cheapest > 0) {
      const ratio = Math.round((selfMid / cheapest) * 10) / 10
      siblingSection += `- このカード（${card.rarity}）は最安レアの${ratio}倍。倍率が極端に大きい場合は上位レアに需要が集中している（＝下位レアは値動きが鈍い）\n`
    }
  }

  // ── 自己較正: 弾単位で「これまで強気/弱気に外していないか」だけを渡す
  let calibrationSection = ''
  const cal = ctx.calibration
  if (cal) {
    const gap = cal.avgPredictedNet - cal.avgActualPct
    const verdict = gap > 20 ? 'これまでこの弾には強気に寄りすぎていた'
      : gap < -20 ? 'これまでこの弾には弱気に寄りすぎていた'
      : 'これまでの予想と実際の値動きは概ね整合している'
    calibrationSection = `\n## 過去予想の較正（この弾${cal.cards}枚の平均）\n`
    calibrationSection += `- ${cal.lookbackDays}日前のAI予想: 平均ネット${cal.avgPredictedNet >= 0 ? '+' : ''}${cal.avgPredictedNet}（up_pct−down_pct）\n`
    calibrationSection += `- その後の実際の変動: 平均${cal.avgActualPct >= 0 ? '+' : ''}${cal.avgActualPct}% → ${verdict}\n`
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
${historySection}${psaSection}${popSection}${liquiditySection}${setSection}${siblingSection}${calibrationSection}
## 出力ルール
1. 断言しない。「上がります」ではなく確率＋根拠で示す
2. コレクター視点（観賞・保有価値）で分析する。対戦採用の有無は判断材料にしない
3. 上昇圧力と下落圧力の両方を公平に検討し、このカード固有の材料から方向を判断する。機械的にどちらか一方へ倒さないこと。
   【下落圧力の例】再録／再録予定→供給増、出品数の増加→供給過多
   【上昇圧力の例】品薄・絶版→希少性プレミア、人気絵師の描き下ろし→コレクター需要、キャラ人気が高い→長期保有需要、出品数の減少→需給逼迫
4. すべてのカードが下落するわけではない。新弾直後の供給増は一要因にすぎず、希少・人気絵師・品薄・絶版など強い材料を持つカードは横ばい〜上昇も十分ありうる。材料の強弱に応じてカードごとに明確に差別化し、up_pct を団子にしない（強い材料なら40〜70%、弱い材料なら10〜25%など幅を持たせる）
5. 提供された各セクションは次のように扱う（記載が無いセクションは判断材料から外す）
   - 相場の厚み: 取引件数が少ない（薄い）ほど現在価格自体が不確かなので、極端な up/down に振らず flat を厚めにする
   - PSA10プレミアム: 倍率が高いほど美品需要が強く素体の下値も固い（下落幅を小さく見積もる根拠になる）
   - PSA鑑定枚数: 鑑定済みが多いほど良品の供給が厚く上値が重い。少なければ希少性の裏付けになる。PSA10率が低いカードは美品が出にくく下値が固い
   - 収録弾の状況: 発売直後は開封による供給増で下落圧力、旧弾・絶版は希少性で上昇圧力。BOX相場の方向は弾全体の地合いとして加味する
   - 取引の回転: 回転が速い＝実需が厚く価格が崩れにくい。遅い＝少数の出品で相場が動きやすい
   - 同名カードの他レアリティ: 上位レアに需要が集中している場合、下位レアの値動きは鈍いと考える
   - 過去予想の較正: **参考程度に留める**。材料が変わっていないのに方向を反転させないこと。強気/弱気に寄りすぎと指摘された場合でも、調整は確率で数ポイント程度に収める
6. 根拠文は日本語で2〜3文、具体的に書く
7. overall の up_pct + flat_pct + down_pct = 100 にする
8. price_forecast は3時点（1ヶ月後・3ヶ月後・6ヶ月後）の本線予想価格を出す。起点は current_low=${currentLow}, current_high=${currentHigh}
9. up/down は6ヶ月後の上振れ・下振れシナリオ価格

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

function parseForecastJson(raw: string, card: Card, currentLow: number, currentHigh: number): Forecast {
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
      // current_low/high はスクレイピングで取得した実価格をそのまま採用する。
      // AIに出力させるとプロンプトで指定した起点を無視して無関係な数値を返すことがあるため、
      // ここでプログラム側から上書きし、実データと乖離しないようにする。
      current_low: currentLow,
      current_high: currentHigh,
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
  priceHistory: PriceRecord[] = [],
  ctx: ForecastContext = {}
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

  const prompt = buildPrompt(card, currentLow, currentHigh, priceHistory, ctx)

  // リトライ（最大2回）
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const raw = result.response.text()
      return parseForecastJson(raw, card, currentLow, currentHigh)
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
