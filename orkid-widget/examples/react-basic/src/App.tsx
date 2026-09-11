import { OrkidSwapProvider, OrkidSwapWidget } from '@orkid/widget'
import type { OrkidWidgetToken } from '@orkid/widget'

const API_KEY = import.meta.env.VITE_ORKID_API_KEY || ''
const API_BASE_URL =
  (typeof window !== 'undefined' ? window.location.origin : undefined) ||
  import.meta.env.VITE_ORKID_API_BASE_URL ||
  'https://orkidlabs.xyz'

function getParam(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  return params.get(name) || undefined
}

function getThemeParam(): Record<string, string> | undefined {
  const raw = getParam('theme')
  if (!raw) return undefined
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    return undefined
  }
}

function tokenFromParam(name: string): OrkidWidgetToken | undefined {
  const raw = getParam(name)
  if (!raw) return undefined
  try {
    const [address, symbol, decimals] = raw.split(':')
    return {
      address,
      symbol,
      decimals: Number(decimals || 18),
      chain: 'base',
    }
  } catch {
    return undefined
  }
}

function App() {
  const partnerId = getParam('partner')
  const brandName = getParam('brand')
  const logoUrl = getParam('logo')
  const theme = getThemeParam()
  const showPoweredBy = getParam('poweredBy') !== 'false'
  const fromToken = tokenFromParam('from')
  const toToken = tokenFromParam('to')
  const amount = getParam('amount')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f8fafc' }}>
      <OrkidSwapProvider
        apiKey={API_KEY}
        apiBaseUrl={API_BASE_URL}
        partnerId={partnerId}
        walletMode="built-in"
        walletConnectProjectId={import.meta.env.VITE_WC_PROJECT_ID || undefined}
        brandName={brandName}
        logoUrl={logoUrl}
        theme={theme}
        showPoweredBy={showPoweredBy}
        defaultFromToken={fromToken || {
          address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          symbol: 'USDC',
          decimals: 6,
          chain: 'base',
        }}
        defaultToToken={toToken || {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'WETH',
          decimals: 18,
          chain: 'base',
        }}
        defaultAmount={amount || '25'}
      >
        <OrkidSwapWidget />
      </OrkidSwapProvider>
    </div>
  )
}

export default App
