/**
 * Example: React hook for an Orkid swap.
 *
 * This assumes wagmi + viem are configured in your app.
 */
import { useState, useCallback } from 'react'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { OrkidClient, OrkidViemPermitSigner } from '@orkid/sdk'

const API_KEY = process.env.NEXT_PUBLIC_ORKID_API_KEY

const FROM_TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const FROM_DECIMALS = 6
const TO_TOKEN = '0x4200000000000000000000000000000000000006'
const TO_DECIMALS = 18

export function useOrkidSwap() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const swap = useCallback(
    async (amount: string, from: string, to: string) => {
      if (!address || !publicClient || !walletClient || !API_KEY) {
        setError('Wallet not connected or API key missing')
        return
      }

      setLoading(true)
      setError(null)
      setTxHash(null)

      try {
        const orkid = new OrkidClient({ apiKey: API_KEY })
        const signer = new OrkidViemPermitSigner(walletClient, publicClient)

        const quote = await orkid.getQuote({
          from,
          to,
          amount,
          chain: 'base',
          fromAddress: FROM_TOKEN,
          fromDecimals: FROM_DECIMALS,
          toAddress: TO_TOKEN,
          toDecimals: TO_DECIMALS,
        })

        if (!quote.ok) throw new Error(quote.error)

        const signed = await signer.signSwap({
          user: address,
          fromToken: FROM_TOKEN,
          fromDecimals: FROM_DECIMALS,
          amount,
          chain: 'base',
        })

        const result = await orkid.solve({
          from,
          to,
          amount,
          chain: 'base',
          user: address,
          fromAddress: FROM_TOKEN,
          fromDecimals: FROM_DECIMALS,
          toAddress: TO_TOKEN,
          toDecimals: TO_DECIMALS,
          dryRun: false,
          permit: signed.permit,
          signature: signed.signature,
          slippageBps: 50,
        })

        if (!result.ok) throw new Error(result.error)

        setTxHash(result.transaction?.txHash || null)
      } catch (e: any) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    },
    [address, publicClient, walletClient]
  )

  return { swap, loading, txHash, error }
}
