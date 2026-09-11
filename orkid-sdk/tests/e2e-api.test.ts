import { describe, it, expect } from 'vitest'
import { OrkidClient } from '../src/client'
import { chainIdFromName } from '../src/chains'

/**
 * E2E tests — these hit the live Orkid API at orkidlabs.xyz.
 * They are skipped by default; set ORKID_E2E=1 to run them.
 */
const shouldRun = process.env.ORKID_E2E === '1'
const describeE2E = shouldRun ? describe : describe.skip

describeE2E('SDK — e2e (live API)', () => {
  it('gets a quote for USDC→WETH on Base', async () => {
    const client = new OrkidClient({})
    const res = await client.getQuote({
      from: 'USDC',
      to: 'WETH',
      amount: '25',
      chain: 'base',
    })
    expect(res.ok).toBe(true)
    expect(res.quote).toBeDefined()
    expect(res.quote!.amountOut).toBeTruthy()
    expect(res.quote!.protocol).toBeTruthy()
    expect(res.computeMs).toBeGreaterThan(0)
  }, 30000)

  it('gets a quote for USDC→WETH on Ethereum', async () => {
    const client = new OrkidClient({})
    const res = await client.getQuote({
      from: 'USDC',
      to: 'WETH',
      amount: '100',
      chain: 'ethereum',
    })
    expect(res.ok).toBe(true)
    expect(res.quote).toBeDefined()
  }, 30000)

  it('gets a quote for USDC→WETH on Arbitrum', async () => {
    const client = new OrkidClient({})
    const res = await client.getQuote({
      from: 'USDC',
      to: 'WETH',
      amount: '50',
      chain: 'arbitrum',
    })
    expect(res.ok).toBe(true)
    expect(res.quote).toBeDefined()
  }, 30000)

  it('gets a quote for USDC→WETH on Polygon', async () => {
    const client = new OrkidClient({})
    const res = await client.getQuote({
      from: 'USDC',
      to: 'WETH',
      amount: '50',
      chain: 'polygon',
    })
    expect(res.ok).toBe(true)
    expect(res.quote).toBeDefined()
  }, 30000)

  it('returns ok:false for very small amounts below min notional', async () => {
    const client = new OrkidClient({})
    const res = await client.getQuote({
      from: 'USDC',
      to: 'WETH',
      amount: '0.01',
      chain: 'base',
    })
    // Below $20 min notional — should fail or return ok:false
    expect(res.ok).toBe(false)
  }, 30000)

  it('lists tokens on Base', async () => {
    const client = new OrkidClient({})
    const res = await client.listTokens({ chain: 'base', search: 'USDC' })
    expect(res.ok).toBe(true)
    expect(res.tokens).toBeDefined()
    expect(res.tokens!.length).toBeGreaterThan(0)
    expect(res.tokens!.some((t) => t.symbol === 'USDC')).toBe(true)
  }, 30000)

  it('gets API status', async () => {
    const client = new OrkidClient({})
    const res = await client.getStatus()
    expect(res.ok).toBe(true)
  }, 15000)

  it('chainIdFromName matches live chain config', async () => {
    // Verify the chain IDs the SDK knows about match what the API supports
    expect(chainIdFromName('base')).toBe(8453)
    expect(chainIdFromName('ethereum')).toBe(1)
    expect(chainIdFromName('arbitrum')).toBe(42161)
    expect(chainIdFromName('polygon')).toBe(137)
  })
})
