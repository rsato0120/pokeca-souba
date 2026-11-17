'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { chartImage } from '@/lib/chart-image'

export default function XChartShare({ text, title, fileName = 'souba-chart' }: { text: string; title: string; fileName?: string }) {
  const headingId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [preview, setPreview] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState(false)
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function prepare() {
    dialog.current?.showModal()
    setBusy(true); setError(''); setFile(null); setPreview('')
    try {
      const blob = await chartImage(title)
      setFile(new File([blob], `${fileName}.png`, { type: 'image/png' }))
      setPreview(URL.createObjectURL(blob))
    } catch (e) { setError(e instanceof Error ? e.message : '画像を作成できませんでした。') }
    finally { setBusy(false) }
  }

  async function share() {
    if (!file) return
    setSharing(true); setError('')
    try { await navigator.share({ files: [file], text }) }
    catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('共有できませんでした。「画像を保存」から添付してください。')
    } finally { setSharing(false) }
  }
  const canShare = file && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })
  return <>
    <button type="button" className="x-chart-share-trigger" onClick={prepare}>𝕏 でシェア</button>
    <dialog ref={dialog} className="x-chart-share-dialog" aria-labelledby={headingId}>
      <div className="x-chart-share-head"><h2 id={headingId}>グラフを添えてシェア</h2><button type="button" aria-label="閉じる" onClick={() => dialog.current?.close()}>×</button></div>
      <p>表示中のグラフを画像にします。期間・素体／PSA10は、閉じてグラフ側で切り替えられます。</p>
      {busy && <p role="status">画像を作成中…</p>}
      {preview && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={`${title}の共有用グラフ`} className="x-chart-share-preview" />
        {canShare ? <><button type="button" disabled={sharing} onClick={share}>画像と文章を共有</button><p>共有先でXを選んでください。対応するアプリは端末によって異なります。</p></> : <p>画像を保存し、Xの投稿画面で添付してください。</p>}
        <a href={preview} download={file?.name}>画像を保存（PNG）</a>
      </>}
      {error && <p role="alert">{error}</p>}
      <a href={intent} target="_blank" rel="noopener noreferrer">Xの投稿画面を開く（文章のみ）</a>
      <p>投稿内容を確認してから、ご自身で投稿してください。</p>
    </dialog>
  </>
}
