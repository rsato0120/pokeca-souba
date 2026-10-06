import type { CSSProperties } from 'react'
import bounds from '../../data/card-image-bounds.json'

type Props = { src: string; alt: string; className?: string; style?: CSSProperties;
  loading?: 'lazy' | 'eager'; decoding?: 'async' | 'sync' | 'auto'; referrerPolicy?: 'no-referrer' }
type Bounds = { width: number; height: number; left: number; top: number; contentWidth: number; contentHeight: number }

// 元画像の透明余白を表示枠から除き、カード本体を同じ大きさで表示する。
export default function CardImage({ src, alt, className, style, ...props }: Props) {
  const imageClass = ['card-image', className].filter(Boolean).join(' ')
  const crop = (bounds as Record<string, Bounds>)[src]
  if (!crop) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={imageClass} style={style} {...props} />
  }
  return <svg className={imageClass} role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
    viewBox={`${crop.left} ${crop.top} ${crop.contentWidth} ${crop.contentHeight}`}
    preserveAspectRatio="xMidYMid meet" style={{ display: 'block', flexShrink: 0, overflow: 'hidden', ...style }}>
    <image href={src} width={crop.width} height={crop.height} />
  </svg>
}
