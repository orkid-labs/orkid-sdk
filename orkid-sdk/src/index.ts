/**
 * @orkid/sdk
 *
 * TypeScript SDK for the Orkid gasless swap API.
 */
export { OrkidClient, SANDBOX_BASE_URL } from './client'
export type { OrkidClientOptions } from './types'
export type {
  OrkidChain,
  OrkidToken,
  OrkidQuote,
  OrkidSavings,
  OrkidTransaction,
  OrkidResponse,
  OrkidRouteRequest,
  OrkidPermit,
  OrkidSolveRequest,
  OrkidAccount,
  OrkidAccountResponse,
  OrkidUsageEvent,
  OrkidUsageResponse,
  OrkidRebate,
  OrkidRebatesResponse,
} from './types'

export {
  PERMIT2,
  getPermit2Address,
  PERMIT_TRANSFER_FROM_TYPES,
  PERMIT2_ABI,
  buildPermit2Domain,
  buildPermitMessage,
  toOrkidPermit,
  buildSwapPermit,
  parseAmount,
  formatAmount,
  defaultDeadline,
  buildNonce,
  randomStartWord,
} from './permit'

export type {
  OrkidPermitMessage,
  OrkidPermitDomain,
} from './permit'

export {
  ORKID_CHAIN_CONFIG,
  ORKID_CHAINS,
  chainIdFromName,
  chainNameFromId,
  chainConfigFromName,
  normalizeChainName,
} from './chains'

// Optional wallet-specific signers live in subpath exports so the core
// stays dependency-free:
//   import { OrkidViemPermitSigner } from '@orkid-labs/sdk/viem'
//   import { OrkidEthersPermitSigner } from '@orkid-labs/sdk/ethers'
