import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrkidClient } from '../src/client'
import type { OrkidResponse, OrkidRouteRequest, OrkidSolveRequest } from '../src/types'

function mockFetch(responses: Record<string, { status?: number; json: () => Promise<any> }>) {
  const calls: { url: string; method: string; body?: string; headers: Record<string, string> }[] = []
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method || 'GET'
    const headers = (init?.headers as Record<string, string>) || {}
    const body = init?.body as string | undefined
    calls.push({ url, method, body, headers })

    // Match by URL path
    const u = new URL(url)
    const key = `${method}:${u.pathname}`
    const mock = responses[key] || responses[u.pathname]
    if (!mock) {
      return {
        ok: false,
        status: 404,
        json: () => Promise.resolve({ ok: false, error: 'not found' }),
        text: () => Promise.resolve('not found'),
        clone: () => ({ json: () => Promise.resolve({ ok: false, error: 'not found' }) }),
      } as any
    }
    return {
      ok: mock.status !== 404 && mock.status !== 500,
      status: mock.status || 200,
      json: mock.json,
      text: () => Promise.resolve(JSON.stringify(mock.json())),
      clone: () => ({ json: mock.json }),
    } as any
  })
  return { fetchFn, calls }
}

describe('OrkidClient — integration (mocked HTTP)', () => {
  describe('getQuote', () => {
    it('POSTs to /api/v1/route with correct body', async () => {
      const quoteResponse: OrkidResponse = {
        ok: true,
        quote: {
          amountIn: '25.000000',
          amountOut: '0.010155',
          amountOutRaw: '10155000000000000',
          volumeUsd: 25,
          rate: '0.000406 WETH/USDC',
          protocol: 'aerodrome_slipstreams',
          priceImpactBps: 0.0007,
        },
        savings: {
          orkidBps: 30,
          metamaskBps: 300,
          savingsBps: 270,
          savingsUsd: 0.0675,
          volumeUsd: 25,
          savingsMultiplier: '9x cheaper',
        },
        gaslessEligible: false,
        computeMs: 42,
      }

      const { fetchFn, calls } = mockFetch({
        'POST:/api/v1/route': { json: () => Promise.resolve(quoteResponse) },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const req: OrkidRouteRequest = {
        from: 'USDC',
        to: 'WETH',
        amount: '25',
        chain: 'base',
      }
      const res = await client.getQuote(req)

      expect(res.ok).toBe(true)
      expect(res.quote?.amountOut).toBe('0.010155')
      expect(res.quote?.protocol).toBe('aerodrome_slipstreams')
      expect(res.savings?.orkidBps).toBe(30)
      expect(res.computeMs).toBe(42)

      // Verify the call
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('POST')
      expect(calls[0].url).toContain('/api/v1/route')
      const body = JSON.parse(calls[0].body!)
      expect(body.from).toBe('USDC')
      expect(body.to).toBe('WETH')
      expect(body.amount).toBe('25')
      expect(body.chain).toBe('base')
    })

    it('sends API key header when configured', async () => {
      const { fetchFn, calls } = mockFetch({
        'POST:/api/v1/route': { json: () => Promise.resolve({ ok: true, computeMs: 1 }) },
      })

      const key = 'b'.repeat(40)
      const client = new OrkidClient({ apiKey: key, fetch: fetchFn as any })
      await client.getQuote({ from: 'USDC', to: 'WETH', amount: '100', chain: 'base' })

      expect(calls[0].headers['X-ORKID-API-Key']).toBe(key)
      expect(calls[0].headers['Content-Type']).toBe('application/json')
    })
  })

  describe('solve', () => {
    it('POSTs to /api/v1/solve with permit and signature', async () => {
      const solveResponse: OrkidResponse = {
        ok: true,
        transaction: {
          txHash: '0xabc123',
          to: '0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289',
          data: '0xdeadbeef',
          value: '0',
          chain: 'base',
        },
        gaslessEligible: true,
        computeMs: 150,
      }

      const { fetchFn, calls } = mockFetch({
        'POST:/api/v1/solve': { json: () => Promise.resolve(solveResponse) },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const req: OrkidSolveRequest = {
        from: 'USDC',
        to: 'WETH',
        amount: '25',
        chain: 'base',
        user: '0x1234567890123456789012345678901234567890',
        permit: {
          permitted: { token: '0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E', amount: '25000000' },
          nonce: '1',
          deadline: '1700000000',
        },
        signature: '0x' + 'a'.repeat(130),
      }
      const res = await client.solve(req)

      expect(res.ok).toBe(true)
      expect(res.transaction?.txHash).toBe('0xabc123')
      expect(res.gaslessEligible).toBe(true)

      const body = JSON.parse(calls[0].body!)
      expect(body.user).toBe('0x1234567890123456789012345678901234567890')
      expect(body.permit.permitted.token).toBe('0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E')
      expect(body.signature).toBeDefined()
    })
  })

  describe('dryRun', () => {
    it('calls solve with dryRun: true', async () => {
      const { fetchFn, calls } = mockFetch({
        'POST:/api/v1/solve': { json: () => Promise.resolve({ ok: true, computeMs: 50 }) },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      await client.dryRun({
        from: 'USDC',
        to: 'WETH',
        amount: '25',
        chain: 'base',
        user: '0x1234567890123456789012345678901234567890',
        permit: {
          permitted: { token: '0xabc', amount: '25000000' },
          nonce: '1',
          deadline: '1700000000',
        },
        signature: '0x' + 'b'.repeat(130),
      })

      const body = JSON.parse(calls[0].body!)
      expect(body.dryRun).toBe(true)
    })
  })

  describe('listTokens', () => {
    it('GETs /api/v1/tokens with chain and search params', async () => {
      const { fetchFn, calls } = mockFetch({
        'GET:/api/v1/tokens': {
          json: () =>
            Promise.resolve({
              ok: true,
              tokens: [
                { address: '0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E', symbol: 'USDC', decimals: 6, chain: 'base' },
              ],
            }),
        },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.listTokens({ chain: 'base', search: 'USDC' })

      expect(res.ok).toBe(true)
      expect(res.tokens?.[0].symbol).toBe('USDC')

      const url = new URL(calls[0].url)
      expect(url.pathname).toBe('/api/v1/tokens')
      expect(url.searchParams.get('chain')).toBe('base')
      expect(url.searchParams.get('search')).toBe('USDC')
    })
  })

  describe('getAccount', () => {
    it('GETs /api/v1/account', async () => {
      const { fetchFn, calls } = mockFetch({
        'GET:/api/v1/account': {
          json: () =>
            Promise.resolve({
              ok: true,
              account: { id: 'acc_1', slug: 'pilot', name: 'Pilot Partner', rebate_bps: 3, rebate_active: true },
            }),
        },
      })

      const key = 'c'.repeat(40)
      const client = new OrkidClient({ apiKey: key, fetch: fetchFn as any })
      const res = await client.getAccount()

      expect(res.ok).toBe(true)
      expect(res.account?.name).toBe('Pilot Partner')
      expect(res.account?.rebate_bps).toBe(3)
      expect(calls[0].headers['X-ORKID-API-Key']).toBe(key)
    })
  })

  describe('getUsage', () => {
    it('GETs /api/v1/usage with period and event_type params', async () => {
      const { fetchFn, calls } = mockFetch({
        'GET:/api/v1/usage': {
          json: () =>
            Promise.resolve({
              ok: true,
              events: [],
              total_volume_usd: 0,
              total_savings_usd: 0,
            }),
        },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      await client.getUsage({ period: '2026-09', eventType: 'solve' })

      const url = new URL(calls[0].url)
      expect(url.searchParams.get('period')).toBe('2026-09')
      expect(url.searchParams.get('event_type')).toBe('solve')
    })
  })

  describe('getRebates', () => {
    it('GETs /api/v1/rebates with period param', async () => {
      const { fetchFn, calls } = mockFetch({
        'GET:/api/v1/rebates': {
          json: () =>
            Promise.resolve({
              ok: true,
              rebates: [
                {
                  id: 1,
                  account_id: 'acc_1',
                  period: 'monthly',
                  period_start: '2026-09-01',
                  volume_usd: 1000000,
                  rebate_bps: 3,
                  rebate_usd: 300,
                  status: 'accrued',
                },
              ],
            }),
        },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.getRebates({ period: '2026-09' })

      expect(res.ok).toBe(true)
      expect(res.rebates?.[0].rebate_usd).toBe(300)

      const url = new URL(calls[0].url)
      expect(url.searchParams.get('period')).toBe('2026-09')
    })
  })

  describe('getStatus', () => {
    it('GETs /api/v1/status', async () => {
      const { fetchFn } = mockFetch({
        'GET:/api/v1/status': {
          json: () => Promise.resolve({ ok: true, chains: ['base', 'ethereum'] }),
        },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.getStatus()
      expect(res.ok).toBe(true)
    })
  })

  describe('confirmTransaction', () => {
    it('POSTs tx hash to /api/v1/confirm', async () => {
      const { fetchFn, calls } = mockFetch({
        'POST:/api/v1/confirm': {
          json: () => Promise.resolve({ ok: true, confirmed: true, eventId: 42 }),
        },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.confirmTransaction('0xabc123', 'base')

      expect(res.ok).toBe(true)
      expect(res.confirmed).toBe(true)
      expect(res.eventId).toBe(42)

      const body = JSON.parse(calls[0].body!)
      expect(body.txHash).toBe('0xabc123')
      expect(body.chain).toBe('base')
    })
  })

  describe('error handling', () => {
    it('returns ok:false on HTTP error', async () => {
      const { fetchFn } = mockFetch({
        'POST:/api/v1/route': { status: 500, json: () => Promise.resolve({ ok: false, error: 'internal' }) },
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.getQuote({ from: 'USDC', to: 'WETH', amount: '25', chain: 'base' })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on empty response', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve(''),
        clone: () => ({ json: () => Promise.resolve(null) }),
      } as any))

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.getQuote({ from: 'USDC', to: 'WETH', amount: '25', chain: 'base' })
      expect(res.ok).toBe(false)
      expect(res.error).toContain('empty response')
    })
  })

  describe('handshake recovery', () => {
    it('retries once on 403 anti-scraping error (anonymous mode)', async () => {
      let callCount = 0
      const fetchFn = vi.fn(async (url: string) => {
        callCount++
        if (url.includes('/api/v1/handshake')) {
          return { ok: true, status: 200 } as any
        }
        if (callCount === 1) {
          return {
            ok: false,
            status: 403,
            json: () => Promise.resolve({ error: 'Invalid anti-scraping token' }),
            clone: () => ({ json: () => Promise.resolve({ error: 'Invalid anti-scraping token' }) }),
          } as any
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true, computeMs: 10 }),
          clone: () => ({ json: () => Promise.resolve({ ok: true, computeMs: 10 }) }),
        } as any
      })

      const client = new OrkidClient({ fetch: fetchFn as any })
      const res = await client.getQuote({ from: 'USDC', to: 'WETH', amount: '25', chain: 'base' })

      expect(res.ok).toBe(true)
      expect(callCount).toBeGreaterThanOrEqual(2) // initial + handshake + retry
    })
  })
})
