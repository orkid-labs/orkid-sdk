import { createContext, useContext } from 'react'
import type { OrkidClient, OrkidResponse } from '@orkid-labs/sdk'
import type { Config as WagmiConfig } from 'wagmi'
import type { OrkidWidgetTheme, OrkidWidgetToken, OrkidWalletMode } from './types'

export interface OrkidSwapContextValue {
  client: OrkidClient
  wagmiConfig?: WagmiConfig
  walletMode: OrkidWalletMode
  theme: Required<OrkidWidgetTheme>
  logoUrl?: string
  brandName?: string
  showPoweredBy: boolean
  supportedChains: number[]
  defaultFromToken?: OrkidWidgetToken
  defaultToToken?: OrkidWidgetToken
  defaultAmount?: string
  defaultSlippageBps: number
  tokenList?: OrkidWidgetToken[]
  gasless: boolean
  partnerId?: string
  onQuote?: (res: OrkidResponse) => void
  onSolve?: (res: OrkidResponse) => void
  onError?: (error: string) => void
}

export const OrkidSwapContext = createContext<OrkidSwapContextValue | undefined>(undefined)

export function useOrkidSwapContext(): OrkidSwapContextValue {
  const ctx = useContext(OrkidSwapContext)
  if (!ctx) throw new Error('useOrkidSwapContext must be used within OrkidSwapProvider')
  return ctx
}
