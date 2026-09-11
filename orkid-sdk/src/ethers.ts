/**
 * ethers v6-specific helpers for Orkid Permit2 signing.
 *
 * This file is optional — the core SDK has no ethers dependency. Import this
 * module if you already have ethers in your project.
 */
import { ethers } from 'ethers'
import { chainConfigFromName, type OrkidChainConfig } from './chains'
import {
  buildPermitMessage,
  buildPermit2Domain,
  toOrkidPermit,
  parseAmount,
  formatAmount,
  defaultDeadline,
  buildNonce,
} from './permit'
import type { OrkidPermit } from './types'

export interface OrkidSignSwapParams {
  user: string
  fromToken: string
  fromDecimals: number
  amount: string
  chain: string
  nonce?: string
  deadline?: number
}

export class OrkidEthersPermitSigner {
  private signer: ethers.Signer
  private provider: ethers.Provider

  constructor(signer: ethers.Signer, provider: ethers.Provider) {
    this.signer = signer
    this.provider = provider
  }

  async findUnusedNonce(owner: string, maxWords = 1000): Promise<string> {
    const startWord = randomStartWord()
    const max = BigInt(maxWords)
    const permit2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

    const iface = new ethers.Interface([
      'function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)',
    ])

    for (let offset = BigInt(0); offset < max; offset++) {
      const wordPos = (startWord + offset) % BigInt(1_000_000)

      const data = iface.encodeFunctionData('nonceBitmap', [owner, wordPos])
      const result = await this.provider.call({ to: permit2, data })
      const bitmap = BigInt(result)

      const allBits = (BigInt(1) << BigInt(256)) - BigInt(1)
      if (bitmap === allBits) continue

      for (let bitPos = 0; bitPos < 256; bitPos++) {
        const bit = BigInt(1) << BigInt(bitPos)
        if ((bitmap & bit) === BigInt(0)) {
          return buildNonce(wordPos, bitPos)
        }
      }
    }

    throw new Error('No unused Permit2 nonce found after scanning 1000 words')
  }

  async signSwap(params: OrkidSignSwapParams): Promise<{ permit: OrkidPermit; signature: string; chainConfig: OrkidChainConfig }> {
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

    const types = {
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
    }

    const signature = await this.signer.signTypedData(
      domain as any,
      types as any,
      message
    )

    return {
      permit: toOrkidPermit(message),
      signature,
      chainConfig,
    }
  }

  async getPermit2Allowance(token: string, owner: string): Promise<bigint> {
    const permit2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
    const iface = new ethers.Interface([
      'function allowance(address owner, address spender) view returns (uint256)',
    ])
    const data = iface.encodeFunctionData('allowance', [owner, permit2])
    const result = await this.provider.call({ to: token, data })
    return BigInt(result)
  }
}

export { chainConfigFromName, parseAmount, formatAmount, defaultDeadline, buildPermitMessage, buildPermit2Domain, toOrkidPermit }

function randomStartWord(): bigint {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return BigInt(arr[0] >> 8)
  }
  return BigInt(Math.floor(Math.random() * 0xffffff))
}
