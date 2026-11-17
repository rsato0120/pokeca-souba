// Export the currently displayed Recharts SVG, including resolved theme colors.
export async function chartImage(title: string): Promise<Blob> {
  const panel = document.querySelector<HTMLElement>('[data-share-chart]')
  const svg = panel?.querySelector<SVGSVGElement>('svg.recharts-surface')
  if (!panel || !svg) throw new Error('画像にできるグラフがありません。グラフを表示してからお試しください。')
  const copy = svg.cloneNode(true) as SVGSVGElement
  const originals = [svg, ...svg.querySelectorAll('*')]
  const copies = [copy, ...copy.querySelectorAll('*')]
  for (let i = 0; i < originals.length; i++) {
    const style = getComputedStyle(originals[i])
    for (const key of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline']) {
      copies[i].setAttribute(key, style.getPropertyValue(key))
    }
    // Use a system font in the standalone SVG instead of page-only web fonts.
    copies[i].setAttribute('font-family', 'sans-serif')
    copies[i].removeAttribute('style')
  }
  copy.querySelectorAll('.recharts-tooltip-cursor, .recharts-active-dot').forEach(node => node.remove())
  const rect = svg.getBoundingClientRect()
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(rect.width))
  copy.setAttribute('height', String(rect.height))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    const chartHeight = Math.round(rect.height * 1080 / rect.width)
    canvas.height = chartHeight + 330
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('このブラウザーでは画像を作成できません。')
    ctx.fillStyle = getComputedStyle(panel).backgroundColor
    // Chart panels define their background explicitly for both light and dark themes.
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = getComputedStyle(panel).color
    const write = (text: string, y: number, size: number) => {
      ctx.font = `${size}px sans-serif`
      let line = '', lineNo = 0
      for (const character of text) {
        if (ctx.measureText(line + character).width > 1080) {
          ctx.fillText(line, 60, y + lineNo * (size + 8))
          line = ''; lineNo++
        }
        line += character
      }
      ctx.fillText(line, 60, y + lineNo * (size + 8))
    }
    write(title.slice(0, 70), 55, 30)
    write(panel.dataset.shareChart ?? '', 145, 24)
    ctx.drawImage(image, 60, 185, 1080, chartHeight)
    write(panel.dataset.shareLegend ?? '', chartHeight + 225, 20)
    write('相場 SOUBA · pokeca-souba.vercel.app · 予想は将来の価格を保証しません', chartHeight + 295, 17)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画像の作成に失敗しました。')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}
