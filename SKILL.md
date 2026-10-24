---
name: orkid-sdk
description: Integrate gasless MEV-protected crypto swaps into a TypeScript app or React frontend using @orkid-labs/sdk and @orkid-labs/widget — quote and execute token swaps on Base, Ethereum, Arbitrum, and Polygon via the Orkid DEX aggregation API, or embed the white-label React swap widget. Use when building a DeFi frontend, swap feature, trading bot backend, or wallet that needs swap execution without managing gas.
license: MIT
metadata:
  author: orkid-labs
  version: "0.3.2"
  npm: "@orkid-labs/sdk"
  widget: "@orkid-labs/widget"
  mcp-endpoint: https://orkidlabs.xyz/api/mcp
---

# Orkid SDK & Widget

`@orkid-labs/sdk` — TypeScript client for the Orkid gasless swap API
(quote → execute flow, Permit2 signing helpers, CLI).
`@orkid-labs/widget` — white-label React swap widget embedding the same
engine.

## Install

```bash
npm install @orkid-labs/sdk      # TS client + CLI
npm install @orkid-labs/widget   # React widget
```

## SDK flow

```typescript
import { OrkidClient } from "@orkid-labs/sdk"

const client = new OrkidClient({
  apiKey: process.env.ORKID_API_KEY,           // free at orkidlabs.xyz/partner
  baseUrl: "https://orkidlabs.xyz",            // or "sandbox" mode
})

const quote = await client.quote({
  from: "USDC", to: "WETH", amount: "25", chain: "base",
})
// quote.swapUrl → hand to user to sign, or drive execute() with
// the user's signer for non-custodial execution
```

Swaps execute gasless via Permit2: the solver pays gas, the user signs a
message. Routes aggregate Tycho pool liquidity + RFQ market makers with
MEV protection.

## Widget

Drop-in React component wrapping the same engine — white-label styling
hooks; check `orkid-widget/` for props.

## MCP alternative

For agents that speak MCP rather than TypeScript, the same engine is
exposed at `https://orkidlabs.xyz/api/mcp` (`orkid_quote`,
`orkid_bridge_quote`, `orkid_swap_link`, `orkid_chains`) — x402
pay-per-call, no key needed, or `npx -y orkid-swap-mcp` for stdio.

## Links

- npm: `@orkid-labs/sdk`, `@orkid-labs/widget`
- Site: https://orkidlabs.xyz
- Docs: https://docs.orkidlabs.xyz
- Official MCP Registry: `xyz.orkidlabs/orkid-swap`
