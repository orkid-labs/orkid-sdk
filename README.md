# Orkid SDK

TypeScript SDK and React widget for the [Orkid](https://orkidlabs.xyz) gasless swap API.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`orkid-sdk`](./orkid-sdk) | `@orkid-labs/sdk` | TypeScript client, Permit2 signing helpers, CLI |
| [`orkid-widget`](./orkid-widget) | `@orkid-labs/widget` | White-label React swap widget |

## Quick start

```bash
npm install @orkid-labs/sdk
```

```typescript
import { OrkidClient } from "@orkid-labs/sdk"

const client = new OrkidClient({ apiKey: process.env.ORKID_API_KEY! })
const quote = await client.getQuote({ from: "USDC", to: "WETH", amount: "25", chain: "base" })
```

## Documentation

- [API docs](https://docs.orkidlabs.xyz)
- [Quick start](https://docs.orkidlabs.xyz/quickstart)
- [SDK reference](https://docs.orkidlabs.xyz/sdk)
- [Embed guide](https://docs.orkidlabs.xyz/embed)

## Supported chains

Base, Ethereum, Arbitrum, Polygon

## License

MIT
