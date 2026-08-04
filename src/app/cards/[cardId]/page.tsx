import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllCards, getCardBySlug, getBoxById, getForecast, getPriceHistory, getPriceExtremes, getCardSlug } from '@/lib/data'
import { extremeHitToday } from '@/lib/extremes'
import type { Forecast } from '@/types/pokeca'
import PriceHistoryChart from '@/components/PriceHistoryChart'
import PriceForecastChart from '@/components/PriceForecastChart'
import CardCollectionControl from '@/components/CardCollectionControl'
import CardSentiment from '@/components/CardSentiment'
import SinceLastVisitBadge from '@/components/SinceLastVisitBadge'
import OripaBanner from '@/components/OripaBanner'
import KaitoriLink from '@/components/KaitoriLink'
import CountUp from '@/components/CountUp'
import ThemeToggle from '@/components/ThemeToggle'

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
  const upStr = upPct !== undefined ? `上昇確率 ${upPct}%。` : ''
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
  // 予想が未生成のカードはスタブで骨組みだけ描く。スタブの price_forecast は
  // ダミー値（¥2,500〜¥3,500）なので、**金額は絶対に表示しない**（実勢と誤読されるため）。
  const realForecast = getForecast(card.id)
  const isStub = realForecast == null
  const forecast: Forecast = realForecast ?? stubForecast(card.card_no, card.rarity)
  const priceHistory = getPriceHistory(card.id)

  const { overall, collector_view, price_forecast } = forecast

  const signal =
    overall.up_pct >= 45
      ? { label: '買い', dot: '🟢', color: 'var(--up)' }
      : overall.down_pct >= 45
      ? { label: '値下がり注意', dot: '🔴', color: 'var(--down)' }
      : { label: '様子見', dot: '🟡', color: 'var(--flat)' }

  const latestRecord = priceHistory?.history?.[0] ?? null
  const latestAvg = latestRecord?.avg ?? null
  const latestOnSale = latestRecord?.on_sale ?? null
  // avg の出所はカードごとに異なる（取引件数でスニダン/メルカリを切替）。
  // source を持たない旧レコードは断定せず中立ラベルにする。
  const avgSource = latestRecord?.source ?? null
  const avgSourceLabel =
    avgSource === 'snkrdunk' ? 'スニーカーダンク 素体平均'
    : avgSource === 'mercari' ? 'メルカリ 取引平均'
    : '取引平均'
  const avgSampleCount = latestRecord?.sample_count ?? null
  const latestDate = latestRecord?.date ?? null
  // 今日のスニダン取得が失敗(null)でも、履歴の直近の既知PSA10を表示する（チャートと整合）
  const latestPsa10Record = priceHistory?.history?.find(r => r.psa10 != null) ?? null
  const latestPsa10 = latestPsa10Record?.psa10 ?? null
  const latestPsa10Date = latestPsa10Record?.date ?? null

  // 全期間の高値・安値（履歴は90日で消えるので data/price-extremes.json から）
  const extremes = getPriceExtremes(card.id)
  const extremeHit = extremeHitToday(extremes, latestDate ?? undefined)
  const mdOf = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

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
        <ThemeToggle />
      </header>

      <div className="searchbar" style={{ marginBottom: '30px' }}>
        <input type="text" placeholder="カード名で検索" defaultValue={card.card_name} />
        <button>予想する</button>
      </div>

      {/* この端末に前回訪問の記録があれば「あなたが前回見た時からいくら動いたか」を出す。
          スナップショットの基準はトップと同じ履歴の代表値（(low+high)/2）にすること */}
      <SinceLastVisitBadge
        cardId={card.id}
        mid={latestRecord ? (Number(latestRecord.low) + Number(latestRecord.high)) / 2 : 0}
      />

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
          {/* holo = 触ると光沢が斜めに走る。ポケカの実物の質感に寄せた演出（CSSのみ） */}
          <div className="pokecard holo" style={{ padding: card.image_url ? '0' : undefined, overflow: 'hidden' }}>
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
                {/* up_pct は「上昇シナリオの確率」であって上昇率ではない。
                    隣に予想価格が並ぶため、単位を明示しないと値上がり率と誤読される。 */}
                <div className="stat-label">6ヶ月以内に上昇する確率</div>
                <div className="stat-value" style={{ color: signal.color }}>
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
                {isStub ? (
                  <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: '13px' }}>
                    このカードはまだ相場データを取得できていません（毎日自動で再取得しています）。
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
            {/* 予想の当たり外れを自分で確認できる導線（信頼性の担保） */}
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <Link href="/accuracy" className="pill">
                この予想はどれくらい当たっている？ →
              </Link>
            </div>
          </div>

          {/* 市場価格 */}
          <div className="panel" style={{ background: 'var(--bg2)', marginBottom: 'var(--sp-4)' }}>
            <div className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>MARKET · 市場価格</div>
            <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <div className="stat-label">{avgSourceLabel}</div>
                <span className="stat-value" style={{ color: 'var(--gold)' }}>
                  {latestAvg != null ? <CountUp value={latestAvg} prefix="¥" /> : '—'}
                </span>
              </div>
              {latestPsa10 != null && (
                <div>
                  <div className="stat-label">
                    PSA 10（スニーカーダンク 平均）
                    {latestPsa10Date && latestRecord && latestPsa10Date !== latestRecord.date && (
                      <span>（{latestPsa10Date.slice(5).replace('-', '/')}時点）</span>
                    )}
                  </div>
                  <span className="stat-value" style={{ color: '#6c8ebf' }}>
                    <CountUp value={latestPsa10} prefix="¥" />
                  </span>
                </div>
              )}
              {latestOnSale != null && (
                <div>
                  <div className="stat-label">メルカリ 出品中</div>
                  <span className="stat-value" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--ink-dim)' }}>
                    {latestOnSale}件
                  </span>
                </div>
              )}
            </div>
            {/* データの出所と鮮度を明示（信頼性の担保） */}
            <div className="source-note">
              {latestDate && <>{latestDate.replace(/-/g, '/')} 時点</>}
              {avgSource === 'snkrdunk' && (
                <> ・ 素体価格はスニーカーダンクの実取引{avgSampleCount != null ? `${avgSampleCount}件` : ''}の平均</>
              )}
              {avgSource === 'mercari' && <> ・ 素体価格はメルカリ成約の20〜80パーセンタイル平均</>}
              {avgSource == null && <> ・ 素体価格はメルカリ成約またはスニーカーダンク実取引の平均</>}
              {' '}・ 毎日自動更新
            </div>
          </div>

          {/* コレクション登録（素体＋PSA10） */}
          <CardCollectionControl cardId={cardId} hasPsa10={latestPsa10 != null} />

          {/* 購入リンク */}
          {(() => {
            const q = encodeURIComponent(`${card.card_name} ${card.rarity} ${box?.box_name ?? ''}`)
            const surugayaSearch = `https://www.suruga-ya.jp/search?category=501080033&search_word=${q}`
            // メルカリはA8経由（a8ejpredirectでカード別検索ページに着地させつつクリック/インプレッションを計測）
            const mercariSearch = `https://jp.mercari.com/search?keyword=${q}&status=on_sale`
            const mercariUrl = `https://px.a8.net/svt/ejp?a8mat=${A8_MERCARI_MAT}&a8ejpredirect=${encodeURIComponent(mercariSearch)}`
            const rakutenUrl = buildRakutenA8Url(`https://search.rakuten.co.jp/search/mall/${q}/`)
            const shops = [
              { name: 'メルカリ', url: mercariUrl, color: 'var(--shop-mercari)', nofollow: true },
              { name: '楽天市場', url: rakutenUrl, color: 'var(--shop-rakuten)', nofollow: true },
              { name: '駿河屋', url: `https://affiliate.suruga-ya.jp/modules/af/af_jump.php?user_id=5332&goods_url=${encodeURIComponent(surugayaSearch)}`, color: 'var(--shop-surugaya)', nofollow: true },
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

          {/* 買取導線（A8 / PR）。上の「探す」＝買う側に対して売る側の受け皿 */}
          <KaitoriLink marginY={10} />

          {/* オリパ案件バナー（A8 / PR） */}
          <OripaBanner marginY={10} />

          {/* Xシェアボタン */}
          {(() => {
            const tweetText = [
              `【AI相場予想】${card.card_name} ${card.rarity}（${box?.box_name ?? card.box_id}）`,
              // スタブ時はダミー価格をツイートに載せない
              isStub ? '相場データ取得中' : `現在 ¥${price_forecast.current_low.toLocaleString()}〜¥${price_forecast.current_high.toLocaleString()}`,
              `${signal.dot} ${signal.label} 上昇確率${overall.up_pct}%`,
              `#ポケカ #ポケカ相場`,
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

          {/* 全期間の高値・安値。当日更新なら見出しにバッジを出す */}
          {extremes && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '12px',
                color: 'var(--ink-dim)',
                marginBottom: '10px',
              }}
            >
              <span>
                最高 <strong style={{ color: 'var(--up)' }}>¥{extremes.high.value.toLocaleString()}</strong>
                <span style={{ color: 'var(--ink-faint)' }}>（{mdOf(extremes.high.date)}）</span>
              </span>
              <span style={{ color: 'var(--hair)' }}>|</span>
              <span>
                最安 <strong style={{ color: 'var(--down)' }}>¥{extremes.low.value.toLocaleString()}</strong>
                <span style={{ color: 'var(--ink-faint)' }}>（{mdOf(extremes.low.date)}）</span>
              </span>
              {extremeHit && (
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    color: 'var(--on-accent)',
                    background: extremeHit === 'high' ? 'var(--up)' : 'var(--down)',
                  }}
                >
                  {extremeHit === 'high' ? '🔺 本日 最高値更新' : '🔻 本日 最安値更新'}
                </span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>
                （{mdOf(extremes.since)}以降の計測）
              </span>
            </div>
          )}

          <PriceHistoryChart
            history={priceHistory.history}
            extremes={extremes ? { high: extremes.high.value, low: extremes.low.value } : null}
          />
        </div>
      )}

      {/* ── 総合シナリオ ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--sp-2)',
          flexWrap: 'wrap',
          fontSize: 'var(--fs-sm)',
          color: 'var(--ink-faint)',
          letterSpacing: '0.06em',
          marginBottom: 'var(--sp-2)',
        }}
      >
        <span>総合シナリオ（今後 6ヶ月）</span>
        <span style={{ fontSize: 'var(--fs-xs)' }}>上昇・横ばい・下落それぞれの確率</span>
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
        ].map(({ pct, bg, label }, i) => (
          <div
            key={label}
            // 左から伸びる。3本を少しずつ遅らせると「積み上がっていく」ように見える
            className="anim-grow"
            style={{
              animationDelay: `${i * 0.09}s`,
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

      {/* ── みんなの予想（投票・Supabase） ── */}
      <CardSentiment cardId={cardId} ai={{ up: overall.up_pct, flat: overall.flat_pct, down: overall.down_pct }} />

      {/* ── コレクター需要（観賞・保有価値） ── */}
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--hair)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontFamily: 'var(--mincho)', fontSize: '16px', fontWeight: 700 }}>
            コレクター需要
          </span>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: TREND_COLOR[collector_view.trend],
            }}
          >
            {TREND_LABEL[collector_view.trend]}
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
          観賞・保有価値
        </div>
        <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.7 }}>
          {collector_view.reason}
        </p>
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
            { k: 'イラストレーター', v: card.materials.collector.illustrator, accent: 'collector' },
            { k: '絵師人気', v: ILLUST_POP_LABEL[card.materials.collector.illustrator_popularity], accent: 'collector' },
            { k: 'キャラ人気', v: CHAR_POP_LABEL[card.materials.common.character_popularity], accent: 'collector' },
            { k: 'イラスト', v: ARTWORK_LABEL[card.materials.collector.artwork_type], accent: 'collector' },
            { k: '品薄度', v: SCARCITY_LABEL[card.materials.common.scarcity], accent: null },
            { k: '再録状況', v: REPRINT_LABEL[card.materials.common.reprint_status], accent: null },
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
                  color: accent === 'collector' ? 'var(--gold)' : 'var(--ink)',
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
