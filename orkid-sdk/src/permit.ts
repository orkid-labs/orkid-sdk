import { chainConfigFromName, getPermit2Address, PERMIT2, type OrkidChainConfig } from './chains'
import type { OrkidPermit } from './types'

/**
 * EIP-712 typed-data definition for Permit2 PermitTransferFrom.
 *
 * The `spender` field is part of the signed type string but is not included in
 * the JSON `permit` object sent to /api/v1/solve.
 */
export const PERMIT_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
} as const

export interface OrkidPermitMessage {
  permitted: {
    token: string
    amount: string
  }
  spender: string
  nonce: string
  deadline: string
}

export interface OrkidPermitDomain {
  name: string
  chainId: number
  verifyingContract: `0x${string}`
}

/**
 * Build the EIP-712 domain for Permit2 on a given chain.
 */
export function buildPermit2Domain(chainId: number): OrkidPermitDomain {
  return {
    name: 'Permit2',
    chainId,
    verifyingContract: getPermit2Address() as `0x${string}`,
  }
}

/**
 * Build the full PermitTransferFrom message (including the `spender`) that must
 * be signed by the user.
 */
export function buildPermitMessage(
  params: {
    token: string
    amount: string
    nonce: string
    deadline: string
    spender: string
  }
): OrkidPermitMessage {
  return {
    permitted: {
      token: params.token,
      amount: params.amount,
    },
    spender: params.spender,
    nonce: params.nonce,
    deadline: params.deadline,
  }
}

/**
 * Strip the `spender` from the signed permit to produce the object sent to
 * /api/v1/solve.
 */
export function toOrkidPermit(message: OrkidPermitMessage): OrkidPermit {
  return {
    permitted: message.permitted,
    nonce: message.nonce,
    deadline: message.deadline,
  }
}

/**
 * Convert a human-readable token amount to raw atomic units based on decimals.
 */
export function parseAmount(value: string, decimals: number): string {
  const normalized = value.trim()
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid amount: ${value}`)
  }

  const [whole, fraction = ''] = normalized.split('.')
  if (fraction.length > decimals) {
    throw new Error(`Amount ${value} exceeds ${decimals} decimals`)
  }

  const scale = BigInt('1' + '0'.repeat(decimals))
  const wholeBig = BigInt(whole) * scale
  const fractionBig = BigInt((fraction.padEnd(decimals, '0') || '0'))
  return (wholeBig + fractionBig).toString()
}

/**
 * Format a raw atomic amount to a human-readable string.
 */
export function formatAmount(raw: string, decimals: number): string {
  const rawBig = BigInt(raw)
  const scale = BigInt('1' + '0'.repeat(decimals))
  const whole = (rawBig / scale).toString()
  const fraction = (rawBig % scale).toString().padStart(decimals, '0')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/**
 * Build the permit for a swap using the Orkid TVMExecutor as the spender.
 */
export function buildSwapPermit(
  chainName: string,
  token: string,
  amount: string,
  nonce: string,
  deadlineSeconds: number
): { message: OrkidPermitMessage; permit: OrkidPermit; chainConfig: OrkidChainConfig } {
  const chainConfig = chainConfigFromName(chainName)
  const message = buildPermitMessage({
    token,
    amount,
    nonce,
    deadline: String(deadlineSeconds),
    spender: chainConfig.tvmExecutor,
  })
  const permit = toOrkidPermit(message)
  return { message, permit, chainConfig }
}

/**
 * Compute a default deadline 1 hour from now.
 */
export function defaultDeadline(): number {
  return Math.floor(Date.now() / 1000) + 3600
}

/**
 * Permit2 contract nonce layout:
 *
 *   wordPos = uint248(nonce >> 8)
 *   bitPos  = uint8(nonce)
 *
 * This helper constructs a nonce from a word position and bit position.
 */
export function buildNonce(wordPos: bigint, bitPos: number): string {
  return ((wordPos << BigInt(8)) | BigInt(bitPos)).toString()
}

/**
 * Random starting word position to avoid nonce collisions across users.
 */
export function randomStartWord(): bigint {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    // Upper 24 bits as word position seed
    return BigInt(arr[0] >>> 8)
  }
  return BigInt(Math.floor(Math.random() * 0xffffff))
}

/**
 * Minimal Permit2 nonceBitmap ABI and selectors.
 */
export const PERMIT2_ABI = [
  {
    type: 'function',
    name: 'nonceBitmap',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'wordPos', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export { PERMIT2, getPermit2Address }
