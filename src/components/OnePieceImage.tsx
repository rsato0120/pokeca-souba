import type { OnePieceProduct } from '@/types/onepiece'
export default function OnePieceImage({ product, className }: { product: OnePieceProduct; className: string }) {
  return <span className={`${className} onepiece-image`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {product.image_url ? <img src={product.image_url} alt="" loading="lazy" style={{ transform: `scale(${product.image_scale ?? 1})` }} /> : product.card_no ?? 'BOX'}
  </span>
}
