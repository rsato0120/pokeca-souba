import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllCards, getCardBySlug, getBoxById, getForecast, getPriceHistory, getCardSlug } from '@/lib/data'
import type { Forecast } from '@/types/pokeca'
import PriceHistoryChart from '@/components/PriceHistoryChart'
import PriceForecastChart from '@/components/PriceForecastChart'

// A8.net メルカリ素材ID（リンク・インプレッション計測タグ共通）
const A8_MERCARI_MAT = '4B60CK+3FU6LU+5LNQ+5YJRM'
// A8.net 楽天素材ID（楽天アフィリのhgcディープリンクにカード別検索を差し込む）
const A8_RAKUTEN_MAT = '4B60CK+20MWKY+2HOM+6C1VM'
const A8_RAKUTEN_HGC = '0ea62065.34400275.0ea62066.204f04c0'
const A8_RAKUTEN_AID = 'a26062027360_4B60CK_20MWKY_2HOM_6C1VM'

// 楽天市場のカード別検索ページに着地するA8計測リンクを生成
function buildRakutenA8Url(rakutenSearchUrl: string): string {
  const afl =
    `http://hb.afl.rakuten.co.jp/hgc/${A8_RAKUTEN_HGC}/${A8_RAKUTEN_AID}` +
    `?pc=${encodeURIComponent(rakutenSearchUrl)}&m=${encodeURIComponent(rakutenSearchUrl)}`
  return `https://rpx.a8.net/svt/ejp?a8mat=${A8_RAKUTEN_MAT}&rakuten=y&a8ejpredirect=${encodeURIComponent(afl)}`
}

export async function generateMetadata(props: PageProps<'/cards/[cardId]'>): Promise<Metadata> {
  const { cardId } = await props.params
  const card = getCardBySlug(cardId)
  if (!card) return {}
  const forecast = getForecast(cardId)
  const box = getBoxById(card.box_id)
  const upPct = forecast?.overall.up_pct
  const low = forecast?.price_forecast.current_low
  const high = forecast?.price_forecast.current_high
  const priceStr = low && high ? `現在相場 ¥${low.toLocaleString()}〜¥${high.toLocaleString()}。` : ''
  const upStr = upPct !== undefined ? `上昇期待 ${upPct}%。` : ''
  const title = `${card.card_name} ${card.rarity} の相場予想`
  const description = `${card.card_name} ${card.rarity}（${box?.box_name ?? card.box_id}）のポケモンカード相場予想。${priceStr}${upStr}AI分析による根拠つき予想。`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: card.image_url ? [{ url: card.image_url, width: 600, height: 837 }] : [],
    },
    twitter: { card: 'summary_large_image', title, description, images: card.image_url ? [card.image_url] : [] },
  }
}

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
      m1_low: 2500,
      m1_high: 3500,
      m3_low: 2700,
      m3_high: 3800,
      m6_low: 2800,
      m6_high: 4000,
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
  const priceHistory = getPriceHistory(card.id)

  const { overall, player_view, collector_view, price_forecast } = forecast

  const signal =
    overall.up_pct >= 45
      ? { label: '買い', dot: '🟢', color: 'var(--up)' }
      : overall.down_pct >= 45
      ? { label: '値下がり注意', dot: '🔴', color: 'var(--down)' }
      : { label: '様子見', dot: '🟡', color: 'var(--flat)' }

  const latestRecord = priceHistory?.history?.[0] ?? null
  const latestAvg = latestRecord?.avg ?? null
  const latestOnSale = latestRecord?.on_sale ?? null
  // 今日のスニダン取得が失敗(null)でも、履歴の直近の既知PSA10を表示する（チャートと整合）
  const latestPsa10Record = priceHistory?.history?.find(r => r.psa10 != null) ?? null
  const latestPsa10 = latestPsa10Record?.psa10 ?? null
  const latestPsa10Date = latestPsa10Record?.date ?? null

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
        className="card-detail-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '210px 1fr',
          gap: '30px',
          alignItems: 'start',
          marginBottom: '24px',
        }}
      >
        {/* カード枠 */}
        <div className="card-detail-col-card">
          <div className="pokecard" style={{ padding: card.image_url ? '0' : undefined, overflow: 'hidden' }}>
            {card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image_url}
                alt={`${card.card_name} ${card.rarity}`}
                referrerPolicy="no-referrer"
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
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '5px 16px',
                borderRadius: '20px',
                background: `color-mix(in srgb, ${signal.color} 15%, transparent)`,
                color: signal.color,
                fontFamily: 'var(--mono)',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              {signal.dot} {signal.label}
            </span>
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
            FORECAST · 今後 6ヶ月
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

          {/* AI評価ヒーロー */}
          <div
            style={{
              border: '1px solid var(--hair)',
              borderLeft: `3px solid ${signal.color}`,
              borderRadius: '8px',
              padding: '16px 18px',
              marginBottom: '12px',
              background: 'var(--panel)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                color: 'var(--ink-faint)',
                marginBottom: '10px',
              }}
            >
              AI 評価
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--mincho)',
                  fontSize: '32px',
                  fontWeight: 800,
                  color: signal.color,
                  letterSpacing: '0.02em',
                  lineHeight: 1,
                }}
              >
                {signal.dot}&thinsp;{signal.label}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '2px' }}>
                  上昇期待度
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '26px',
                    fontWeight: 700,
                    color: signal.color,
                    lineHeight: 1,
                  }}
                >
                  {overall.up_pct}%
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid var(--hair)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--ink-faint)',
                  marginBottom: '6px',
                }}
              >
                予想価格（本線）
              </div>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'var(--ink-faint)', fontWeight: 400 }}>現在</span>
                  <span style={{ color: 'var(--ink-dim)' }}>
                    ¥{price_forecast.current_low.toLocaleString()}〜{price_forecast.current_high.toLocaleString()}
                  </span>
                </span>
                <span style={{ color: 'var(--ink-faint)' }}>→</span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'var(--ink-faint)', fontWeight: 400 }}>3ヶ月後</span>
                  <span style={{ color: signal.color }}>
                    ¥{price_forecast.m3_low.toLocaleString()}〜{price_forecast.m3_high.toLocaleString()}
                  </span>
                </span>
                <span style={{ color: 'var(--ink-faint)' }}>→</span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: 'var(--ink-faint)', fontWeight: 400 }}>6ヶ月後</span>
                  <span style={{ color: signal.color }}>
                    ¥{price_forecast.m6_low.toLocaleString()}〜{price_forecast.m6_high.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* 市場価格 */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--hair)',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.06em', marginBottom: '10px' }}>
              MARKET · 市場価格
            </div>
            <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '2px' }}>メルカリ 取引平均</div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '26px', fontWeight: 700, color: 'var(--gold)' }}>
                  {latestAvg != null ? `¥${latestAvg.toLocaleString()}` : '—'}
                </span>
              </div>
              {latestPsa10 != null && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '2px' }}>
                    PSA 10（スニーカーダンク 平均）
                    {latestPsa10Date && latestRecord && latestPsa10Date !== latestRecord.date && (
                      <span style={{ color: 'var(--ink-faint)' }}>（{latestPsa10Date.slice(5).replace('-', '/')}時点）</span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '26px', fontWeight: 700, color: '#6c8ebf' }}>
                    ¥{latestPsa10.toLocaleString()}
                  </span>
                </div>
              )}
              {latestOnSale != null && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginBottom: '2px' }}>メルカリ 出品中</div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: 600, color: 'var(--ink-dim)' }}>
                    {latestOnSale}件
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 購入リンク */}
          {(() => {
            const q = encodeURIComponent(`${card.card_name} ${card.rarity} ${box?.box_name ?? ''}`)
            const surugayaSearch = `https://www.suruga-ya.jp/search?category=501080033&search_word=${q}`
            // メルカリはA8経由（a8ejpredirectでカード別検索ページに着地させつつクリック/インプレッションを計測）
            const mercariSearch = `https://jp.mercari.com/search?keyword=${q}&status=on_sale`
            const mercariUrl = `https://px.a8.net/svt/ejp?a8mat=${A8_MERCARI_MAT}&a8ejpredirect=${encodeURIComponent(mercariSearch)}`
            const rakutenUrl = buildRakutenA8Url(`https://search.rakuten.co.jp/search/mall/${q}/`)
            const shops = [
              { name: 'メルカリ', url: mercariUrl, color: '#FF0211', nofollow: true },
              { name: '楽天市場', url: rakutenUrl, color: '#BF0000', nofollow: true },
              { name: '駿河屋', url: `https://affiliate.suruga-ya.jp/modules/af/af_jump.php?user_id=5332&goods_url=${encodeURIComponent(surugayaSearch)}`, color: '#FF6600', nofollow: true },
            ]
            return (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px', alignItems: 'center' }}>
                {shops.map(s => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel={s.nofollow ? 'nofollow noopener noreferrer' : 'noopener noreferrer'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '5px 14px', borderRadius: '20px',
                      border: `1px solid ${s.color}`,
                      color: s.color, fontSize: '12px', fontFamily: 'var(--mono)',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {s.name}で探す →
                  </a>
                ))}
                {/* A8インプレッション計測タグ（メルカリ・楽天） */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www14.a8.net/0.gif?a8mat=${A8_MERCARI_MAT}`}
                  width={1}
                  height={1}
                  alt=""
                  style={{ position: 'absolute', width: 1, height: 1, border: 0 }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www13.a8.net/0.gif?a8mat=${A8_RAKUTEN_MAT}`}
                  width={1}
                  height={1}
                  alt=""
                  style={{ position: 'absolute', width: 1, height: 1, border: 0 }}
                />
              </div>
            )
          })()}

          {/* Xシェアボタン */}
          {(() => {
            const tweetText = [
              `【AI相場予想】${card.card_name} ${card.rarity}（${box?.box_name ?? card.box_id}）`,
              `現在 ¥${price_forecast.current_low.toLocaleString()}〜¥${price_forecast.current_high.toLocaleString()}`,
              `${signal.dot} ${signal.label} 上昇期待${overall.up_pct}%`,
              `#ポケカ相場 #ポケカMEGA`,
              `https://pokeca-souba.vercel.app/cards/${cardId}`,
            ].join('\n')
            return (
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 16px', borderRadius: '20px',
                  border: '1px solid #aaa',
                  color: 'var(--ink-dim)', fontSize: '12px', fontFamily: 'var(--mono)',
                  letterSpacing: '0.03em', marginBottom: '6px',
                }}
              >
                𝕏 でシェア
              </a>
            )
          })()}
        </div>
      </div>

      {/* ── 価格推移＋AI予想（素体/PSA10タブ） ── */}
      {priceHistory && priceHistory.history.length > 0 && (
        <div style={{ marginBottom: '26px' }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              color: 'var(--ink-faint)',
              marginBottom: '12px',
            }}
          >
            PRICE &amp; AI FORECAST · 価格推移とAI予想
          </div>
          <PriceForecastChart history={priceHistory.history} forecast={price_forecast} />
        </div>
      )}

      {/* ── 過去価格推移グラフ（詳細） ── */}
      {priceHistory && priceHistory.history.length > 0 && (
        <div style={{ marginBottom: '26px' }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              color: 'var(--ink-faint)',
              marginBottom: '12px',
            }}
          >
            PRICE HISTORY · 価格推移（詳細）
          </div>
          <PriceHistoryChart history={priceHistory.history} />
        </div>
      )}

      {/* ── 総合シナリオ ── */}
      <div style={{ fontSize: '12px', color: 'var(--ink-faint)', letterSpacing: '0.06em', marginBottom: '9px' }}>
        総合シナリオ（今後 6ヶ月）
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

      <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: '18px' }}>
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
