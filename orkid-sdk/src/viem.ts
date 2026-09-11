/**
 * viem-specific helpers for Orkid Permit2 signing.
 *
 * This file is optional — the core SDK has no viem dependency. Import this
 * module if you already have viem in your project.
 */
import type {
  PublicClient,
  WalletClient,
  Hex,
} from 'viem'
import { chainConfigFromName, type OrkidChainConfig } from './chains'
import { PERMIT2_ABI } from './permit'
import { buildPermit2Domain, buildPermitMessage, toOrkidPermit, buildSwapPermit, defaultDeadline, buildNonce } from './permit'
import { parseAmount, formatAmount } from './permit'
import type { OrkidPermit } from './types'

export interface OrkidPermitSignerViem {
  /**
   * Read the Permit2 nonce bitmap and return an unused nonce.
   */
  findUnusedNonce(owner: string, maxWords?: number): Promise<string>

  /**
   * Build, sign, and return a PermitTransferFrom for a swap.
   */
  signSwap(params: OrkidSignSwapParams): Promise<{ permit: OrkidPermit; signature: Hex; chainConfig: OrkidChainConfig }>
}

export interface OrkidSignSwapParams {
  /** User wallet address */
  user: string
  /** Token-in address */
  fromToken: string
  /** Token-in decimals */
  fromDecimals: number
  /** Human-readable amount to sell */
  amount: string
  /** Chain name, e.g. 'base' */
  chain: string
  /** Optional explicit nonce. If omitted, one is found on-chain. */
  nonce?: string
  /** Optional deadline (seconds). Defaults to now + 1 hour. */
  deadline?: number
}

/**
 * Signer for Orkid Permit2 messages using a viem WalletClient.
 */
export class OrkidViemPermitSigner {
  private walletClient: WalletClient
  private publicClient: PublicClient

  constructor(walletClient: WalletClient, publicClient: PublicClient) {
    this.walletClient = walletClient
    this.publicClient = publicClient
  }

  async findUnusedNonce(owner: string, maxWords = 1000): Promise<string> {
    const startWord = randomStartWord()
    const max = BigInt(maxWords)

    for (let offset = BigInt(0); offset < max; offset++) {
      const wordPos = (startWord + offset) % BigInt(1_000_000)

      const bitmap = await this.publicClient.readContract({
        address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        abi: PERMIT2_ABI,
        functionName: 'nonceBitmap',
        args: [owner as Hex, wordPos],
      } as any)

      const bitmapBig = BigInt(String(bitmap))
      if (bitmapBig === (BigInt(1) << BigInt(256)) - BigInt(1)) continue

      for (let bitPos = 0; bitPos < 256; bitPos++) {
        const bit = BigInt(1) << BigInt(bitPos)
        if ((bitmapBig & bit) === BigInt(0)) {
          return buildNonce(wordPos, bitPos)
        }
      }
    }

    throw new Error('No unused Permit2 nonce found after scanning 1000 words')
  }

  async signSwap(params: OrkidSignSwapParams): Promise<{ permit: OrkidPermit; signature: Hex; chainConfig: OrkidChainConfig }> {
    const chainConfig = chainConfigFromName(params.chain)
    const amountRaw = parseAmount(params.amount, params.fromDecimals)
    const nonce = params.nonce || (await this.findUnusedNonce(params.user))
    const deadline = params.deadline || defaultDeadline()

    const message = buildPermitMessage({
      token: params.fromToken,
      amount: amountRaw,
      nonce,
      deadline: String(deadline),
      spender: chainConfig.tvmExecutor,
    })

    const domain = buildPermit2Domain(chainConfig.id)

    // Pass the LocalAccount object when present so viem signs locally instead
    // of forwarding eth_signTypedData_v4 to the RPC transport (which cannot sign).
    const account = this.walletClient.account ?? (params.user as Hex)

    const signature = await this.walletClient.signTypedData({
      account,
      domain,
      types: {
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
      },
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: {
          token: message.permitted.token as Hex,
          amount: BigInt(message.permitted.amount),
        },
        spender: message.spender as Hex,
        nonce: BigInt(message.nonce),
        deadline: BigInt(message.deadline),
      },
    })

    return {
      permit: toOrkidPermit(message),
      signature,
      chainConfig,
    }
  }

  /**
   * Read the ERC20 allowance of the user for the Permit2 contract.
   */
  async getPermit2Allowance(token: string, owner: string): Promise<bigint> {
    const allowance = await this.publicClient.readContract({
      address: token as Hex,
      abi: [
        {
          type: 'function',
          name: 'allowance',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'allowance',
      args: [owner as Hex, '0x000000000022D473030F116dDEE9F6B43aC78BA3'],
    } as any)

    return BigInt(String(allowance))
  }
}

/**
 * Convenience re-exports.
 */
export { buildPermit2Domain, buildPermitMessage, toOrkidPermit, buildSwapPermit, defaultDeadline, buildNonce, parseAmount, formatAmount }

function randomStartWord(): bigint {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return BigInt(arr[0] >>> 8)
  }
  return BigInt(Math.floor(Math.random() * 0xffffff))
}
