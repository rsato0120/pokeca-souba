// マイコレクションの称号バッジ。
//
// 集める動機と「見せたくなる数字」を作るのが目的なので、判定はすべて手元の
// コレクション（localStorage）から決まる純関数にしてある。サーバーもDBも要らない。
//
// 方針:
//  - 称号は「系統（family）× 段位」で持ち、**達成済みの最上段と、次の1段だけ**を返す。
//    全段を並べるとバッジの壁になって、どれが今の自分か分からなくなる。
//  - 段位の敷居は「初回訪問で1つは点く / 上は当分届かない」を狙う。
//    ゼロ個だと寂しく、全部点くと伸びしろが消える。

export type BadgeInput = {
  totalValue: number                 // 保有の評価額合計
  totalQty: number                   // 総枚数（素体＋PSA10）
  psa10Qty: number                   // PSA10の枚数
  boxOwned: Record<string, number>   // 弾名 → 所持している種類数
  boxTotal: Record<string, number>   // 弾名 → 掲載されている種類数
  plPct: number | null               // 含み損益率（買値を入れた分のみ。未入力なら null）
  topUnitPrice: number               // いちばん高い1枚の単価
}

export type Badge = {
  id: string
  name: string        // 称号
  desc: string        // 条件
  detail: string      // 現在値（「¥62,300 / ¥100,000」など）
  earned: boolean
  progress: number    // 0..1（未達バッジの進捗バー用）
}

type Tier = { id: string; name: string; need: number; desc: string }

type Family = {
  key: string
  tiers: Tier[]
  value: (i: BadgeInput) => number | null   // null＝この系統は判定不能（表示しない）
  format: (v: number) => string
}

const yen = (v: number) => `¥${Math.round(v).toLocaleString()}`

const FAMILIES: Family[] = [
  {
    // 評価額。石高になぞらえる（サイトの明朝＋相場師の世界観に合わせた遊び）
    key: 'value',
    value: i => i.totalValue,
    format: yen,
    tiers: [
      { id: 'value-1', name: '一万石', need: 10_000, desc: '評価額 1万円' },
      { id: 'value-2', name: '五万石', need: 50_000, desc: '評価額 5万円' },
      { id: 'value-3', name: '十万石', need: 100_000, desc: '評価額 10万円' },
      { id: 'value-4', name: '五十万石', need: 500_000, desc: '評価額 50万円' },
      { id: 'value-5', name: '百万石', need: 1_000_000, desc: '評価額 100万円' },
    ],
  },
  {
    key: 'qty',
    value: i => i.totalQty,
    format: v => `${v}枚`,
    tiers: [
      { id: 'qty-1', name: '手習い', need: 5, desc: '5枚を所持' },
      { id: 'qty-2', name: '蒐集家', need: 30, desc: '30枚を所持' },
      { id: 'qty-3', name: '大蒐集家', need: 100, desc: '100枚を所持' },
      { id: 'qty-4', name: '博物館', need: 300, desc: '300枚を所持' },
    ],
  },
  {
    key: 'psa',
    value: i => i.psa10Qty,
    format: v => `${v}枚`,
    tiers: [
      { id: 'psa-1', name: '鑑定入門', need: 1, desc: 'PSA10を1枚' },
      { id: 'psa-2', name: '鑑定通', need: 5, desc: 'PSA10を5枚' },
      { id: 'psa-3', name: '鑑定名人', need: 20, desc: 'PSA10を20枚' },
    ],
  },
  {
    key: 'top',
    value: i => i.topUnitPrice,
    format: yen,
    tiers: [
      { id: 'top-1', name: '一点物', need: 10_000, desc: '1万円のカードを所持' },
      { id: 'top-2', name: '主砲', need: 100_000, desc: '10万円のカードを所持' },
      { id: 'top-3', name: '家宝', need: 500_000, desc: '50万円のカードを所持' },
    ],
  },
  {
    // 含み益。買値を入れていないと判定できないので、その時は系統ごと出さない
    key: 'pl',
    value: i => i.plPct,
    format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    tiers: [
      { id: 'pl-1', name: '目利き', need: 10, desc: '含み益 +10%' },
      { id: 'pl-2', name: '相場巧者', need: 30, desc: '含み益 +30%' },
      { id: 'pl-3', name: '相場王', need: 100, desc: '含み益 +100%' },
    ],
  },
]

// 弾コンプは「どの弾を制覇したか」を名前に入れたいので系統テーブルとは別扱い
function conquestBadges(input: BadgeInput): Badge[] {
  const boxes = Object.keys(input.boxTotal).filter(b => (input.boxTotal[b] ?? 0) > 0)
  const done = boxes.filter(b => (input.boxOwned[b] ?? 0) >= input.boxTotal[b])

  if (done.length > 0) {
    return [{
      id: 'conquest',
      name: done.length === 1 ? `${done[0]} 制覇` : `${done.length}弾 制覇`,
      desc: '掲載カードを全種そろえた',
      detail: done.join(' / '),
      earned: true,
      progress: 1,
    }]
  }

  // 未達なら「いちばん近い弾」を次の目標として出す（残り枚数が見えると集めたくなる）
  let best: { box: string; owned: number; total: number } | null = null
  for (const b of boxes) {
    const owned = input.boxOwned[b] ?? 0
    if (owned === 0) continue
    const cur = { box: b, owned, total: input.boxTotal[b] }
    if (!best || cur.owned / cur.total > best.owned / best.total) best = cur
  }
  if (!best) return []

  return [{
    id: 'conquest',
    name: `${best.box} 制覇`,
    desc: '掲載カードを全種そろえる',
    detail: `${best.owned} / ${best.total}種（あと${best.total - best.owned}種）`,
    earned: false,
    progress: best.owned / best.total,
  }]
}

export function computeBadges(input: BadgeInput): { earned: Badge[]; next: Badge[] } {
  const earned: Badge[] = []
  const next: Badge[] = []

  for (const fam of FAMILIES) {
    const v = fam.value(input)
    if (v == null) continue

    // 達成済みの最上段
    const cleared = [...fam.tiers].reverse().find(t => v >= t.need)
    if (cleared) {
      earned.push({
        id: cleared.id, name: cleared.name, desc: cleared.desc,
        detail: fam.format(v), earned: true, progress: 1,
      })
    }

    // その1つ上（無ければ打ち止め＝最高段なので次は出さない）
    const upcoming = fam.tiers.find(t => v < t.need)
    if (upcoming) {
      next.push({
        id: upcoming.id, name: upcoming.name, desc: upcoming.desc,
        detail: `${fam.format(v)} / ${fam.format(upcoming.need)}`,
        earned: false,
        progress: Math.max(0, Math.min(1, v / upcoming.need)),
      })
    }
  }

  for (const b of conquestBadges(input)) {
    (b.earned ? earned : next).push(b)
  }

  // 次の称号は「近い順」に。遠い目標から見せても手が伸びない
  next.sort((a, b) => b.progress - a.progress)

  // ただし弾コンプだけは順位が低くても必ず見せる。これがこの機能の主目的
  // （「あと◯種で制覇」がいちばん集める動機になる）なのに、達成率では
  // 金額系の称号に埋もれて表示枠から落ちるため。
  const ci = next.findIndex(b => b.id === 'conquest')
  if (ci > 3) next.splice(3, 0, ...next.splice(ci, 1))

  return { earned, next }
}
