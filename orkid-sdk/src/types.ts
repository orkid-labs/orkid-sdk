/**
 * Core types for the Orkid Swap API.
 *
 * The /route and /solve endpoints share the same response envelope. A quote is
 * returned in the `quote` field; a solved transaction is returned in the
 * `transaction` field when applicable.
 */

export type OrkidChain = 'base'

/**
 * Token data returned by /api/v1/tokens.
 */
export interface OrkidToken {
  address: string
  symbol: string
  decimals: number
  chain: string
}

export interface OrkidQuote {
  /** Human-readable amount in (e.g. "25.000000") */
  amountIn: string
  /** Human-readable amount out after Orkid fee */
  amountOut: string
  /** Raw atomic amount out as a string */
  amountOutRaw: string
  /** USD notional of the swap input */
  volumeUsd: number
  /** Human-readable rate, e.g. "0.000407 WETH/USDC" */
  rate: string
  /** Best routing protocol, e.g. "aerodrome_slipstreams" */
  protocol: string
  /** Pool address used for the primary hop */
  poolAddress?: string
  /** Estimated price impact in basis points */
  priceImpactBps?: number
  /** Estimated gas cost of the route in USD */
  gasUsd?: number
  /** Estimated gas units consumed by the route */
  gasUnits?: number
}

export interface OrkidSavings {
  /** Orkid fee in basis points (competitive — contact Orkid for pricing) */
  orkidBps: number
  /** Estimated MetaMask-like fee for comparison */
  metamaskBps: number
  /** Savings vs MetaMask in basis points */
  savingsBps: number
  /** Estimated USD savings */
  savingsUsd: number
  /** USD notional of the swap */
  volumeUsd: number
  /** Human-readable savings multiplier */
  savingsMultiplier: string
}

export interface OrkidTransaction {
  /** Transaction hash when the solver submitted gaslessly */
  txHash?: string
  /** Contract the transaction is sent to (TVMExecutor) */
  to: string
  /** Calldata for the transaction */
  data: string
  /** ETH value to send (usually 0) */
  value: string
  /** Chain the tx is for */
  chain: string
}

/**
 * Success/error envelope returned by both /route and /solve.
 */
export interface OrkidResponse {
  ok: boolean
  quote?: OrkidQuote
  transaction?: OrkidTransaction
  savings?: OrkidSavings
  error?: string
  /**
   * False when the swap is below the solver's gasless notional floor —
   * the client should submit the returned calldata itself (user pays gas).
   */
  gaslessEligible?: boolean
  computeMs: number
}

export interface OrkidRouteRequest {
  /** Token symbol or address to sell */
  from: string
  /** Token symbol or address to buy */
  to: string
  /** Human-readable amount to sell, e.g. "25.0" */
  amount: string
  /** Chain name, e.g. "base" */
  chain?: string
  /** Explicit token-in address (recommended) */
  fromAddress?: string
  /** Explicit token-in decimals (required if fromAddress is provided) */
  fromDecimals?: number
  /** Explicit token-out address (recommended) */
  toAddress?: string
  /** Explicit token-out decimals (required if toAddress is provided) */
  toDecimals?: number
}

export interface OrkidPermit {
  permitted: {
    /** Token address */
    token: string
    /** Raw atomic amount */
    amount: string
  }
  /** Permit2 nonce as a uint256 string */
  nonce: string
  /** Unix timestamp deadline */
  deadline: string
}

export interface OrkidSolveRequest extends OrkidRouteRequest {
  /** User wallet address */
  user: string
  /** Permit2 permit object (without spender) */
  permit: OrkidPermit
  /** 65-byte hex signature */
  signature: string
  /** If true, only return calldata and do not submit */
  dryRun?: boolean
  /** Slippage in basis points (e.g. 5 = 0.05%) */
  slippageBps?: number
}

/**
 * Client options.
 */
export interface OrkidClientOptions {
  /** 40-character hex Orkid API key. Optional when using a partner proxy. */
  apiKey?: string
  /** Base URL for the Orkid API */
  baseUrl?: string
  /** Optional fetch override */
  fetch?: typeof fetch
  /**
   * Orkid operator secret — marks usage events as test traffic (excluded from
   * rebateable volume). Server-side only; never set this in browser code.
   */
  operatorSecret?: string
}

/**
 * Partner account record from GET /api/v1/account.
 */
export interface OrkidAccount {
  id: string
  slug: string
  name: string
  contact_email?: string
  /** Rebate rate in basis points (e.g. 3 = 0.03%) */
  rebate_bps: number
  rebate_active: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface OrkidAccountResponse {
  ok: boolean
  account?: OrkidAccount
  error?: string
}

/**
 * A single usage event from GET /api/v1/usage.
 */
export interface OrkidUsageEvent {
  id: number
  account_id: string
  api_key_id: string
  event_type: 'route' | 'solve' | string
  chain?: string
  token_in?: string
  token_out?: string
  amount_in_raw?: string | number | null
  amount_out_raw?: string | number | null
  volume_usd?: number | null
  savings_usd?: number | null
  fee_bps?: number | null
  tx_hash?: string | null
  request_ip?: string | null
  is_dry_run: boolean
  metadata?: Record<string, unknown>
  created_at: string
}

export interface OrkidUsageResponse {
  ok: boolean
  events?: OrkidUsageEvent[]
  total_volume_usd?: number
  total_savings_usd?: number
  error?: string
}

/**
 * A monthly rebate ledger row from GET /api/v1/rebates.
 */
export interface OrkidRebate {
  id: number
  account_id: string
  /** Rebate frequency, e.g. "monthly" */
  period: string
  /** ISO timestamp of the period start (month) */
  period_start: string
  volume_usd: number
  rebate_bps: number
  rebate_usd: number
  status: 'accrued' | 'paid' | 'voided' | string
  settled_at?: string | null
  settlement_tx_hash?: string | null
  created_at?: string
}

export interface OrkidRebatesResponse {
  ok: boolean
  rebates?: OrkidRebate[]
  error?: string
}
