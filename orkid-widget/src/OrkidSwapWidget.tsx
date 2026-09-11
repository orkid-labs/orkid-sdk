import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSendTransaction,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { parseAbi, maxUint256, type Hex } from 'viem'
import {
  OrkidClient,
  buildPermit2Domain,
  buildPermitMessage,
  chainConfigFromName,
  PERMIT2,
} from '@orkid-labs/sdk'
import { useOrkidSwapContext } from './context'
import { themeToCssVariables } from './theme'
import { TokenSelect } from './TokenSelect'
import { ChainSelect } from './ChainSelect'
import type { OrkidWidgetToken } from './types'

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])

const permit2Abi = parseAbi([
  'function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)',
])

const PERMIT_TRANSFER_FROM_TYPES = {
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

const CHAIN_NAME: Record<number, string> = {
  8453: 'base',
  1: 'ethereum',
  42161: 'arbitrum',
  137: 'polygon',
}

const CHAIN_LIVE: Record<number, boolean> = {
  8453: true,
  1: true,
  42161: true,
  137: true,
}

export function OrkidSwapWidget({ className }: { className?: string }) {
  const ctx = useOrkidSwapContext()
  const client = ctx.client as OrkidClient

  const [selectedChainId, setSelectedChainId] = useState<number>(ctx.supportedChains[0] ?? 8453)
  const [fromToken, setFromToken] = useState<OrkidWidgetToken | undefined>(ctx.defaultFromToken)
  const [toToken, setToToken] = useState<OrkidWidgetToken | undefined>(ctx.defaultToToken)
  const [amount, setAmount] = useState<string>(ctx.defaultAmount ?? '')
  const [slippageBps, setSlippageBps] = useState<number>(ctx.defaultSlippageBps)
  const [showSlippage, setShowSlippage] = useState(false)
  const [quote, setQuote] = useState<any | null>(null)
  const [loading, setLoading] = useState<null | 'quote' | 'approve' | 'sign' | 'solve'>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [execMode, setExecMode] = useState<'gasless' | 'user-pays' | null>(null)

  const { address, isConnected } = useAccount()
  const walletChainId = useChainId()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: selectedChainId })
  const { signTypedDataAsync } = useSignTypedData()
  const { writeContract: approveWrite, data: approveTxHash, isPending: isApproving } = useWriteContract()
  const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { sendTransactionAsync, data: fallbackTxHash, isPending: isSendingFallback } = useSendTransaction()
  const { isSuccess: fallbackConfirmed } = useWaitForTransactionReceipt({ hash: fallbackTxHash })
  // Track the submitted swap tx (gasless solve hash or user-pays fallback hash)
  const { isSuccess: swapConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
    chainId: selectedChainId,
  })

  const isOnCorrectChain = walletChainId === selectedChainId
  const chainName = CHAIN_NAME[selectedChainId] ?? 'base'
  const chainLive = CHAIN_LIVE[selectedChainId] ?? false

  const { data: fromTokenBalance } = useReadContract({
    address: fromToken?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address && fromToken ? [address] : undefined,
    chainId: selectedChainId,
    query: { enabled: !!address && !!fromToken && chainLive },
  })

  const { data: erc20Allowance, refetch: refetchAllowance } = useReadContract({
    address: fromToken?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && fromToken ? [address, PERMIT2] : undefined,
    chainId: selectedChainId,
    query: { enabled: !!address && !!fromToken && chainLive },
  })

  useEffect(() => {
    if (approvalConfirmed) {
      refetchAllowance()
      setLoading(null)
    }
  }, [approvalConfirmed, refetchAllowance])

  useEffect(() => {
    if (fallbackConfirmed && fallbackTxHash) {
      setTxHash(fallbackTxHash)
      setLoading(null)
      setAmount('')
      setQuote(null)
      // Register the user-paid swap so the volume counts for the partner account.
      client.confirmTransaction?.(fallbackTxHash, chainName).catch(() => {})
      ctx.onSolve?.({ ok: true, transaction: { txHash: fallbackTxHash, to: '', data: '', value: '0', chain: chainName }, computeMs: 0 } as any)
    }
  }, [fallbackConfirmed, fallbackTxHash, chainName, ctx, client])

  const chainConfig = useMemo(() => {
    try {
      return chainConfigFromName(chainName)
    } catch {
      return undefined
    }
  }, [chainName])

  const fetchQuote = useCallback(async () => {
    if (!amount || Number.parseFloat(amount) <= 0 || !fromToken || !toToken || !chainLive) {
      setQuote(null)
      return
    }
    setLoading('quote')
    setError(null)
    try {
      const res = await client.getQuote({
        from: fromToken.symbol,
        to: toToken.symbol,
        amount,
        chain: chainName,
        fromAddress: fromToken.address,
        toAddress: toToken.address,
        fromDecimals: fromToken.decimals,
        toDecimals: toToken.decimals,
      })
      setQuote(res)
      ctx.onQuote?.(res)
      if (!res.ok) setError(res.error || 'Quote failed')
    } catch (e: any) {
      setError(e.message || 'Quote failed')
      setQuote(null)
      ctx.onError?.(e.message || 'Quote failed')
    } finally {
      setLoading(null)
    }
  }, [amount, fromToken, toToken, chainName, chainLive, client, ctx])

  useEffect(() => {
    const t = setTimeout(fetchQuote, 400)
    return () => clearTimeout(t)
  }, [fetchQuote])

  useEffect(() => {
    setFromToken(ctx.defaultFromToken)
    setToToken(ctx.defaultToToken)
    setAmount(ctx.defaultAmount ?? '')
    setQuote(null)
    setError(null)
    setTxHash(null)
  }, [selectedChainId, ctx.defaultFromToken, ctx.defaultToToken, ctx.defaultAmount])

  async function findUnusedNonce(owner: `0x${string}`): Promise<bigint> {
    if (!publicClient) throw new Error('No public client')
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    const startWord = BigInt(arr[0] >> 8)
    const MAX_OFFSET = BigInt(1000)
    const MODULUS = BigInt(1000000)
    const EIGHT = BigInt(8)
    const ONE = BigInt(1)
    const ZERO = BigInt(0)
    for (let offset = BigInt(0); offset < MAX_OFFSET; offset++) {
      const wordPos = (startWord + offset) % MODULUS
      const bitmap = (await publicClient.readContract({
        address: PERMIT2,
        abi: permit2Abi,
        functionName: 'nonceBitmap',
        args: [owner, wordPos],
      })) as bigint
      if (bitmap === maxUint256) continue
      for (let bitPos = 0; bitPos < 256; bitPos++) {
        const bit = ONE << BigInt(bitPos)
        if ((bitmap & bit) === ZERO) {
          return (wordPos << EIGHT) | BigInt(bitPos)
        }
      }
    }
    throw new Error('No unused Permit2 nonce found')
  }

  function parseAmount(value: string, decimals: number): bigint {
    const normalized = value.trim()
    if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('Invalid amount')
    const [whole, fraction = ''] = normalized.split('.')
    if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimals`)
    const scale = BigInt('1' + '0'.repeat(decimals))
    return BigInt(whole) * scale + BigInt(fraction.padEnd(decimals, '0') || '0')
  }

  async function handleSwap() {
    if (!isConnected || !address || !fromToken || !toToken || !quote?.ok) {
      setError('Connect a wallet and get a valid quote')
      return
    }
    if (!isOnCorrectChain || !chainLive) {
      setError(`Please switch to ${chainConfig?.shortName || 'Base'}`)
      return
    }

    setError(null)
    setTxHash(null)

    try {
      const amountRaw = parseAmount(amount, fromToken.decimals)
      if (fromTokenBalance !== undefined && fromTokenBalance < amountRaw) {
        const balHuman = Number(fromTokenBalance) / 10 ** fromToken.decimals
        setError(`Insufficient ${fromToken.symbol} balance. You have ${balHuman.toFixed(6)} ${fromToken.symbol} but tried ${amount}.`)
        return
      }

      const needsApproval = erc20Allowance === undefined || erc20Allowance === BigInt(0)
      if (needsApproval) {
        setLoading('approve')
        approveWrite({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [PERMIT2, maxUint256],
          chainId: selectedChainId,
        })
        return
      }

      const nonce = await findUnusedNonce(address as `0x${string}`)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

      const spender = chainConfig?.tvmExecutor as `0x${string}`
      if (!spender) throw new Error('No TVMExecutor configured for this chain')

      setLoading('sign')
      const signature = await signTypedDataAsync({
        domain: buildPermit2Domain(Number(walletChainId)),
        types: PERMIT_TRANSFER_FROM_TYPES,
        primaryType: 'PermitTransferFrom',
        message: {
          permitted: { token: fromToken.address as `0x${string}`, amount: amountRaw },
          spender,
          nonce,
          deadline,
        },
      })

      if (!signature || signature.length < 10) {
        setError('Signature not provided')
        setLoading(null)
        return
      }

      // Below the solver's gasless notional floor, the API still encodes the
      // swap but the user submits it and pays gas — skip the live-solve call.
      const belowMin = quote?.gaslessEligible === false
      const wantsGasless = ctx.gasless && !belowMin

      setLoading('solve')
      setExecMode(wantsGasless ? 'gasless' : 'user-pays')

      const permit = {
        permitted: { token: fromToken.address, amount: amountRaw.toString() },
        nonce: nonce.toString(),
        deadline: deadline.toString(),
      }

      const solveRes = await client.solve({
        from: fromToken.symbol,
        to: toToken.symbol,
        amount,
        chain: chainName,
        user: address,
        fromAddress: fromToken.address,
        toAddress: toToken.address,
        fromDecimals: fromToken.decimals,
        toDecimals: toToken.decimals,
        permit,
        signature,
        slippageBps,
        dryRun: !wantsGasless,
      })

      if (solveRes.ok && solveRes.transaction?.txHash) {
        setTxHash(solveRes.transaction.txHash)
        setAmount('')
        setQuote(null)
        ctx.onSolve?.(solveRes)
        return
      }

      if (solveRes.error?.includes('Gas estimation failed')) {
        setError(`Solver rejected the swap: ${solveRes.error}`)
        setLoading(null)
        return
      }

      if (!wantsGasless) {
        if (!solveRes.ok || !solveRes.transaction) {
          setError(solveRes.error || 'Failed to encode swap')
          setLoading(null)
          return
        }
        setExecMode('user-pays')
        await sendTransactionAsync({
          to: solveRes.transaction.to as `0x${string}`,
          data: solveRes.transaction.data as `0x${string}`,
          value: BigInt(solveRes.transaction.value || '0'),
          chainId: selectedChainId,
        })
        return
      }

      // Gasless infra failed; fall back to user-pays.
      const dryRes = await client.dryRun({
        from: fromToken.symbol,
        to: toToken.symbol,
        amount,
        chain: chainName,
        user: address,
        fromAddress: fromToken.address,
        toAddress: toToken.address,
        fromDecimals: fromToken.decimals,
        toDecimals: toToken.decimals,
        permit,
        signature,
        slippageBps,
      })

      if (!dryRes.ok || !dryRes.transaction) {
        setError(dryRes.error || solveRes.error || 'Solver failed to encode swap')
        setLoading(null)
        return
      }

      setExecMode('user-pays')
      await sendTransactionAsync({
        to: dryRes.transaction.to as `0x${string}`,
        data: dryRes.transaction.data as `0x${string}`,
        value: BigInt(dryRes.transaction.value || '0'),
        chainId: selectedChainId,
      })
    } catch (e: any) {
      if (e.code === 4001 || e.message?.includes('rejected')) {
        setError('Signature or transaction rejected')
      } else {
        setError(`[${e.code || '?'}] ${e.message || 'Swap failed'}`)
      }
      setLoading(null)
      ctx.onError?.(e.message || 'Swap failed')
    }
  }

  function handleConnect() {
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    } else {
      setError('No wallet connector found')
    }
  }

  function handleChainChange(id: number) {
    if (!CHAIN_LIVE[id]) return
    setSelectedChainId(id)
    switchChain({ chainId: id as any })
  }

  const isBusy = loading !== null || isConnecting || isApproving || isSendingFallback
  const highImpact = quote?.ok && quote.quote?.priceImpactBps != null && quote.quote.priceImpactBps >= 300
  const canSwap = isConnected && isOnCorrectChain && chainLive && !!amount && !!fromToken && !!toToken && quote?.ok && !isBusy && !highImpact

  const buttonLabel = () => {
    if (!isConnected) return 'Connect Wallet'
    if (!isOnCorrectChain || !chainLive) return `Switch to ${chainConfig?.shortName || 'Base'}`
    if (loading === 'quote') return 'Fetching quote...'
    if (loading === 'approve' || isApproving) return 'Approve Permit2...'
    if (loading === 'sign') return 'Sign in wallet...'
    if (loading === 'solve' && execMode === 'gasless') return 'Executing gasless swap...'
    if (loading === 'solve' && execMode === 'user-pays') return 'Preparing fallback...'
    if (isSendingFallback) return 'Confirm in wallet...'
    return 'Swap'
  }

  const handleButtonClick = () => {
    if (!isConnected) return handleConnect()
    if (!isOnCorrectChain || !chainLive) {
      if (chainLive) switchChain({ chainId: selectedChainId as any })
      return
    }
    handleSwap()
  }

  const explorer = chainConfig?.explorer || 'https://basescan.org'
  const style = useMemo(() => themeToCssVariables(ctx.theme), [ctx.theme])

  return (
    <div className={`orkid-widget ${className ?? ''}`} style={style}>
      <div className="orkid-widget-header">
        <div className="orkid-widget-title">
          {ctx.logoUrl && <img src={ctx.logoUrl} alt="" className="w-6 h-6 object-contain" />}
          <span>{ctx.brandName || 'Swap'}</span>
        </div>
        <ChainSelect selected={selectedChainId} onSelect={handleChainChange} supported={ctx.supportedChains} />
      </div>

      <div className="space-y-4">
        {isConnected && address ? (
          <div className="orkid-widget-row" style={{ justifyContent: 'space-between' }}>
            <span className="orkid-widget-muted-text" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <button className="orkid-widget-button-secondary" style={{ width: 'auto' }} onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="orkid-widget-button" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}

        <div>
          <div className="orkid-widget-label">From</div>
          <div className="orkid-widget-row">
            <TokenSelect value={fromToken} onChange={setFromToken} chainId={selectedChainId} chainName={chainName} tokenList={ctx.tokenList} client={client} />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="orkid-widget-input"
              disabled={!chainLive}
            />
          </div>
        </div>

        <div>
          <div className="orkid-widget-label">To</div>
          <div className="orkid-widget-row">
            <TokenSelect value={toToken} onChange={setToToken} chainId={selectedChainId} chainName={chainName} tokenList={ctx.tokenList} client={client} />
            <div className="orkid-widget-input" style={{ display: 'flex', alignItems: 'center', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {loading === 'quote' ? (
                <span className="orkid-widget-spin">↻</span>
              ) : quote?.ok ? (
                quote.quote?.amountOut || '--'
              ) : (
                '--'
              )}
            </div>
          </div>
        </div>

        {quote?.ok && quote.savings && (
          <div className="orkid-widget-card" style={{ padding: '0.75rem' }}>
            <div className="orkid-widget-row" style={{ justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--orkid-widget-muted-foreground)' }}>Orkid Fee</span>
              <span style={{ color: 'var(--orkid-widget-primary)', fontWeight: 600 }}>{quote.savings.orkidBps} bps</span>
            </div>
            <div className="orkid-widget-row" style={{ justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--orkid-widget-muted-foreground)' }}>MetaMask Avg</span>
              <span style={{ textDecoration: 'line-through' }}>{quote.savings.metamaskBps} bps</span>
            </div>
            <div className="orkid-widget-row" style={{ justifyContent: 'space-between', fontSize: '0.875rem', borderTop: '1px solid var(--orkid-widget-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ color: 'var(--orkid-widget-primary)' }}>You Save</span>
              <span style={{ fontWeight: 700, color: 'var(--orkid-widget-primary)' }}>{quote.savings.savingsMultiplier} lower fees</span>
            </div>
            <div className="orkid-widget-row" style={{ justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--orkid-widget-muted-foreground)' }}>Gas</span>
              <span style={{ color: 'var(--orkid-widget-success)' }}>
                {quote?.gaslessEligible === false ? 'You pay (below $20 gasless min)' : execMode === 'user-pays' ? 'User pays' : 'Gasless'}
              </span>
            </div>
          </div>
        )}

        {quote?.ok && quote.quote?.amountOut && (
          <div>
            <div className="orkid-widget-row" style={{ justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--orkid-widget-muted-foreground)' }}>Minimum receive</span>
              <span style={{ fontFamily: 'monospace' }}>
                {(Number(quote.quote.amountOut) * (1 - slippageBps / 10000)).toFixed(6)} {toToken?.symbol}
              </span>
            </div>
            <div className="orkid-widget-row" style={{ justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <button onClick={() => setShowSlippage(!showSlippage)} style={{ color: 'var(--orkid-widget-muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Slippage: {(slippageBps / 100).toFixed(1)}% {showSlippage ? '▲' : '▼'}
              </button>
              {showSlippage && (
                <div className="orkid-widget-row">
                  {[10, 50, 100, 200].map((bps) => (
                    <button
                      key={bps}
                      onClick={() => setSlippageBps(bps)}
                      className={slippageBps === bps ? 'orkid-widget-button' : 'orkid-widget-button-secondary'}
                      style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      {bps / 100}%
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    placeholder="custom bps"
                    className="orkid-widget-input"
                    style={{ width: '6.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (v > 0 && v <= 500) setSlippageBps(v)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {quote?.ok && quote.quote?.priceImpactBps != null && quote.quote.priceImpactBps > 100 && (
          quote.quote.priceImpactBps >= 300 ? (
            <div className="orkid-widget-warning">
              <div style={{ fontWeight: 600 }}>High Price Impact: {(quote.quote.priceImpactBps / 100).toFixed(1)}%</div>
              <p style={{ fontSize: '0.875rem', margin: '0.25rem 0 0' }}>This size exceeds available pool liquidity. Contact Orkid for OTC/API access.</p>
            </div>
          ) : (
            <div style={{ color: 'var(--orkid-widget-warning)', fontSize: '0.75rem' }}>
              Price impact: {(quote.quote.priceImpactBps / 100).toFixed(2)}%
            </div>
          )
        )}

        {txHash && (
          <div className="orkid-widget-success">
            {swapConfirmed ? (
              <>Swap confirmed{execMode === 'user-pays' ? ' (you paid gas)' : ' (gasless)'}</>
            ) : (
              <>
                <span className="orkid-widget-spin" style={{ marginRight: '0.5rem' }}>↻</span>
                Swap submitted{execMode === 'user-pays' ? ' (you paid gas)' : ' (gasless)'} — confirming…
              </>
            )}{' '}
            <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
              View
            </a>
            {swapConfirmed && (
              <button
                className="orkid-widget-button-secondary"
                style={{ width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}
                onClick={() => { setTxHash(null); setExecMode(null); setQuote(null); setAmount('') }}
              >
                Swap again
              </button>
            )}
          </div>
        )}

        {quote?.ok && quote.gaslessEligible === false && !txHash && !error && (
          <div style={{ color: 'var(--orkid-widget-muted-foreground)', fontSize: '0.75rem' }}>
            Below the gasless minimum — you will submit this swap and pay gas yourself.
          </div>
        )}

        {isConnected && canSwap && !txHash && !error && (
          <div className="orkid-widget-info">
            <p style={{ fontWeight: 600 }}>How this works:</p>
            <p>1. Sign a permit off-chain (no gas) to authorize the solver.</p>
            <p>2. The solver sends the transaction and pays the gas.</p>
          </div>
        )}

        <button className="orkid-widget-button" onClick={handleButtonClick} disabled={isConnected && !canSwap}>
          {(isBusy) && <span className="orkid-widget-spin" style={{ marginRight: '0.5rem' }}>↻</span>}
          {buttonLabel()}
        </button>

        {error && <div className="orkid-widget-error">{error}</div>}

        {ctx.showPoweredBy && (
          <div className="orkid-widget-footer">
            Powered by Orkid · Competitive fee · Gasless
          </div>
        )}
      </div>
    </div>
  )
}
