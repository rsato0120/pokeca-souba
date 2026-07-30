import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getBoxPriceHistory, getBoxPriceVariant, getPriceHistory, getPullRates } from '@/lib/data'
import { getSetProducts } from '@/lib/set-boxes'
import { computeBoxEv } from '@/lib/box-ev'
import BoxCardList from '@/components/BoxCardList'
import BoxSelector from '@/components/BoxSelector'
import BoxPricePanel from '@/components/BoxPricePanel'
import BoxExpectedValue from '@/components/BoxExpectedValue'
import SetPricePanel, { type SetRow } from '@/components/SetPricePanel'

// A8.net メルカリ素材ID（リンク・インプレッション計測タグ共通）
const A8_MERCARI_MAT = '4B60CK+3FU6LU+5LNQ+5YJRM'
// A8.net 楽天素材ID（楽天アフィリのhgcディープリンクにBOX別検索を差し込む）
const A8_RAKUTEN_MAT = '4B60CK+20MWKY+2HOM+6C1VM'
const A8_RAKUTEN_HGC = '0ea62065.34400275.0ea62066.204f04c0'
const A8_RAKUTEN_AID = 'a26062027360_4B60CK_20MWKY_2HOM_6C1VM'

// 楽天市場のBOX別検索ページに着地するA8計測リンクを生成
function buildRakutenA8Url(rakutenSearchUrl: string): string {
  const afl =
    `http://hb.afl.rakuten.co.jp/hgc/${A8_RAKUTEN_HGC}/${A8_RAKUTEN_AID}` +
    `?pc=${encodeURIComponent(rakutenSearchUrl)}&m=${encodeURIComponent(rakutenSearchUrl)}`
  return `https://rpx.a8.net/svt/ejp?a8mat=${A8_RAKUTEN_MAT}&rakuten=y&a8ejpredirect=${encodeURIComponent(afl)}`
}

export async function generateMetadata(props: PageProps<'/boxes/[boxId]'>): Promise<Metadata> {
  const { boxId } = await props.params
  const box = getAllBoxes().find((b) => b.box_id === boxId)
  if (!box) return {}
  const cardCount = getAllCards().filter((c) => c.box_id === boxId).length
  const title = `${box.box_name} カード一覧`
  const description = `${box.box_name}（${box.release_ym}発売）のポケモンカード相場一覧。${cardCount}枚掲載。AI予想による上昇確率ランキングつき。`
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  }
}

export function generateStaticParams() {
  return getAllBoxes().map((box) => ({ boxId: box.box_id }))
}

export default async function BoxPage(props: PageProps<'/boxes/[boxId]'>) {
  const { boxId } = await props.params
  const boxes = getAllBoxes()
  const box = boxes.find((b) => b.box_id === boxId)
  if (!box) notFound()

  const cards = getAllCards().filter((c) => c.box_id === boxId)
  const cardsWithForecast = cards.map((card) => ({
    card,
    forecast: getForecast(getCardSlug(card)),
  }))

  // BOX相場: シュリンクあり/なしの変異系列＋後方互換の混在系列。
  const boxPriceHistory = getBoxPriceHistory(boxId)
  const shrinkHist = getBoxPriceVariant(boxId, 'shrink')?.history ?? null
  const noshrinkHist = getBoxPriceVariant(boxId, 'noshrink')?.history ?? null
  const mixedHist = boxPriceHistory?.history ?? null
  const msrp = box.packs_per_box != null ? box.packs_per_box * box.pack_price_yen : null

  // セット商品（ポケセン等）: パックBOXではなくセット相場を地域ごとに出す
  const setProducts = getSetProducts(boxId)
  const setRows: SetRow[] | null = setProducts
    ? setProducts.map((p) => {
        const card = cards.find((c) => c.id === p.cardId)
        const latest = getBoxPriceVariant(boxId, p.setId)?.history?.[0] ?? null
        const dLow = latest ? (latest.low < latest.high ? latest.low : Math.round((latest.avg ?? latest.low) * 0.9)) : null
        const dHigh = latest ? (latest.low < latest.high ? latest.high : Math.round((latest.avg ?? latest.low) * 1.1)) : null
        return {
          setId: p.setId,
          label: p.label,
          cardSlug: p.cardId,
          cardName: card?.card_name ?? '',
          low: dLow,
          high: dHigh,
          onSale: latest?.on_sale ?? null,
          listPrice: p.listPrice,
        }
      })
    : null

  // 表示判定＆Xシェア用の代表値（シュリンクあり→なし→混在→セット先頭 の順）
  const repLatest = shrinkHist?.[0] ?? noshrinkHist?.[0] ?? mixedHist?.[0] ?? null
  const repLow = repLatest ? (repLatest.low < repLatest.high ? repLatest.low : Math.round((repLatest.avg ?? repLatest.low) * 0.9)) : null
  const repHigh = repLatest ? (repLatest.low < repLatest.high ? repLatest.high : Math.round((repLatest.avg ?? repLatest.low) * 1.1)) : null
  const repMid = repLatest ? Math.round((repLatest.low + repLatest.high) / 2) : null
  const repPremiumPct = msrp && repMid ? Math.round(((repMid - msrp) / msrp) * 100) : null
  const showBoxSection = !!(setRows || repLatest)

  // 価格変動ランキング（このBOX内）
  const mid = (r: { low: number; high: number }) => (r.low + r.high) / 2
  type CardChange = { card: typeof cards[number]; slug: string; currentMid: number; weekChange: number | null; dayChange: number | null }
  const cardChanges: CardChange[] = cards.map((card) => {
    const slug = getCardSlug(card)
    const history = getPriceHistory(slug)
    const records = history?.history ?? []
    const today = records[0]
    const yesterday = records[1]
    const weekAgo = records[7]
    return {
      card,
      slug,
      currentMid: today ? mid(today) : 0,
      dayChange: (() => { const v = today && yesterday ? ((mid(today) - mid(yesterday)) / mid(yesterday)) * 100 : null; return v !== null && Math.abs(v) > 20 ? null : v })(),
      weekChange: (() => { const v = today && weekAgo ? ((mid(today) - mid(weekAgo)) / mid(weekAgo)) * 100 : null; return v !== null && Math.abs(v) > 35 ? null : v })(),
    }
  }).filter(c => c.currentMid > 0)

  // 1BOX開封の期待値。開封目的の購入はシュリンクなしが基準になるのでそちらを優先する。
  const priceMap = new Map(cardChanges.map(c => [c.card.id, Math.round(c.currentMid)]))
  const evBoxLatest = noshrinkHist?.[0] ?? shrinkHist?.[0] ?? mixedHist?.[0] ?? null
  const evBoxPrice = evBoxLatest ? Math.round((evBoxLatest.low + evBoxLatest.high) / 2) : null
  const boxEv = computeBoxEv(getPullRates(boxId), cards, (c) => priceMap.get(c.id) ?? 0, evBoxPrice, msrp)

  const priceRanking = [...cardChanges].sort((a, b) => {
    const va = a.weekChange ?? a.dayChange ?? 0
    const vb = b.weekChange ?? b.dayChange ?? 0
    return vb - va
  }).slice(0, 8)

  return (
    <div className="wrap">
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

      {/* ── BOX切替（ドロップダウン選択） ── */}
      <BoxSelector
        current={boxId}
        marginTop={0}
        marginBottom={24}
        boxes={boxes
          .filter(b => b.certainty === 'released')
          .map(b => ({ box_id: b.box_id, box_name: b.box_name }))}
      />

      {/* ── 収録弾ヘッダ ── */}
      <div style={{ marginBottom: '28px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {box.pack_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={box.pack_image_url}
            alt={`${box.box_name} パックアート`}
            referrerPolicy="no-referrer"
            style={{
              width: '90px',
              height: 'auto',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.14em', marginBottom: '6px' }}>
            BOX · 収録弾
          </div>
          <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '28px', fontWeight: 800, marginBottom: '10px' }}>
            {box.box_name}
          </h1>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)' }}>
            <span>発売 {box.release_ym}</span>
            <span>{box.packs_per_box != null ? `パック ¥${box.pack_price_yen}` : `定価 ¥${box.pack_price_yen.toLocaleString()}`}</span>
            <span>{cards.length}枚収録（掲載中）</span>
          </div>
        </div>
      </div>

      {/* ── 未開封BOX相場 / セット相場 ── */}
      {showBoxSection && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--hair)',
            borderRadius: '10px',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          {setRows ? (
            <SetPricePanel rows={setRows} />
          ) : (
            <BoxPricePanel
              shrink={shrinkHist}
              noshrink={noshrinkHist}
              mixed={mixedHist}
              msrp={msrp}
              packsPerBox={box.packs_per_box}
              packPrice={box.pack_price_yen}
            />
          )}

          {/* 購入リンク */}
          {(() => {
            const q = encodeURIComponent(`${box.box_name} 未開封 BOX`)
            const surugayaSearch = `https://www.suruga-ya.jp/search?category=501080033&search_word=${q}`
            // メルカリはA8経由（a8ejpredirectでBOX別検索ページに着地）
            const mercariSearch = `https://jp.mercari.com/search?keyword=${q}&status=on_sale`
            const mercariUrl = `https://px.a8.net/svt/ejp?a8mat=${A8_MERCARI_MAT}&a8ejpredirect=${encodeURIComponent(mercariSearch)}`
            const rakutenUrl = buildRakutenA8Url(`https://search.rakuten.co.jp/search/mall/${q}/`)
            const shops = [
              { name: 'メルカリで探す', url: mercariUrl, color: '#FF0211', nofollow: true },
              { name: '楽天市場で探す', url: rakutenUrl, color: '#BF0000', nofollow: true },
              { name: '駿河屋で探す', url: `https://affiliate.suruga-ya.jp/modules/af/af_jump.php?user_id=5332&goods_url=${encodeURIComponent(surugayaSearch)}`, color: '#FF6600', nofollow: true },
            ]
            return (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--hair)', alignItems: 'center' }}>
                {shops.map(s => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel={s.nofollow ? 'nofollow noopener noreferrer' : 'noopener noreferrer'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      background: s.color,
                      color: '#fff',
                      fontFamily: 'var(--gothic)',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: 'none',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {s.name} →
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
              `【BOX相場】${box.box_name}`,
              repLatest ? `現在 ¥${repLow?.toLocaleString()}〜¥${repHigh?.toLocaleString()}${repPremiumPct != null ? `（定価比${repPremiumPct >= 0 ? `+${repPremiumPct}` : `${repPremiumPct}`}%）` : ''}` : '',
              boxEv && boxEv.ev > 0 && boxEv.recoveryPct != null
                ? `開封の期待値 ¥${boxEv.ev.toLocaleString()}以上（回収率${boxEv.recoveryPct}%）`
                : '',
              `#ポケカ #ポケカ相場`,
              `https://pokeca-souba.vercel.app/boxes/${boxId}`,
            ].filter(Boolean).join('\n')
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
                  letterSpacing: '0.03em', marginTop: '12px',
                }}
              >
                𝕏 でシェア
              </a>
            )
          })()}
        </div>
      )}

      {/* ── 1BOX開封の期待値 ── */}
      {boxEv && boxEv.ev > 0 && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--hair)',
            borderRadius: '10px',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          <BoxExpectedValue ev={boxEv} boxName={box.box_name} />
        </div>
      )}

      {/* ── 価格変動ランキング ── */}
      {priceRanking.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--hair)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--gold)', letterSpacing: '0.12em' }}>RANKING</span>
            <span style={{ fontFamily: 'var(--mincho)', fontSize: '17px', fontWeight: 700 }}>価格変動ランキング</span>
            <span className="section-sub" style={{ fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto' }}>7日間変化率順</span>
          </div>
          <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: '12px', padding: '7px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
              <span>#</span><span>カード</span>
              <span style={{ textAlign: 'right', minWidth: '56px' }}>前日比</span>
              <span style={{ textAlign: 'right', minWidth: '56px' }}>7日比</span>
            </div>
            {priceRanking.map(({ card, slug, currentMid, dayChange, weekChange }, i) => {
              const fmt = (v: number | null) => {
                if (v === null) return <span style={{ color: 'var(--ink-faint)' }}>—</span>
                const sign = v >= 0 ? '+' : ''
                const color = v > 1 ? 'var(--up)' : v < -1 ? 'var(--down)' : 'var(--ink-faint)'
                return <span style={{ color, fontWeight: 600 }}>{sign}{v.toFixed(1)}%</span>
              }
              return (
                <Link key={slug} href={`/cards/${slug}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: '12px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)', textAlign: 'center' }}>{i + 1}</div>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{card.card_name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginLeft: '6px' }}>{card.rarity} · ¥{Math.round(currentMid).toLocaleString()}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', textAlign: 'right', minWidth: '56px' }}>{fmt(dayChange)}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', textAlign: 'right', minWidth: '56px' }}>{fmt(weekChange)}</div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── カード一覧（レアリティタブつき） ── */}
      {cardsWithForecast.length === 0 ? (
        <div style={{ padding: '24px 16px', fontSize: '13px', color: 'var(--ink-faint)' }}>
          このセットのカードはまだ登録されていません。
        </div>
      ) : (
        <BoxCardList cardsWithForecast={cardsWithForecast} />
      )}

      <div className="disclaimer" style={{ marginTop: '32px' }}>
        本サイトのランキング・予想・相場レンジは AI が公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。
      </div>
    </div>
  )
}
