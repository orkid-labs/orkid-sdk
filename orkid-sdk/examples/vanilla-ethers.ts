/**
 * Example: swap USDC to WETH on Base using ethers v6.
 *
 * Requires:
 *   npm install ethers @orkid/sdk
 */
import { OrkidClient, OrkidEthersPermitSigner } from '@orkid/sdk'
import { ethers } from 'ethers'

const API_KEY = process.env.ORKID_API_KEY
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY
const RPC_URL = 'https://mainnet.base.org'

if (!API_KEY) throw new Error('Set ORKID_API_KEY')
if (!PRIVATE_KEY) throw new Error('Set OWNER_PRIVATE_KEY')

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new ethers.Wallet(PRIVATE_KEY, provider)

const orkid = new OrkidClient({ apiKey: API_KEY })
const permitSigner = new OrkidEthersPermitSigner(signer, provider)

const FROM_TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const FROM_DECIMALS = 6
const TO_TOKEN = '0x4200000000000000000000000000000000000006'
const TO_DECIMALS = 18
const AMOUNT = '25.0'

async function main() {
  const quote = await orkid.getQuote({
    from: 'USDC',
    to: 'WETH',
    amount: AMOUNT,
    chain: 'base',
    fromAddress: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    toAddress: TO_TOKEN,
    toDecimals: TO_DECIMALS,
  })

  if (!quote.ok) throw new Error(`Quote failed: ${quote.error}`)

  const signed = await permitSigner.signSwap({
    user: await signer.getAddress(),
    fromToken: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    amount: AMOUNT,
    chain: 'base',
  })

  const result = await orkid.solve({
    from: 'USDC',
    to: 'WETH',
    amount: AMOUNT,
    chain: 'base',
    user: await signer.getAddress(),
    fromAddress: FROM_TOKEN,
    fromDecimals: FROM_DECIMALS,
    toAddress: TO_TOKEN,
    toDecimals: TO_DECIMALS,
    dryRun: false,
    permit: signed.permit,
    signature: signed.signature,
    slippageBps: 50,
  })

  if (!result.ok) throw new Error(`Solve failed: ${result.error}`)
  console.log('txHash:', result.transaction?.txHash)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
