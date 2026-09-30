import type { OnePieceProduct } from '@/types/onepiece'
import PackImage from './PackImage'
export default function OnePieceImage({ product, className }: { product: OnePieceProduct; className: string }) {
 return <span className={className + ' onepiece-image'}>{product.image_url ? <PackImage src={product.image_url} alt={product.name} /> : product.card_no ?? 'BOX'}</span>
}
