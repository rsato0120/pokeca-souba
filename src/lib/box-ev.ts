import type { Card, BoxPullRates, PullGroup } from '@/types/pokeca'

// ── BOX開封の期待値 ──────────────────────────────────────────────
// 「1BOX開けたら中身はいくらぶんか」を、封入率（data/pull-rates.json）× 掲載カードの
// 現在相場で積み上げる。当サイトは光り物の一部しか掲載していないので、
// 未掲載カードは 0円 として扱う＝出てくる数字は必ず実際より低い「下限値」になる。
// この性質を隠すと誤読されるので、カバー率を必ず一緒に返して UI で明示する。

export interface EvRow {
  id: string
  label: string
  kinds: number          // セット全体の収録種類数
  listed: number         // うち当サイトが相場を持っている枚数
  perCard: number        // カード1枚あたりのBOX期待枚数
  expectedCards: number  // 掲載分の期待枚数（listed × perCard）
  avgPrice: number       // 掲載分の平均相場
  ev: number             // 掲載分の期待額
}

export interface BoxEv {
  rows: EvRow[]
  ev: number                     // 掲載カードのみの1BOX期待回収額（下限）
  coverage: number               // 期待枚数ベースのカバー率 0-1
  listedKinds: number
  totalKinds: number
  boxPrice: number | null        // BOX相場（中央値）
  msrp: number | null            // 定価
  recoveryPct: number | null     // ev ÷ BOX相場
  msrpRecoveryPct: number | null // ev ÷ 定価
  confidence: BoxPullRates['confidence']
  source: string
  sourceUrl?: string
}

function matches(card: Card, g: PullGroup): boolean {
  if (card.rarity !== g.rarity) return false
  const stage = card.card_spec.stage
  if (g.stages && !g.stages.includes(stage)) return false
  if (g.stages_not && g.stages_not.includes(stage)) return false
  return true
}

/**
 * @param cards      その弾の掲載カード
 * @param priceOf    カード1枚の現在相場（中央値）。取れていなければ0を返すこと
 * @param boxPrice   未開封BOXの現在相場。null なら回収率は出さない
 */
export function computeBoxEv(
  rates: BoxPullRates | null,
  cards: Card[],
  priceOf: (card: Card) => number,
  boxPrice: number | null,
  msrp: number | null,
): BoxEv | null {
  if (!rates || rates.groups.length === 0) return null

  const rows: EvRow[] = []
  let expectedAll = 0  // 全種類ぶんの期待枚数（カバー率の分母）

  for (const g of rates.groups) {
    expectedAll += g.kinds * g.per_card

    // 相場が取れているカードだけを積む（0円のカードを平均に混ぜない）
    const priced = cards.filter(c => matches(c, g)).map(c => priceOf(c)).filter(p => p > 0)
    if (priced.length === 0) {
      rows.push({ id: g.id, label: g.label, kinds: g.kinds, listed: 0, perCard: g.per_card, expectedCards: 0, avgPrice: 0, ev: 0 })
      continue
    }
    // 掲載枚数が種類数を超えることはないはずだが、データ不整合で期待値が膨らむのを防ぐ
    const listed = Math.min(priced.length, g.kinds)
    const sum = priced.reduce((s, p) => s + p, 0)
    rows.push({
      id: g.id,
      label: g.label,
      kinds: g.kinds,
      listed,
      perCard: g.per_card,
      expectedCards: listed * g.per_card,
      avgPrice: Math.round(sum / priced.length),
      ev: Math.round((sum / priced.length) * listed * g.per_card),
    })
  }

  const ev = rows.reduce((s, r) => s + r.ev, 0)
  const expectedListed = rows.reduce((s, r) => s + r.expectedCards, 0)

  return {
    rows,
    ev,
    coverage: expectedAll > 0 ? expectedListed / expectedAll : 0,
    listedKinds: rows.reduce((s, r) => s + r.listed, 0),
    totalKinds: rates.groups.reduce((s, g) => s + g.kinds, 0),
    boxPrice,
    msrp,
    recoveryPct: boxPrice && boxPrice > 0 ? Math.round((ev / boxPrice) * 100) : null,
    msrpRecoveryPct: msrp && msrp > 0 ? Math.round((ev / msrp) * 100) : null,
    confidence: rates.confidence,
    source: rates.source,
    sourceUrl: rates.source_url,
  }
}

// 回収率から「開封 vs シングル買い」の判定を1行で出す。
// 下限値なので「損」とは言い切らず、カバー率が低い弾では判定自体を伏せる。
export function evVerdict(ev: BoxEv): { label: string; color: string; desc: string } | null {
  if (ev.recoveryPct == null) return null
  const r = ev.recoveryPct
  if (ev.coverage < 0.5) {
    return {
      label: '参考値',
      color: 'var(--flat)',
      desc: `掲載カードだけで BOX相場の ${r}% ぶん。未掲載カードが多い弾なので、実際の中身はこれより高くなります。`,
    }
  }
  if (r >= 100) return { label: '開封が優勢', color: 'var(--up)', desc: '掲載カードだけで BOX価格を上回る計算。シングル買いより開封のほうが期待値が高い水準です。' }
  if (r >= 70) return { label: '拮抗', color: 'var(--flat)', desc: '掲載カードだけで BOX価格の7割以上。未掲載の下位レアを足せば概ね釣り合う水準です。' }
  return { label: 'シングル買い優勢', color: 'var(--down)', desc: '中身の期待値がBOX価格に届きません。狙いのカードはシングルで買うほうが安く済む可能性が高い水準です。' }
}
