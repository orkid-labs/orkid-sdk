import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { OrkidWidgetTheme } from './types'

export interface OrkidSwapIframeProps {
  /** Base URL of the hosted widget page, e.g. https://widget.orkidlabs.xyz */
  src?: string
  /** Partner identifier */
  partner?: string
  /** Brand name to show */
  brandName?: string
  /** Logo URL */
  logoUrl?: string
  /** Theme overrides */
  theme?: OrkidWidgetTheme
  /** Default input token */
  fromToken?: string
  /** Default output token */
  toToken?: string
  /** Default amount */
  amount?: string
  /** Whether to show "Powered by Orkid" */
  showPoweredBy?: boolean
  /** Allow iframe to go fullscreen */
  allowFullScreen?: boolean
  /** Additional class name */
  className?: string
  /** Additional style */
  style?: CSSProperties
}

export function OrkidSwapIframe({
  src = 'https://widget.orkidlabs.xyz',
  partner,
  brandName,
  logoUrl,
  theme,
  fromToken,
  toToken,
  amount,
  showPoweredBy,
  allowFullScreen,
  className,
  style,
}: OrkidSwapIframeProps) {
  const url = useMemo(() => {
    const u = new URL(src)
    if (partner) u.searchParams.set('partner', partner)
    if (brandName) u.searchParams.set('brand', brandName)
    if (logoUrl) u.searchParams.set('logo', logoUrl)
    if (theme) u.searchParams.set('theme', encodeURIComponent(JSON.stringify(theme)))
    if (fromToken) u.searchParams.set('from', fromToken)
    if (toToken) u.searchParams.set('to', toToken)
    if (amount) u.searchParams.set('amount', amount)
    if (showPoweredBy !== undefined) u.searchParams.set('poweredBy', String(showPoweredBy))
    return u.toString()
  }, [src, partner, brandName, logoUrl, theme, fromToken, toToken, amount, showPoweredBy])

  return (
    <iframe
      src={url}
      className={className}
      style={{ width: '100%', height: '100%', minHeight: '560px', border: 'none', ...style }}
      allowFullScreen={allowFullScreen}
      title="Orkid Swap"
    />
  )
}
