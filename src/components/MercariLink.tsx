'use client'

import { useSyncExternalStore, type ComponentProps } from 'react'
import { mercariDirectUrl } from '@/lib/bargains'

const subscribe = () => () => {}
const serverSnapshot = () => false
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Use a native, direct HTTPS link on mobile so the OS can open Mercari. */
export default function MercariLink({ href, target = '_blank', onClick, ...props }: ComponentProps<'a'> & { href: string }) {
  const mobile = useSyncExternalStore(subscribe, isMobile, serverSnapshot)
  const direct = mercariDirectUrl(href)
  return <a {...props} href={mobile && direct ? direct : href} target={mobile && direct ? '_self' : target}
    onClick={event => {
      onClick?.(event)
      // Also handle a tap before the effect runs, without replacing native navigation.
      if (!event.defaultPrevented && direct && isMobile()) {
        event.currentTarget.href = direct
        event.currentTarget.target = '_self'
      }
    }} />
}
