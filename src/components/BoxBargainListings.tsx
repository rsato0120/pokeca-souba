import Link from 'next/link'
import { buildBoxDeals, type BoxMarketListings } from '@/lib/box-bargains'
import { getAllBoxes, getBoxPriceVariant } from '@/lib/data'
import { VARIANT_LABEL } from '@/lib/box-variant'
import { mercariAffiliateUrl, MERCARI_A8_IMPRESSION_URL } from '@/lib/bargains'

export default function BoxBargainListings({ data }: { data: BoxMarketListings | null }) {
  const rows = buildBoxDeals(data, getAllBoxes(), (id, variant) => getBoxPriceVariant(id, variant)?.history[0]).slice(0, 5)
  return (
    <section className="home-panel home-bargain-panel" aria-labelledby="box-deals-heading">
      <div className="home-panel-head">
        <div><span>BOX DEALS · PR</span><h2 id="box-deals-heading">BOXの相場より安い出品</h2></div>
      </div>
      <p className="box-deals-note">同じシュリンク状態の1BOX相場と比較。5％以上・500円以上安い出品を掲載しています。</p>
      {rows.length === 0 ? <p className="home-empty">条件を満たすBOXの出品は現在ありません。出品情報は定期的に更新しています。</p> : (
        <div className="home-bargain-grid">
          {rows.map(({ box, variant, listing, marketPrice, savings, discountPct, fetchedAt }) => (
            <article key={listing.id} className="home-bargain-card box-deal-card">
              <Link className="box-deal-name" href={`/boxes/${box.box_id}`}>{box.box_name} →</Link>
              <a href={mercariAffiliateUrl(listing.url)} target="_blank" rel="sponsored nofollow noreferrer" aria-label={`${box.box_name} ${VARIANT_LABEL[variant]}の出品をメルカリで見る`}>
                <span className="home-bargain-info">
                  {listing.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 出品画像を表示
                    <img src={listing.image_url} alt="" loading="lazy" />
                  ) : <span className="home-bargain-image-ph">BOX</span>}
                  <span><strong>{VARIANT_LABEL[variant]} · 1BOX</strong><small>相場 ¥{marketPrice.toLocaleString()}</small><b>¥{listing.price.toLocaleString()}</b></span>
                </span>
                <p className="box-deal-title">{listing.title}</p>
                <div className="home-bargain-foot"><span>{discountPct.toFixed(1)}%安い <small>−¥{savings.toLocaleString()}</small></span><strong>メルカリで見る →</strong></div>
              </a>
              <small className="box-deal-time">取得 {new Date(fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</small>
            </article>
          ))}
        </div>
      )}
      {rows.length > 0 && <>
        <p className="box-deals-note">取得時点の価格です。売り切れ・価格変更の場合があります。送料・内容・状態は出品ページでご確認ください。</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MERCARI_A8_IMPRESSION_URL} width={1} height={1} alt="" />
      </>}
    </section>
  )
}
