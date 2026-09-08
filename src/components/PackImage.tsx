import bounds from '../../data/pack-image-bounds.json'

// 同じ表示枠に「余白を除いた商品本体」を収める。元画像は変更しない。
export default function PackImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const crop = (bounds as Record<string, {width: number; height: number; left: number; top: number; contentWidth: number; contentHeight: number}>)[src]
  if (!crop) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} style={{ objectFit: 'contain' }} referrerPolicy="no-referrer" />
  }
  return <svg className={className} role="img" aria-label={alt}
    viewBox={`${crop.left} ${crop.top} ${crop.contentWidth} ${crop.contentHeight}`}
    preserveAspectRatio="xMidYMid meet" style={{ overflow: 'hidden', display: 'block', flexShrink: 0 }}>
    <image href={src} width={crop.width} height={crop.height} />
  </svg>
}
