'use client'

import type { ComponentProps } from 'react'

/** Keep the supplied affiliate URL intact on every device, including taps before hydration. */
export default function MercariLink({ href, target = '_blank', ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props} href={href} target={target} />
}