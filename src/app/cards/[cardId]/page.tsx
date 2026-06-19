import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllCards, getCardBySlug, getBoxById, getForecast, getCardSlug } from '@/lib/data'
import type { Forecast } from '@/types/pokeca'

export function generateStaticParams() {
  return getAllCards().map((card) => ({ cardId: getCardSlug(card) }))
}

const TREND_LABEL = { up: '▲ 上昇', flat: '→ 横ばい', down: '▼ 下落' } as const
const TREND_COLOR = { up: 'var(--up)', flat: 'var(--flat)', down: 'var(--down)' } as const

const ROTATION_LABEL: Record<string, string> = {
  soon: '来期落ち予定',
  upcoming: '数期先',
  far: '当分先',
  unknown: '未定',
}

const USAGE_LABEL: Record<string, string> = {
  high: '高',
  mid: '中',
  low: '低',
  none: 'なし',
}

const CHAR_POP_LABEL: Record<string, string> = { high: '高', mid: '中', unknown: '—' }
const ILLUST_POP_LABEL: Record<string, string> = { high: '高', mid: '中', unknown: '—' }
const ARTWORK_LABEL: Record<string, string> = { original: '描き下ろし', reused: '流用', unknown: '—' }
const SCARCITY_LABEL: Record<string, string> = { normal: '通常', scarce: '品薄', out_of_print: '絶版' }
const REPRINT_LABEL: Record<string, string> = { none: 'なし', reprinted: '再録済', reprint_planned: '予定あり' }

const X_POINTS = [70, 290, 510, 730] // 現在, 2週後, 1ヶ月後, 2ヶ月後
const Y_MIN = 220
const Y_MAX = 40

function buildChartPaths(forecast: Forecast) {
  const { current_low, current_high, base_low, base_high, up_low, up_high, down_low, down_high } =
    forecast.price_forecast

  // 価格範囲をデータから動的に算出
  const allPrices = [current_low, current_high, base_low, base_high, up_low, up_high, down_low, down_high]
  const rawMin = Math.min(...allPrices)
  const rawMax = Math.max(...allPrices)
  const pad = (rawMax - rawMin) * 0.15 || rawMin * 0.1
  const minPrice = Math.max(0, rawMin - pad)
  const maxPrice = rawMax + pad

  const priceToY = (p: number) =>
    Y_MIN + ((p - minPrice) / (maxPrice - minPrice)) * (Y_MAX - Y_MIN)

  const currentMid = (current_low + current_high) / 2
  const baseMid = (base_low + base_high) / 2
  const upMid = (up_low + up_high) / 2
  const downMid = (down_low + down_high) / 2

  const basePoints = [currentMid, baseMid * 0.5 + currentMid * 0.5, baseMid * 0.8 + currentMid * 0.2, baseMid]
  const upPoints = [currentMid, upMid * 0.3 + currentMid * 0.7, upMid * 0.7 + currentMid * 0.3, upMid]
  const downPoints = [currentMid, downMid * 0.3 + currentMid * 0.7, downMid * 0.7 + currentMid * 0.3, downMid]

  const toPolyline = (pts: number[]) =>
    X_POINTS.map((x, i) => `${x},${priceToY(pts[i])}`).join(' ')

  // Y軸ラベル（固定グリッド4本に対応する価格）
  const step = (maxPrice - minPrice) / 3
  const yLabels = [
    { y: Y_MAX, price: maxPrice },
    { y: Y_MAX + (Y_MIN - Y_MAX) / 3, price: maxPrice - step },
    { y: Y_MAX + (Y_MIN - Y_MAX) * 2 / 3, price: maxPrice - step * 2 },
    { y: Y_MIN, price: minPrice },
  ]

  return {
    base: toPolyline(basePoints),
    up: toPolyline(upPoints),
    down: toPolyline(downPoints),
    startY: priceToY(currentMid),
    startPrice: currentMid,
    yLabels,
  }
}

// スタブfallback
function stubForecast(card_no: string, rarity: string): Forecast {
  return {
    card_no,
    rarity,
    generated_at: '',
    player_view: { trend: 'flat', probability: 45, reason: '予想データを準備中です。' },
    collector_view: { trend: 'up', probability: 35, reason: '予想データを準備中です。' },
    overall: { up_pct: 35, flat_pct: 45, down_pct: 20, reason: '予想データを準備中です。' },
    price_forecast: {
      current_low: 2500,
      current_high: 3500,
      base_low: 2800,
      base_high: 4000,
      up_low: 4000,
      up_high: 5000,
      down_low: 1800,
      down_high: 2500,
    },
    disclaimer:
      '本予想は AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。実際の取引価格は市場状況により変動します。売買の判断はご自身の責任で行ってください。',
  }
}

export default async function CardPage(props: PageProps<'/cards/[cardId]'>) {
  const { cardId } = await props.params
  const card = getCardBySlug(cardId)
  if (!card) notFound()

  const box = getBoxById(card.box_id)
  const forecast: Forecast = getForecast(card.id) ?? stubForecast(card.card_no, card.rarity)
  const chart = buildChartPaths(forecast)

  const { overall, player_view, collector_view, price_forecast } = forecast

  return (
    <div className="wrap" style={{ maxWidth: '820px' }}>
      <Link
        href="/"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          color: 'var(--ink-faint)',
          letterSpacing: '0.06em',
          display: 'inline-block',
          padding: '18px 0 10px',
        }}
      >
        ← トップへ戻る
      </Link>
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
      </header>

      <div className="searchbar" style={{ marginBottom: '30px' }}>
        <input type="text" placeholder="カード名で検索" defaultValue={card.card_name} />
        <button>予想する</button>
      </div>

      {/* ── カード + バーディクト ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '210px 1fr',
          gap: '30px',
          alignItems: 'start',
          marginBottom: '24px',
        }}
      >
        {/* カード枠 */}
        <div>
          <div className="pokecard" style={{ padding: card.image_url ? '0' : undefined, overflow: 'hidden' }}>
            {card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image_url}
                alt={`${card.card_name} ${card.rarity}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="ph">
                <span className="big">{card.card_name}</span>
                <span>カード画像</span>
              </div>
            )}
            <div className="no">{card.card_no} ・ {card.rarity}</div>
          </div>
          <div
            style={{
              marginTop: '12px',
              textAlign: 'center',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: TREND_COLOR[overall.up_pct >= 40 ? 'up' : overall.down_pct >= 40 ? 'down' : 'flat'],
            }}
          >
            {overall.up_pct >= 40 ? '▲ 相場は明るい' : overall.down_pct >= 40 ? '▼ 相場は弱含み' : '→ 相場は横ばい'}
          </div>
        </div>

        {/* バーディクト */}
        <div style={{ paddingTop: '4px' }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              color: 'var(--ink-faint)',
              marginBottom: '6px',
            }}
          >
            FORECAST · 今後 1–2 ヶ月
          </div>
          <h1
            style={{
              fontFamily: 'var(--mincho)',
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              marginBottom: '12px',
              lineHeight: 1.3,
            }}
          >
            {card.card_name}
            <span className="rare-badge">{card.rarity}</span>
          </h1>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              color: 'var(--ink-faint)',
              marginBottom: '20px',
              letterSpacing: '0.03em',
            }}
          >
            <Link
              href={`/boxes/${card.box_id}`}
              style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--hair)' }}
            >
              {box?.box_name ?? card.box_id}
            </Link>{' '}・{' '}
            <span style={{ color: 'var(--ink-dim)' }}>
              {card.card_spec.type} / HP{card.card_spec.hp}
            </span>{' '}
            ・ {box?.release_ym ?? '—'} 発売 ・ illus. {card.materials.collector.illustrator}
          </div>

          {/* 現在相場 */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--hair)',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.06em' }}>
              現在のおおよその相場（参考レンジ）
            </span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              ¥{price_forecast.current_low.toLocaleString()}{' '}
              <small style={{ fontSize: '13px', color: 'var(--ink-dim)', fontWeight: 400 }}>〜</small>{' '}
              ¥{price_forecast.current_high.toLocaleString()}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--ink-faint)', width: '100%' }}>
              ※ 美品・{card.rarity}版の目安。状態・販路により変動します。
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '22px' }}>
            出典：相場データ取得後に表示されます（1日1回 自動取得）
          </div>
        </div>
      </div>

      {/* ── 予想推移グラフ ── */}
      <div style={{ marginBottom: '26px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              color: 'var(--ink-faint)',
            }}
          >
            PRICE FORECAST · 予想推移
          </span>
          <div
            style={{
              display: 'flex',
              gap: '14px',
              fontSize: '11px',
              color: 'var(--ink-dim)',
            }}
          >
            {[
              { color: 'var(--flat)', label: '本線' },
              { color: 'var(--up)', label: '上振れ' },
              { color: 'var(--down)', label: '下振れ' },
            ].map(({ color, label }) => (
              <span key={label}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '0',
                    borderTop: `2px solid ${color}`,
                    marginRight: '5px',
                    verticalAlign: 'middle',
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--hair)',
            borderRadius: '8px',
            padding: '14px 8px 6px',
          }}
        >
          <svg
            viewBox="0 0 760 280"
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ fontFamily: 'var(--mono)' }}
          >
            <g stroke="#2b281f" strokeWidth="1">
              <line x1="70" y1="40" x2="730" y2="40" />
              <line x1="70" y1="100" x2="730" y2="100" />
              <line x1="70" y1="160" x2="730" y2="160" />
              <line x1="70" y1="220" x2="730" y2="220" />
            </g>
            <g fill="#6f6a5b" fontSize="11" textAnchor="end">
              {chart.yLabels.map(({ y, price }) => (
                <text key={y} x="60" y={y + 4}>
                  {price >= 10000
                    ? `${Math.round(price / 1000)}千`
                    : Math.round(price).toLocaleString()}
                </text>
              ))}
            </g>
            <g fill="#6f6a5b" fontSize="11" textAnchor="middle">
              <text x="70" y="245">現在</text>
              <text x="290" y="245">2週後</text>
              <text x="510" y="245">1ヶ月後</text>
              <text x="730" y="245">2ヶ月後</text>
            </g>
            <polyline points={chart.up} fill="none" stroke="var(--up)" strokeWidth="1.5" strokeDasharray="4 4" />
            <polyline points={chart.down} fill="none" stroke="var(--down)" strokeWidth="1.5" strokeDasharray="4 4" />
            <polyline points={chart.base} fill="none" stroke="var(--flat)" strokeWidth="2.5" />
            <circle cx="70" cy={chart.startY} r="4.5" fill="var(--gold)" />
            <text x="80" y={chart.startY - 8} fill="var(--gold)" fontSize="11">
              ¥{Math.round(chart.startPrice).toLocaleString()}
            </text>
          </svg>
        </div>
      </div>

      {/* ── 総合シナリオ ── */}
      <div style={{ fontSize: '12px', color: 'var(--ink-faint)', letterSpacing: '0.06em', marginBottom: '9px' }}>
        総合シナリオ（今後 1–2 ヶ月）
      </div>
      <div
        style={{
          display: 'flex',
          height: '36px',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '1px solid var(--hair)',
          marginBottom: '26px',
        }}
      >
        {[
          { pct: overall.up_pct, bg: 'var(--up)', label: `↑ ${overall.up_pct}%` },
          { pct: overall.flat_pct, bg: 'var(--flat)', label: `→ ${overall.flat_pct}%` },
          { pct: overall.down_pct, bg: 'var(--down)', label: `↓ ${overall.down_pct}%` },
        ].map(({ pct, bg, label }) => (
          <div
            key={label}
            style={{
              width: `${pct}%`,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--bg)',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: '26px' }}>
        {overall.reason}
      </p>

      {/* ── プレイヤー/コレクター 2軸 ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          background: 'var(--hair)',
          border: '1px solid var(--hair)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '22px',
        }}
      >
        {[
          {
            title: 'プレイヤー需要',
            sub: '対戦での実需',
            view: player_view,
          },
          {
            title: 'コレクター需要',
            sub: '観賞・保有価値',
            view: collector_view,
          },
        ].map(({ title, sub, view }) => (
          <div key={title} style={{ background: 'var(--panel)', padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontFamily: 'var(--mincho)', fontSize: '16px', fontWeight: 700 }}>
                {title}
              </span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: TREND_COLOR[view.trend],
                }}
              >
                {TREND_LABEL[view.trend]}
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--ink-faint)',
                marginBottom: '14px',
                letterSpacing: '0.04em',
              }}
            >
              {sub}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
              {view.reason}
            </p>
          </div>
        ))}
      </div>

      {/* ── 根拠データ ── */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--ink-faint)',
            letterSpacing: '0.14em',
            marginBottom: '14px',
            fontWeight: 500,
          }}
        >
          EVIDENCE · 予想の根拠データ
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 36px' }}>
          {[
            { k: 'レギュレーション', v: card.materials.player.regulation_mark, accent: 'player' },
            { k: 'イラストレーター', v: card.materials.collector.illustrator, accent: 'collector' },
            { k: 'スタン落ち', v: ROTATION_LABEL[card.materials.player.rotation] ?? card.materials.player.rotation, accent: 'player' },
            { k: '絵師人気', v: ILLUST_POP_LABEL[card.materials.collector.illustrator_popularity], accent: 'collector' },
            { k: '競技採用度', v: USAGE_LABEL[card.materials.player.competitive_usage], accent: 'player' },
            { k: 'キャラ人気', v: CHAR_POP_LABEL[card.materials.common.character_popularity], accent: 'collector' },
            { k: '再録状況', v: REPRINT_LABEL[card.materials.common.reprint_status], accent: null },
            { k: '品薄度', v: SCARCITY_LABEL[card.materials.common.scarcity], accent: null },
            { k: 'イラスト', v: ARTWORK_LABEL[card.materials.collector.artwork_type], accent: 'collector' },
          ].map(({ k, v, accent }) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: '13px',
                padding: '10px 0',
                borderBottom: '1px solid var(--hair)',
              }}
            >
              <span style={{ color: 'var(--ink-faint)' }}>{k}</span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  color:
                    accent === 'player'
                      ? 'var(--up)'
                      : accent === 'collector'
                      ? 'var(--gold)'
                      : 'var(--ink)',
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {forecast.generated_at && (() => {
        // UTC → JST(+9h) に変換して日付表示
        const jst = new Date(new Date(forecast.generated_at).getTime() + 9 * 60 * 60 * 1000)
        const dateStr = jst.toISOString().slice(0, 10).replace(/-/g, '.')
        return (
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              color: 'var(--ink-faint)',
              letterSpacing: '0.04em',
              marginBottom: '14px',
            }}
          >
            予想生成 {dateStr}（JST）
          </div>
        )
      })()}

      <div className="disclaimer">{forecast.disclaimer}</div>
    </div>
  )
}
