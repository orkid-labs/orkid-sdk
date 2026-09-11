/**
 * Example: swap USDC to WETH on Base using viem.
 *
 * Requires:
 *   npm install viem @orkid/sdk
 *
 * Set ORKID_API_KEY and OWNER_PRIVATE_KEY before running.
 */
import { OrkidClient, OrkidViemPermitSigner } from '@orkid/sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const API_KEY = process.env.ORKID_API_KEY
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY

if (!API_KEY) throw new Error('Set ORKID_API_KEY')
if (!PRIVATE_KEY) throw new Error('Set OWNER_PRIVATE_KEY')

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
const publicClient = createPublicClient({ chain: base, transport: http() })
const walletClient = createWalletClient({ account, chain: base, transport: http() })

const orkid = new OrkidClient({ apiKey: API_KEY })
const signer = new OrkidViemPermitSigner(walletClient, publicClient)

const FROM_TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' // USDC
const FROM_DECIMALS = 6
const TO_TOKEN = '0x4200000000000000000000000000000000000006' // WETH
const TO_DECIMALS = 18
const AMOUNT = '25.0'
const CHAIN = 'base'

async function main() {
  const quote = await orkid.getQuote({
    from: 'USDC',
    to: 'WETH',
    amount: AMOUNT,
    chain: CHAIN,
    fromAddress: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    toAddress: TO_TOKEN,
    toDecimals: TO_DECIMALS,
  })

  if (!quote.ok) {
    throw new Error(`Quote failed: ${quote.error}`)
  }

  console.log('Quote:', quote.quote)
  console.log('Savings:', quote.savings)

  const signed = await signer.signSwap({
    user: account.address,
    fromToken: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    amount: AMOUNT,
    chain: CHAIN,
  })

  console.log('Permit:', signed.permit)
  console.log('Signature:', signed.signature)

  // For safety, dry-run first
  const dryRun = await orkid.dryRun({
    from: 'USDC',
    to: 'WETH',
    amount: AMOUNT,
    chain: CHAIN,
    user: account.address,
    fromAddress: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    toAddress: TO_TOKEN,
    toDecimals: TO_DECIMALS,
    permit: signed.permit,
    signature: signed.signature,
    slippageBps: 50,
  })

  if (!dryRun.ok) {
    console.error('Dry run failed:', dryRun.error)
    return
  }

  console.log('Dry run tx:', dryRun.transaction)

  // Live execution
  const result = await orkid.solve({
    from: 'USDC',
    to: 'WETH',
    amount: AMOUNT,
    chain: CHAIN,
    user: account.address,
    fromAddress: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    toAddress: TO_TOKEN,
    toDecimals: TO_DECIMALS,
    dryRun: false,
    slippageBps: 50,
    permit: signed.permit,
    signature: signed.signature,
  })

  if (!result.ok) {
    throw new Error(`Solve failed: ${result.error}`)
  }

  console.log('Swap submitted:', result.transaction?.txHash)
  console.log('Explorer:', `https://basescan.org/tx/${result.transaction?.txHash}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
