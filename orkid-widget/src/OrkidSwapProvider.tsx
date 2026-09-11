import { useMemo } from 'react'
import { WagmiProvider, createConfig, http, type Config } from 'wagmi'
import { base, mainnet, arbitrum, polygon } from 'wagmi/chains'
import type { Chain } from 'viem'
import { injected, walletConnect } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrkidClient } from '@orkid-labs/sdk'
import { OrkidSwapContext, type OrkidSwapContextValue } from './context'
import { resolveTheme } from './theme'
import type { OrkidSwapProviderProps } from './types'

const DEFAULT_API_BASE_URL = 'https://orkidlabs.xyz'

const queryClient = new QueryClient()

export function OrkidSwapProvider({
  apiKey = '',
  apiBaseUrl = DEFAULT_API_BASE_URL,
  partnerId,
  walletMode = 'built-in',
  walletConnectProjectId,
  wagmiConfig,
  theme,
  logoUrl,
  brandName,
  showPoweredBy = true,
  supportedChains = [8453, 1, 42161, 137],
  defaultFromToken,
  defaultToToken,
  defaultAmount,
  defaultSlippageBps = 50,
  tokenList,
  gasless = true,
  onQuote,
  onSolve,
  onError,
  children,
}: OrkidSwapProviderProps) {
  const client = useMemo(
    () => new OrkidClient({ apiKey, baseUrl: apiBaseUrl }),
    [apiKey, apiBaseUrl]
  )

  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme])

  const resolvedWagmiConfig = useMemo((): Config | undefined => {
    if (walletMode === 'external') return wagmiConfig
    if (walletMode !== 'built-in') return undefined

    const chainsToUse: Chain[] = [base]
    if (supportedChains.includes(1)) chainsToUse.push(mainnet)
    if (supportedChains.includes(42161)) chainsToUse.push(arbitrum)
    if (supportedChains.includes(137)) chainsToUse.push(polygon)

    const connectors: any[] = [injected({ shimDisconnect: true })]
    if (walletConnectProjectId) {
      connectors.push(
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: brandName || 'Orkid Swap',
            description: 'Gasless token swaps — competitive, no gas',
            url: 'https://orkidlabs.xyz',
            icons: logoUrl ? [logoUrl] : [],
          },
        })
      )
    }

    return createConfig({
      chains: chainsToUse as [Chain, ...Chain[]],
      connectors,
      transports: {
        [base.id]: http('https://rpc.orkidlabs.com/rpc/base'),
        [mainnet.id]: http('https://rpc.orkidlabs.com/rpc/ethereum'),
        [arbitrum.id]: http('https://rpc.orkidlabs.com/rpc/arbitrum'),
        [polygon.id]: http('https://rpc.orkidlabs.com/rpc/polygon'),
      },
    })
  }, [walletMode, wagmiConfig, supportedChains, walletConnectProjectId, brandName, logoUrl])

  const value: OrkidSwapContextValue = {
    client,
    wagmiConfig: resolvedWagmiConfig,
    walletMode,
    theme: resolvedTheme,
    logoUrl,
    brandName,
    showPoweredBy,
    supportedChains,
    defaultFromToken,
    defaultToToken,
    defaultAmount,
    defaultSlippageBps,
    tokenList,
    gasless,
    partnerId,
    onQuote,
    onSolve,
    onError,
  }

  const content = (
    <OrkidSwapContext.Provider value={value}>{children}</OrkidSwapContext.Provider>
  )

  if (walletMode === 'built-in' && resolvedWagmiConfig) {
    return (
      <WagmiProvider config={resolvedWagmiConfig}>
        <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
      </WagmiProvider>
    )
  }

  return content
}
