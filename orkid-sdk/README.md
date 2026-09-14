# Orkid Swap API — Integration Kit

This kit contains everything an external integrator needs to swap through the Orkid solver using the two public API endpoints:

- `POST /api/v1/route` — get an executable quote
- `POST /api/v1/solve` — sign a Permit2 message and execute gaslessly

It includes a TypeScript SDK, request/response types, signing helpers for **viem** and **ethers**, copy-paste examples, an OpenAPI spec, and a step-by-step integration guide.

---

## Table of Contents

1. [What Orkid gives an integrator](#what-orkid-gives-an-integrator)
2. [Supported chains](#supported-chains)
3. [Environments: production vs sandbox](#environments-production-vs-sandbox)
4. [API key & rate limits](#api-key--rate-limits)
5. [High-level flow](#high-level-flow)
6. [Endpoint 1: /api/v1/route](#endpoint-1-apiv1route)
7. [Endpoint 2: /api/v1/solve](#endpoint-2-apiv1solve)
8. [Permit2 signing walkthrough](#permit2-signing-walkthrough)
9. [Error & retry guide](#error--retry-guide)
10. [SDK reference](#sdk-reference)
11. [CLI](#cli)
12. [Reporting endpoints](#reporting-endpoints)
13. [Examples](#examples)
14. [OpenAPI](#openapi)

---

## What Orkid gives an integrator

- **Same-chain, gasless swaps** on Base, Ethereum, Arbitrum, and Polygon.
- **Competitive Orkid fee (contact us for pricing)** taken from the input token.
- **Bundled / gasless execution** — the Orkid solver submits the transaction and pays the gas.
- **MEV-aware routing** using Tycho's live pool graph and simulation. On Ethereum, transactions are broadcast through Flashbots Protect (private mempool) to protect against sandwich attacks.
- **Per-account volume & rebate tracking** in the Orkid board admin.
- **Non-custodial** — the solver uses Permit2 to pull the input token and the net output goes straight to the user.
- **Sandbox environment** — a dedicated dry-run endpoint you can hammer without touching real flows.

---

## Supported chains

| Chain | ID | Status | TVMExecutor (spender) | Min notional |
| --- | --- | --- | --- | --- |
| Base | 8453 | **Live** | `0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289` | $20 |
| Ethereum | 1 | **Live** | `0xCfc33b521190FcD414c8f81f479749c4dCE8f69b` | $200 |
| Arbitrum | 42161 | **Live** | `0xf57235609bf99fb0b017e95b3bc33a606a541374` | $50 |
| Polygon | 137 | **Live** | `0xd633Ea84E6E2Db002C14C6fe3A064eE2cc4E258c` | $50 |

All four chains use the canonical Permit2 contract: `0x000000000022D473030F116dDEE9F6B43aC78BA3`.

The `spender` field in your signed Permit2 message must match the TVMExecutor address for the target chain. The SDK handles this automatically — see [Permit2 signing walkthrough](#permit2-signing-walkthrough) for manual integrations.

---

## Environments: production vs sandbox

Orkid provides two environments. Both use the same API paths (`/api/v1/route`, `/api/v1/solve`, etc.) — the **base URL** determines which environment you hit.

| Environment | Base URL | Solve behavior | Volume tracked |
| --- | --- | --- | --- |
| **Production** | `https://orkidlabs.xyz` | Real execution (submits on-chain tx) | Yes — counts toward rebates |
| **Sandbox** | `https://sandbox.orkidlabs.com` | **Dry-run only** (never submits) | No — sandbox traffic is isolated |

### Sandbox

The sandbox is a dedicated environment for integration testing. It:

- Forwards `/api/v1/route` to the **real solvers** — you get authentic quotes, routing, and latency.
- Forces `/api/v1/solve` to `dryRun: true` **regardless of what you send** — the solver encodes and validates the transaction but never submits it.
- Uses **separate API keys** from production.
- Does **not** record usage or rebate volume.
- Has its own rate limit (300 req/min for the pilot key).

This means you can hammer the sandbox with thousands of test requests, try different token pairs and amounts, validate your Permit2 signing flow end-to-end, and never risk a real on-chain transaction or pollute your production volume accounting.

### Getting a sandbox key

Contact Orkid for a sandbox API key. Sandbox keys are 40-character hex strings, separate from production keys:

```text
X-ORKID-API-Key: <sandbox-key>
```

### Using the sandbox with the SDK

```typescript
import { OrkidClient, SANDBOX_BASE_URL } from '@orkid-labs/sdk'

const sandbox = new OrkidClient({
  apiKey: process.env.ORKID_SANDBOX_KEY!,
  baseUrl: SANDBOX_BASE_URL, // https://sandbox.orkidlabs.com
})

// Real quote from the real solver
const quote = await sandbox.getQuote({
  from: 'USDC',
  to: 'WETH',
  amount: '25.0',
  chain: 'base',
})

// Dry-run solve — encodes and validates but never submits
const result = await sandbox.solve({
  from: 'USDC',
  to: 'WETH',
  amount: '25.0',
  chain: 'base',
  user: '0x...',
  fromAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  fromDecimals: 6,
  toAddress: '0x4200000000000000000000000000000000000006',
  toDecimals: 18,
  dryRun: false, // ignored — sandbox always forces dryRun: true
  permit: signed.permit,
  signature: signed.signature,
})
// result.transaction.to / .data are real calldata
// result.transaction.txHash is absent (never submitted)
```

### Using the sandbox with curl

```bash
# Health check (no auth required)
curl https://sandbox.orkidlabs.com/health

# Route (real quote)
curl -X POST https://sandbox.orkidlabs.com/api/v1/route \
  -H "X-ORKID-API-Key: <sandbox-key>" \
  -H "Content-Type: application/json" \
  -d '{"from":"USDC","to":"WETH","amount":"25.0","chain":"base","fromAddress":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","fromDecimals":6,"toAddress":"0x4200000000000000000000000000000000000006","toDecimals":18}'

# Solve (always dry-run — never submits)
curl -X POST https://sandbox.orkidlabs.com/api/v1/solve \
  -H "X-ORKID-API-Key: <sandbox-key>" \
  -H "Content-Type: application/json" \
  -d '{"from":"USDC","to":"WETH","amount":"25.0","chain":"base","user":"0x...","fromAddress":"0x...","fromDecimals":6,"toAddress":"0x...","toDecimals":18,"dryRun":false,"permit":{...},"signature":"0x..."}'
```

### Sandbox safety guarantees

- **No on-chain execution**: the sandbox proxy intercepts every `/api/v1/solve` and forces `dryRun: true` before forwarding to the solver. Even if you send `dryRun: false`, the sandbox ignores it.
- **No production volume**: sandbox requests do not call the production usage-tracking or rebate-recording endpoints.
- **Separate keys**: sandbox API keys are distinct from production keys. A production key will not work on the sandbox and vice versa.
- **Real routing**: `/api/v1/route` hits the actual per-chain solvers, so quotes reflect live pool state and real latency.

---

## API key & rate limits

Every programmatic request must include:

```text
X-ORKID-API-Key: <40-char-hex-key>
```

API keys are 40-character hex strings. Only a SHA-256 hash is stored on Orkid's side, so the plaintext key is shown once when it is created.

To get a key, contact api@orkidlabs.com or schedule a call at orkidlabs.xyz/contact. We will create your partner account and issue a key with the appropriate tier, rate limit, and rebate terms. Keys are provisioned by Orkid — they are not self-serve.

Default rate limits:

| Environment | Tier | Requests / minute |
| --- | --- | --- |
| Production | free | 60 |
| Production | pro | 120 |
| Production | enterprise | 1000 |
| Sandbox | pilot | 300 |

---

## High-level flow

1. **Get a quote** (`/api/v1/route`)
2. **Approve the input token to Permit2** (one-time per token)
3. **Find an unused Permit2 nonce** by reading the nonce bitmap on-chain
4. **Sign a Permit2 `PermitTransferFrom` message** with the TVMExecutor as `spender`
5. **Call `/api/v1/solve`** with `dryRun: false` to submit gaslessly
6. Optionally fall back to `dryRun: true` and have the user send the transaction themselves if the solver cannot subsidize gas

> **Sandbox tip:** Steps 1-5 work identically in the sandbox. Step 5 always behaves as `dryRun: true` — you get back encoded calldata but no transaction is submitted. This is the perfect way to validate your signing flow before going live.

---

## Endpoint 1: `/api/v1/route`

### Request

```json
POST https://orkidlabs.xyz/api/v1/route
Content-Type: application/json
X-ORKID-API-Key: <key>

{
  "from": "USDC",
  "to": "WETH",
  "amount": "25.0",
  "chain": "base",
  "fromAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "fromDecimals": 6,
  "toAddress": "0x4200000000000000000000000000000000000006",
  "toDecimals": 18
}
```

`from` and `to` can be token symbols (e.g. `USDC`, `WETH`). Explicit `*_address` + `*_decimals` is recommended because symbol resolution is server-side and may not cover every token.

`chain` accepts: `base`, `ethereum`, `arbitrum`, `polygon`.

### Response

```json
{
  "ok": true,
  "quote": {
    "amountIn": "25.000000",
    "amountOut": "0.010184",
    "amountOutRaw": "10183963710975259",
    "volumeUsd": 25,
    "rate": "0.000407 WETH/USDC",
    "protocol": "aerodrome_slipstreams",
    "poolAddress": "0xc758d81b9b81a6fcdad075bd471874a2c46b54e0",
    "priceImpactBps": 9.66
  },
  "gaslessEligible": true,
  "computeMs": 142
}
```

### Error response

```json
{
  "ok": false,
  "error": "Swap too small for gasless execution: $5.00 below $20 minimum on base.",
  "gaslessEligible": false,
  "computeMs": 45
}
```

---

## Endpoint 2: `/api/v1/solve`

### Request Shape

```json
POST https://orkidlabs.xyz/api/v1/solve
Content-Type: application/json
X-ORKID-API-Key: <key>

{
  "from": "USDC",
  "to": "WETH",
  "amount": "25.0",
  "chain": "base",
  "user": "0x...",
  "fromAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "fromDecimals": 6,
  "toAddress": "0x4200000000000000000000000000000000000006",
  "toDecimals": 18,
  "dryRun": false,
  "slippageBps": 5,
  "permit": {
    "permitted": {
      "token": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "amount": "25000000"
    },
    "nonce": "123...",
    "deadline": "1725561600"
  },
  "signature": "0x..."
}
```

### Success response

```json
{
  "ok": true,
  "quote": {
    "amountIn": "25.000000",
    "amountOut": "0.010184",
    "amountOutRaw": "10183963710975259",
    "volumeUsd": 25,
    "rate": "0.000407 WETH/USDC",
    "protocol": "aerodrome_slipstreams",
    "poolAddress": "0xc758d81b9b81a6fcdad075bd471874a2c46b54e0",
    "priceImpactBps": 9.66
  },
  "transaction": {
    "txHash": "0x...",
    "to": "0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289",
    "data": "0x...",
    "value": "0",
    "chain": "base"
  },
  "computeMs": 142
}
```

### `dryRun: true` response

When `dryRun` is `true`, the solver does **not** submit the transaction. It returns the same `transaction` object minus `txHash`. The integrator can then ask the user to send the transaction themselves:

```json
{
  "ok": true,
  "transaction": {
    "to": "0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289",
    "data": "0x...",
    "value": "0",
    "chain": "base"
  }
}
```

> **In the sandbox**, `/api/v1/solve` always returns this dry-run shape regardless of the `dryRun` value you send.

---

## Permit2 signing walkthrough

Permit2 lets a user approve a token transfer with an off-chain signature. The `PermitTransferFrom` signature authorizes a specific `spender` (the TVMExecutor) to pull an exact amount of a specific token before a deadline, using a specific one-time nonce.

### Step 1 — Approve the token to Permit2 (one-time)

Before the first swap of each token, the user must call:

```solidity
IERC20(token).approve(PERMIT2, type(uint256).max)
```

### Step 2 — Get the correct TVMExecutor address

The `spender` in the signed permit must match the TVMExecutor on the target chain:

| Chain | TVMExecutor |
| --- | --- |
| Base | `0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289` |
| Ethereum | `0xCfc33b521190FcD414c8f81f479749c4dCE8f69b` |
| Arbitrum | `0xf57235609bf99fb0b017e95b3bc33a606a541374` |
| Polygon | `0xd633Ea84E6E2Db002C14C6fe3A064eE2cc4E258c` |

### Step 3 — Find an unused nonce

Permit2 stores a nonce bitmap for each user. If you reuse a nonce, the transaction reverts.

The nonce layout is:

```text
wordPos = uint248(nonce >> 8)
bitPos  = uint8(nonce)
```

Read `nonceBitmap(owner, wordPos)` from the Permit2 contract until you find a word with an unset bit, then construct `(wordPos << 8) | bitPos`.

### Step 4 — Sign the Permit2 typed data

Domain:

```json
{
  "name": "Permit2",
  "chainId": 8453,
  "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
}
```

Types:

```json
{
  "PermitTransferFrom": [
    { "name": "permitted", "type": "TokenPermissions" },
    { "name": "spender", "type": "address" },
    { "name": "nonce", "type": "uint256" },
    { "name": "deadline", "type": "uint256" }
  ],
  "TokenPermissions": [
    { "name": "token", "type": "address" },
    { "name": "amount", "type": "uint256" }
  ]
}
```

Message:

```json
{
  "permitted": {
    "token": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "amount": "25000000"
  },
  "spender": "0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289",
  "nonce": "123456...",
  "deadline": "1725561600"
}
```

The `spender` must be in the signed message but is **not** included in the JSON `permit` object sent to `/solve`.

### Step 5 — Call `/api/v1/solve`

Send the `permit` (without `spender`) and the 65-byte hex `signature`.

---

## Error & retry guide

| HTTP / `ok` | Likely cause | Recommended action |
| --- | --- | --- |
| `400` / `ok:false` | Invalid request shape | Fix the JSON, check `fromDecimals`, `toDecimals`, `chain` |
| `401` / `Invalid or revoked API key` | Bad/missing key or rate limit | Check `X-ORKID-API-Key` header, request a key rotation |
| `403` / `Missing anti-scraping token` | Browser request without page token | Use an API key instead |
| `200` / `error: "Swap too small..."` | Below gasless minimum | Increase amount or set `dryRun: true` and have user pay gas |
| `200` / `error: "Gas estimation failed"` | Permit/signature/calldata will revert | Check token approval, nonce, spender, chain, token addresses, balance |
| `200` / `error: "Invalid nonce"` | Nonce already used | Call `findUnusedNonce` again |
| `200` / `error: "TRANSFER_FROM_FAILED"` | Insufficient allowance or balance | Check `token.approve(PERMIT2, ...)` and `balanceOf` |
| `200` / `error: "Price impact too high..."` | Slippage exceeds max (500 bps) | Try a smaller amount or a different token pair |

### Retry rules

- Retry `5xx` up to 3 times with exponential backoff.
- Do not blindly retry a successful `/solve` (`ok: true`) — it may have already submitted.
- For `dryRun: false`, if the solver returns `ok: true` with `transaction.txHash`, the swap is submitted.
- For `dryRun: true`, cache the returned `data` and submit it with `sendTransaction` only once.
- In the sandbox, retries are safe — no transaction is ever submitted.

---

## SDK reference

### Install

```bash
npm install @orkid-labs/sdk
# or copy the source files into your project
```

Peer dependencies (only needed for signing):

```bash
npm install viem
# or
npm install ethers
```

### Quick start — production

```typescript
import { OrkidClient } from '@orkid-labs/sdk'
import { OrkidViemPermitSigner } from '@orkid-labs/sdk/viem'
import { createWalletClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const client = new OrkidClient({
  apiKey: process.env.ORKID_API_KEY!,
  // baseUrl defaults to https://orkidlabs.xyz
})

const account = privateKeyToAccount('0x...')
const walletClient = createWalletClient({ account, chain: base, transport: http() })

const permitSigner = new OrkidViemPermitSigner(walletClient)

async function swapUsdcToWeth() {
  const quote = await client.getQuote({
    from: 'USDC',
    to: 'WETH',
    amount: '25.0',
    chain: 'base',
  })

  if (!quote.ok) throw new Error(quote.error)

  const signed = await permitSigner.prepareAndSign({
    fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    fromDecimals: 6,
    amount: '25.0',
    chain: 'base',
  })

  const result = await client.solve({
    from: 'USDC',
    to: 'WETH',
    amount: '25.0',
    chain: 'base',
    user: account.address,
    fromAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    fromDecimals: 6,
    toAddress: '0x4200000000000000000000000000000000000006',
    toDecimals: 18,
    dryRun: false,
    permit: signed.permit,
    signature: signed.signature,
  })

  if (!result.ok) throw new Error(result.error)
  console.log('txHash', result.transaction?.txHash)
}
```

### Quick start — sandbox

```typescript
import { OrkidClient, SANDBOX_BASE_URL } from '@orkid-labs/sdk'

const sandbox = new OrkidClient({
  apiKey: process.env.ORKID_SANDBOX_KEY!,
  baseUrl: SANDBOX_BASE_URL, // https://sandbox.orkidlabs.com
})

// Same API surface — quotes are real, solves are always dry-run
const quote = await sandbox.getQuote({
  from: 'USDC',
  to: 'WETH',
  amount: '25.0',
  chain: 'arbitrum',
})
```

### Exports

| Export | Description |
| --- | --- |
| `OrkidClient` | Main API client — `getQuote`, `solve`, `confirmTransaction`, `getAccount`, `getUsage`, `getRebates` |
| `SANDBOX_BASE_URL` | `'https://sandbox.orkidlabs.com'` — pass as `baseUrl` for the sandbox |
| `OrkidViemPermitSigner` (`@orkid-labs/sdk/viem`), `OrkidEthersPermitSigner` (`@orkid-labs/sdk/ethers`) | Permit2 signing helpers — optional subpath exports; require `viem` or `ethers` installed |
| `ORKID_CHAIN_CONFIG` | Per-chain metadata (TVMExecutor, Permit2, RPC, explorer, min notional) |
| `PERMIT2` | Canonical Permit2 address: `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## CLI

The package ships an `orkid` binary for testing integration without writing code:

```bash
# via npx once published, or `node dist/cli.js` inside this repo
export ORKID_API_KEY=<your-40-hex-key>
# export ORKID_API_URL=https://orkidlabs.xyz   # optional override

orkid quote --from USDC --to WETH --amount 25 --chain base
orkid tokens --chain base --search USDC
orkid account          # partner account info + rebate rate
orkid usage            # your account's usage events
orkid usage --event-type solve --period 2026-09
orkid rebates          # your accrued monthly rebates
orkid rebates --period 2026-09
orkid status           # API health check
```

Global flags: `--api-key`, `--base-url`, `--json` (raw JSON output), `-h/--help`.

To target the sandbox, pass `--base-url https://sandbox.orkidlabs.com`:

```bash
orkid --base-url https://sandbox.orkidlabs.com --api-key <sandbox-key> status
orkid --base-url https://sandbox.orkidlabs.com --api-key <sandbox-key> quote --from USDC --to WETH --amount 25 --chain base
```

Live solve requires a funded wallet with a Permit2 allowance and `viem` installed:

```bash
npm i viem
export ORKID_PRIVATE_KEY=0x...
orkid solve --from USDC --to WETH --amount 25 \
  --from-address 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 --from-decimals 6 \
  --to-address 0x4200000000000000000000000000000000000006 --to-decimals 18
# default is a dry-run — pass --execute to submit the live swap
```

---

## Reporting endpoints

Partners can query their own account, usage, and rebate data with the same `X-ORKID-API-Key` header. All responses are scoped to the account that owns the key — a key can never see another partner's data.

> **Sandbox note:** These endpoints return empty/zero results on the sandbox because sandbox traffic is not tracked.

### `GET /api/v1/account`

Returns the partner account, including the configured rebate rate.

```bash
curl -H "X-ORKID-API-Key: <key>" https://orkidlabs.xyz/api/v1/account
```

```json
{ "ok": true, "account": { "id": "…", "slug": "alternatefutures", "name": "Alternate Futures", "rebate_bps": 3, "rebate_active": true } }
```

### `GET /api/v1/usage`

Lists usage events (quotes and solves) recorded for the account. Optional filters: `?period=YYYY-MM`, `?event_type=route|solve`, `?limit=N` (default 100).

```bash
curl -H "X-ORKID-API-Key: <key>" "https://orkidlabs.xyz/api/v1/usage?event_type=solve&period=2026-09"
```

```json
{ "ok": true, "events": [ { "event_type": "solve", "volume_usd": 25, "is_dry_run": true, "created_at": "…" } ], "total_volume_usd": 25 }
```

### `GET /api/v1/rebates`

Lists monthly rebate ledger entries. Optional filter: `?period=YYYY-MM`.

```bash
curl -H "X-ORKID-API-Key: <key>" "https://orkidlabs.xyz/api/v1/rebates?period=2026-09"
```

```json
{ "ok": true, "rebates": [ { "period": "monthly", "period_start": "2026-09-01T00:00:00+00:00", "volume_usd": 100, "rebate_bps": 3, "rebate_usd": 0.03, "status": "accrued" } ] }
```

Rebate volume counts only **non-dry-run, non-test `solve` events** — quote requests, dry runs, and operator test traffic (`is_test: true`) are excluded. `rebate_usd = volume_usd × rebate_bps / 10,000`. Entries move from `accrued` → `paid` when Orkid settles monthly.

### Referral rebates

Partners who source other partners earn a referral cut of the referred account's volume, on top of their own. Referral income appears in `GET /api/v1/rebates` as separate ledger rows:

```json
{ "kind": "referral", "source_account_id": "<referred-account-uuid>", "volume_usd": 1000, "rebate_bps": 1, "rebate_usd": 0.10 }
```

`kind: "volume"` rows are your own volume; `kind: "referral"` rows pay you for a referred partner's volume (`source_account_id` identifies which one). Example split: a referred partner at 2 bps + 1 bps referral keeps total cost at 3 bps — the sourcer earns from their network's activity.

### `GET /api/v1/usage` — event flags

Each event carries `is_dry_run` (encode-only, not executed) and `is_test` (operator-marked test traffic). Only `is_dry_run=false, is_test=false` solve events count toward rebates.

### User-pays-gas swaps (below the gasless minimum)

Quotes and solves below the gasless floor still work — the response carries `gaslessEligible: false` and `/api/v1/solve` returns encode-only calldata. The client submits the transaction itself (the user's wallet pays gas).

To count that settled volume toward rebates, the client **must call `POST /api/v1/confirm`** once the tx is mined:

```bash
curl -X POST https://orkidlabs.xyz/api/v1/confirm \
  -H "X-ORKID-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"txHash": "0x…", "chain": "base"}'
```

The API verifies on-chain that the transaction succeeded, targeted the TVMExecutor, and matches the exact calldata it encoded (`keccak256` of `tx.input`). Self-reported hashes that don't match an encoded swap are rejected. The SDK (`client.confirmTransaction`), CLI (`orkid confirm <txHash>`, automatic after `solve --execute` fallbacks), and widget (automatic) call this for you — hand-rolled integrations must call it explicitly or below-min volume won't be tracked.

---

## Examples

See the `examples/` directory for complete, runnable examples:

- `examples/vanilla-viem.ts` — full flow with a viem wallet client
- `examples/vanilla-ethers.ts` — full flow with an ethers signer
- `examples/react.tsx` — React hook wrapper
- `examples/nextjs-server-action.ts` — server-side key protection in a Next.js app
- `examples/curl.sh` — copy-paste curl commands

---

## OpenAPI

The full OpenAPI 3.0 spec is in `openapi.yaml` and can be imported into Postman, Swagger UI, or used to generate client SDKs.

---

## Minimum notional by chain

| Chain | Minimum USD | Notes |
| --- | --- | --- |
| Base | $20 | Low L1 data fee, cheap gas |
| Ethereum | $200 | MEV-protected via Flashbots Protect |
| Arbitrum | $50 | Low fees, fast settlement |
| Polygon | $50 | Low fees, PoS |

Below the minimum, swaps still work but the user pays gas (the solver returns encode-only calldata via `dryRun` semantics — see [User-pays-gas swaps](#user-pays-gas-swaps-below-the-gasless-minimum)).

---

## Contact

For an API key, sandbox access, higher rate limits, or custom fee arrangements:

- Email: `api@orkidlabs.com`
- Dashboard: `https://orkidlabs.xyz/board/admin` (master accounts only)
