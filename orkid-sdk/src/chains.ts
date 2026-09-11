/**
 * Chain metadata for Orkid swaps.
 *
 * Base, Ethereum, Arbitrum, and Polygon are live with production TVMExecutor
 * proxies at 30 bps. Each chain also has a sandbox TVMExecutor at 75 bps
 * for the retail widget on orkidlabs.xyz.
 */

export interface OrkidChainConfig {
  id: number
  name: string
  shortName: string
  color: string
  permit2: string
  tvmExecutor: string
  /** Sandbox TVMExecutor at 75 bps for the retail widget (orkidlabs.xyz). */
  sandboxTvmExecutor: string
  tychoRouter: string
  explorer: string
  rpcUrl: string
  nativeSymbol: string
  nativeDecimals: number
  minNotionalUsd: number
  isLive: boolean
}

export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const

/** Canonical Permit2 contract address on all EVM chains. */
export function getPermit2Address(): string {
  return PERMIT2
}

/**
 * Map chain identifiers to the solver/TVMExecutor config.
 *
 * The TVMExecutor is the `spender` that must appear in the signed Permit2
 * PermitTransferFrom message.
 *
 * Production TVMExecutors charge 30 bps. Sandbox TVMExecutors charge 75 bps
 * and are used by the retail widget on orkidlabs.xyz.
 */
export const ORKID_CHAIN_CONFIG: Record<number, OrkidChainConfig> = {
  8453: {
    id: 8453,
    name: 'base',
    shortName: 'BASE',
    color: '#0052FF',
    permit2: PERMIT2,
    tvmExecutor: '0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289',
    sandboxTvmExecutor: '0xD5B87788AF6F9E04E7FA298Bd973cEEA8c0Df0aF',
    tychoRouter: '0x2D3524b9b5dAE34B646614eebb1E038D403E4Cac',
    explorer: 'https://basescan.org',
    rpcUrl: "https://rpc.orkidlabs.com/rpc/base",
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    minNotionalUsd: 20,
    isLive: true,
  },
  1: {
    id: 1,
    name: 'ethereum',
    shortName: 'ETH',
    color: '#627EEA',
    permit2: PERMIT2,
    tvmExecutor: '0xCfc33b521190FcD414c8f81f479749c4dCE8f69b',
    sandboxTvmExecutor: '0xd1b5c6e142fd95be389cc4ca117cb0fb7429534f',
    tychoRouter: '0xfd0b31d2e955fa55e3fa641fe90e08b677188d35',
    explorer: 'https://etherscan.io',
    rpcUrl: "https://rpc.orkidlabs.com/rpc/ethereum",
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    minNotionalUsd: 200,
    isLive: true,
  },
  130: {
    id: 130,
    name: 'unichain',
    shortName: 'UNI',
    color: '#FF007A',
    permit2: PERMIT2,
    tvmExecutor: '0x3fC25b3Ae57514e839f901cB1f628F8557150C2b',
    sandboxTvmExecutor: '0x0000000000000000000000000000000000000000',
    tychoRouter: '0xFfA5ec2e444e4285108e4a17b82dA495c178427B',
    explorer: 'https://unichain.blockscout.com',
    rpcUrl: 'https://unichain-rpc.publicnode.com',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    minNotionalUsd: 200,
    isLive: false,
  },
  42161: {
    id: 42161,
    name: 'arbitrum',
    shortName: 'ARB',
    color: '#28A0F0',
    permit2: PERMIT2,
    tvmExecutor: '0xf57235609bf99fb0b017e95b3bc33a606a541374',
    sandboxTvmExecutor: '0x9a4cd4ce4ca1dd554d337270b3353da9abb52c83',
    tychoRouter: '0x924F147c50eA59f5180a26031A8b65B2aA1e81Cd',
    explorer: 'https://arbiscan.io',
    rpcUrl: "https://rpc.orkidlabs.com/rpc/arbitrum",
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    minNotionalUsd: 50,
    isLive: true,
  },
  137: {
    id: 137,
    name: 'polygon',
    shortName: 'POL',
    color: '#8247E5',
    permit2: PERMIT2,
    tvmExecutor: '0xd633Ea84E6E2Db002C14C6fe3A064eE2cc4E258c',
    sandboxTvmExecutor: '0x9a4cd4ce4ca1dd554d337270b3353da9abb52c83',
    tychoRouter: '0xbd4e6011F03355C2A377Fd9Af939322A7d0A1bC1',
    explorer: 'https://polygonscan.com',
    rpcUrl: "https://rpc.orkidlabs.com/rpc/polygon",
    nativeSymbol: 'MATIC',
    nativeDecimals: 18,
    minNotionalUsd: 50,
    isLive: true,
  },
}

/** Supported chain names. */
export const ORKID_CHAINS = ["base", "ethereum", "arbitrum", "polygon"] as const

export function chainIdFromName(name: string): number {
  const normalized = normalizeChainName(name)
  for (const config of Object.values(ORKID_CHAIN_CONFIG)) {
    if (config.name === normalized) return config.id
  }
  throw new Error(`Unsupported chain: ${name}`)
}

export function chainNameFromId(chainId: number): string {
  const config = ORKID_CHAIN_CONFIG[chainId]
  if (!config) throw new Error(`Unsupported chain id: ${chainId}`)
  return config.name
}

export function chainConfigFromName(name: string): OrkidChainConfig {
  const normalized = normalizeChainName(name)
  const config = Object.values(ORKID_CHAIN_CONFIG).find((c) => c.name === normalized)
  if (!config) throw new Error(`Unsupported chain: ${name}`)
  return config
}

export function normalizeChainName(name: string): string {
  const n = name.toLowerCase()
  if (n === 'mainnet') return 'ethereum'
  return n
}
