import type { Config as WagmiConfig } from 'wagmi'
import type { OrkidResponse } from '@orkid-labs/sdk'

export interface OrkidWidgetToken {
  address: string
  symbol: string
  decimals: number
  chain: string
}

export interface OrkidWidgetTheme {
  background?: string
  card?: string
  cardForeground?: string
  primary?: string
  primaryForeground?: string
  text?: string
  muted?: string
  mutedForeground?: string
  border?: string
  success?: string
  warning?: string
  danger?: string
  radius?: string
  fontFamily?: string
  accent?: string
  accentForeground?: string
  popover?: string
  popoverForeground?: string
  input?: string
  ring?: string
}

export type OrkidWalletMode = 'built-in' | 'external'

export interface OrkidSwapProviderProps {
  /** Orkid API key. Required for direct Orkid API mode. */
  apiKey?: string
  /** API base URL. Defaults to https://orkidlabs.xyz. Use a partner proxy in production. */
  apiBaseUrl?: string
  /** Partner identifier. Used for analytics, config lookup, and iframe mode. */
  partnerId?: string
  /** Wallet connection mode. */
  walletMode?: OrkidWalletMode
  /** WalletConnect project ID for built-in wallet mode. */
  walletConnectProjectId?: string
  /** External wagmi config. Required when walletMode is 'external'. */
  wagmiConfig?: WagmiConfig
  /** Theme overrides. */
  theme?: OrkidWidgetTheme
  /** Partner logo URL. */
  logoUrl?: string
  /** Partner brand name shown in the widget. */
  brandName?: string
  /** Show "Powered by Orkid" footer. */
  showPoweredBy?: boolean
  /** Chain IDs to show. Defaults to [8453, 1, 42161, 137]. Non-live chains are disabled. */
  supportedChains?: number[]
  /** Default token to sell. */
  defaultFromToken?: OrkidWidgetToken
  /** Default token to buy. */
  defaultToToken?: OrkidWidgetToken
  /** Default input amount. */
  defaultAmount?: string
  /** Default slippage in basis points. */
  defaultSlippageBps?: number
  /** Restrict token list. If omitted, tokens are fetched from the API. */
  tokenList?: OrkidWidgetToken[]
  /** Enable gasless solve. If false, the widget will always fall back to user-pays-gas. */
  gasless?: boolean
  /** Called when a quote is returned. */
  onQuote?: (res: OrkidResponse) => void
  /** Called when a solve succeeds (gasless or user-pays). */
  onSolve?: (res: OrkidResponse) => void
  /** Called on errors. */
  onError?: (error: string) => void
  children: React.ReactNode
}

export interface OrkidSwapWidgetProps {
  /** Additional CSS class on the widget root. */
  className?: string
}
