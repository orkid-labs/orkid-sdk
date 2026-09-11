# @orkid-labs/widget

White-label React swap widget for the Orkid gasless swap API. Supports Base, Ethereum, Arbitrum, and Polygon.

## Features

- Drop-in React component (`<OrkidSwapWidget />`).
- Iframe embed (`<OrkidSwapIframe />`) and script embed (`mountOrkidSwap`).
- Built-in wallet (MetaMask / injected) with optional WalletConnect.
- External `wagmi` config mode for host apps already using wagmi.
- Configurable API endpoint — direct Orkid, sandbox, or partner proxy.
- Full theming via CSS custom properties and a `theme` prop.
- All four chains live: Base, Ethereum, Arbitrum, Polygon.
- Gasless execution with user-pays-gas fallback.
- Sandbox support via `SANDBOX_BASE_URL`.

## Install

```bash
npm install @orkid-labs/widget @orkid-labs/sdk wagmi viem @tanstack/react-query
```

`wagmi`, `viem`, `@tanstack/react-query`, and `@orkid-labs/sdk` are peer dependencies.

## Quick start

```tsx
import { OrkidSwapProvider, OrkidSwapWidget } from '@orkid-labs/widget'

function App() {
  return (
    <OrkidSwapProvider
      apiKey={process.env.NEXT_PUBLIC_ORKID_API_KEY}
      partnerId="alternate-futures"
      brandName="Alternate Futures"
      showPoweredBy={false}
      walletMode="built-in"
      defaultFromToken={{
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        symbol: 'USDC',
        decimals: 6,
        chain: 'base',
      }}
      defaultToToken={{
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        decimals: 18,
        chain: 'base',
      }}
    >
      <OrkidSwapWidget />
    </OrkidSwapProvider>
  )
}
```

## Sandbox mode

To point the widget at the sandbox (dry-run only, never submits):

```tsx
import { OrkidSwapProvider, OrkidSwapWidget } from '@orkid-labs/widget'
import { SANDBOX_BASE_URL } from '@orkid-labs/sdk'

function App() {
  return (
    <OrkidSwapProvider
      apiKey={process.env.ORKID_SANDBOX_KEY}
      apiBaseUrl={SANDBOX_BASE_URL}
    >
      <OrkidSwapWidget />
    </OrkidSwapProvider>
  )
}
```

## Iframe embed

```tsx
import { OrkidSwapIframe } from '@orkid-labs/widget'

<OrkidSwapIframe
  src="https://widget.orkidlabs.xyz"
  partner="alternate-futures"
  brandName="Alternate Futures"
  theme={{ primary: '#0052FF' }}
  fromToken="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:USDC:6"
  toToken="0x4200000000000000000000000000000000000006:WETH:18"
  amount="25"
  showPoweredBy={false}
/>
```

The hosted page reads the query parameters and forwards them to `OrkidSwapProvider`.

## Script embed

```html
<script type="module">
  import { mountOrkidSwap } from 'https://cdn.orkidlabs.xyz/widget.js'
  mountOrkidSwap({
    target: '#swap-widget',
    partnerId: 'alternate-futures',
    apiBaseUrl: 'https://partner.com',
  })
</script>
```

## External wagmi config

If your app already sets up `wagmi`, pass the `wagmiConfig` and set `walletMode="external"`:

```tsx
import { OrkidSwapProvider, OrkidSwapWidget } from '@orkid-labs/widget'
import { wagmiConfig } from './wagmi'

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OrkidSwapProvider walletMode="external" wagmiConfig={wagmiConfig} apiKey="...">
          <OrkidSwapWidget />
        </OrkidSwapProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

## Proxy mode

To avoid exposing an Orkid API key in the browser, set `apiBaseUrl` to your own backend and omit `apiKey`. Your backend must forward the request with the `X-ORKID-API-Key` header.

```tsx
<OrkidSwapProvider apiBaseUrl="https://partner.com" apiKey={undefined}>
  <OrkidSwapWidget />
</OrkidSwapProvider>
```

## Theming

Pass a `theme` object or override CSS variables:

```tsx
<OrkidSwapProvider
  theme={{
    primary: '#0052FF',
    background: '#ffffff',
    card: '#f8fafc',
    radius: '0.75rem',
  }}
>
  <OrkidSwapWidget />
</OrkidSwapProvider>
```

Available CSS variables: `--orkid-widget-bg`, `--orkid-widget-card`, `--orkid-widget-primary`, `--orkid-widget-text`, etc. See `src/styles.css`.

## Props

### OrkidSwapProvider

| Prop | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `undefined` | Orkid API key. Optional in proxy mode. |
| `apiBaseUrl` | `string` | `https://orkidlabs.xyz` | API base URL. Use `SANDBOX_BASE_URL` for sandbox. |
| `partnerId` | `string` | `undefined` | Partner identifier. |
| `walletMode` | `'built-in' \| 'external'` | `'built-in'` | Wallet connection mode. |
| `walletConnectProjectId` | `string` | `undefined` | WalletConnect project ID. |
| `wagmiConfig` | `Config` | `undefined` | External wagmi config. |
| `theme` | `OrkidWidgetTheme` | `defaultLightTheme` | Theme overrides. |
| `logoUrl` | `string` | `undefined` | Partner logo URL. |
| `brandName` | `string` | `'Swap'` | Brand name. |
| `showPoweredBy` | `boolean` | `true` | Show "Powered by Orkid" footer. |
| `supportedChains` | `number[]` | `[8453, 1, 42161, 137]` | Chain IDs to show. |
| `defaultFromToken` | `OrkidWidgetToken` | `undefined` | Default input token. |
| `defaultToToken` | `OrkidWidgetToken` | `undefined` | Default output token. |
| `defaultAmount` | `string` | `undefined` | Default input amount. |
| `defaultSlippageBps` | `number` | `50` | Default slippage in basis points. |
| `tokenList` | `OrkidWidgetToken[]` | `undefined` | Restrict token list. |
| `gasless` | `boolean` | `true` | Try gasless solve first. |
| `onQuote` | `(res) => void` | `undefined` | Quote callback. |
| `onSolve` | `(res) => void` | `undefined` | Solve success callback. |
| `onError` | `(err) => void` | `undefined` | Error callback. |

### OrkidSwapWidget

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | `undefined` | Additional class on the widget root. |

## Chain support

| Chain | ID | Status |
|---|---|---|
| Base | 8453 | Live |
| Ethereum | 1 | Live |
| Arbitrum | 42161 | Live |
| Polygon | 137 | Live |

## Development

```bash
cd orkid-widget
npm install
npm run typecheck
npm run build
```

## License

MIT
