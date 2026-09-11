/**
 * Example: Next.js server action that protects the Orkid API key.
 *
 * The API key never reaches the browser. The user signs the Permit2 message
 * client-side and sends the signature + permit to the server, which forwards
 * the /solve request.
 */
'use server'

import { OrkidClient } from '@orkid/sdk'
import type { OrkidPermit } from '@orkid/sdk'

const orkid = new OrkidClient({
  apiKey: process.env.ORKID_API_KEY!,
  baseUrl: 'https://orkidlabs.xyz',
})

interface SwapParams {
  from: string
  to: string
  amount: string
  chain: string
  user: string
  fromAddress: string
  fromDecimals: number
  toAddress: string
  toDecimals: number
  permit: OrkidPermit
  signature: string
  slippageBps?: number
}

export async function executeOrkidSwap(params: SwapParams) {
  const result = await orkid.solve({
    ...params,
    dryRun: false,
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result
}
