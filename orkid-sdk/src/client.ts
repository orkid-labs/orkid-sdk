import type {
  OrkidAccountResponse,
  OrkidClientOptions,
  OrkidRebatesResponse,
  OrkidResponse,
  OrkidRouteRequest,
  OrkidSolveRequest,
  OrkidUsageResponse,
} from './types'

const DEFAULT_BASE_URL = 'https://orkidlabs.xyz'

/** Sandbox base URL — dry-run mode, real quotes but no execution. */
export const SANDBOX_BASE_URL = 'https://sandbox.orkidlabs.com'

/**
 * HTTP client for the Orkid /api/v1 endpoints.
 *
 * Example:
 *
 * ```ts
 * const orkid = new OrkidClient({ apiKey: process.env.ORKID_API_KEY })
 * const quote = await orkid.getQuote({ from: 'USDC', to: 'WETH', amount: '25', chain: 'base' })
 * ```
 */
export class OrkidClient {
  private apiKey: string | undefined
  private operatorSecret: string | undefined
  private baseUrl: string
  private fetch: typeof fetch

  constructor(options: OrkidClientOptions) {
    this.apiKey = options.apiKey
    this.operatorSecret = options.operatorSecret
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
    this.fetch = options.fetch || globalThis.fetch.bind(globalThis)

    if (this.apiKey && !/^[a-f0-9]{40}$/i.test(this.apiKey)) {
      throw new Error('OrkidClient: apiKey must be a 40-character hex string')
    }
  }

  private baseHeaders(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {}
    if (json) headers['Content-Type'] = 'application/json'
    if (this.apiKey) headers['X-ORKID-API-Key'] = this.apiKey
    if (this.operatorSecret) headers['X-ORKID-Operator'] = this.operatorSecret
    return headers
  }

  /**
   * Anonymous (keyless) browser calls can hit 403 when the anti-scrape token
   * is missing or expired. Recover by hitting /api/v1/handshake (issues a
   * fresh bound cookie) and retrying once.
   */
  private async fetchWithHandshake(doFetch: () => Promise<Response>): Promise<Response> {
    let res = await doFetch()
    if (res.status === 403 && !this.apiKey) {
      const body = await res.clone().json().catch(() => null)
      if (body && typeof body.error === 'string' && /anti-scraping token/i.test(body.error)) {
        try {
          await this.fetch(`${this.baseUrl}/api/v1/handshake`, { credentials: 'include' })
        } catch {
          // handshake failed — return the original 403
        }
        res = await doFetch()
      }
    }
    return res
  }

  /**
   * Get an executable quote for a swap.
   */
  async getQuote(request: OrkidRouteRequest): Promise<OrkidResponse> {
    return this.post('/api/v1/route', request)
  }

  /**
   * Solve a swap gaslessly.
   */
  async solve(request: OrkidSolveRequest): Promise<OrkidResponse> {
    return this.post('/api/v1/solve', request)
  }

  /**
   * Convenience wrapper: get a quote then dry-run solve the same swap with a
   * pre-signed permit. Useful for testing signatures before live execution.
   */
  async dryRun(request: Omit<OrkidSolveRequest, 'dryRun'>): Promise<OrkidResponse> {
    return this.solve({ ...request, dryRun: true })
  }

  /**
   * Fetch a list of tokens for a chain from the Orkid token search endpoint.
   * This is a convenience; the API key is optional for this read-only endpoint.
   */
  async listTokens(
    params: { chain: string; search?: string; limit?: number } = { chain: 'base' }
  ): Promise<{ ok: boolean; tokens?: { address: string; symbol: string; decimals: number; chain: string }[]; error?: string }> {
    const url = new URL(`${this.baseUrl}/api/v1/tokens`)
    url.searchParams.set('chain', params.chain)
    if (params.search) url.searchParams.set('search', params.search)
    if (params.limit) url.searchParams.set('limit', String(params.limit))

    const headers = this.baseHeaders(false)

    const res = await this.fetchWithHandshake(() => this.fetch(url.toString(), { headers }))

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }

    return res.json()
  }

  /**
   * Fetch the partner account associated with this API key.
   */
  async getAccount(): Promise<OrkidAccountResponse> {
    return this.get('/api/v1/account')
  }

  /**
   * Fetch usage events for the partner account. Optionally filter by month
   * (`period: 'YYYY-MM'`) and event type (`'route'` | `'solve'`).
   */
  async getUsage(
    params: { period?: string; eventType?: 'route' | 'solve' | string; limit?: number } = {}
  ): Promise<OrkidUsageResponse> {
    const query: Record<string, string> = {}
    if (params.period) query.period = params.period
    if (params.eventType) query.event_type = params.eventType
    if (params.limit) query.limit = String(params.limit)
    return this.get('/api/v1/usage', query)
  }

  /**
   * Fetch the rebate ledger for the partner account. Optionally filter by
   * month (`period: 'YYYY-MM'`).
   */
  async getRebates(params: { period?: string } = {}): Promise<OrkidRebatesResponse> {
    const query: Record<string, string> = {}
    if (params.period) query.period = params.period
    return this.get('/api/v1/rebates', query)
  }

  /**
   * Health check on the API. The API key is optional here.
   */
  async getStatus(): Promise<{ ok: boolean; [key: string]: unknown }> {
    return this.get('/api/v1/status')
  }

  /**
   * Confirm a user-submitted swap (user-pays-gas mode, e.g. below the gasless
   * floor). The API verifies the tx on-chain and counts it as a real solve —
   * this is what makes user-paid volume rebate-eligible.
   */
  async confirmTransaction(
    txHash: string,
    chain?: string
  ): Promise<{ ok: boolean; confirmed?: boolean; eventId?: number; txHash?: string; chain?: string; error?: string }> {
    const headers = this.baseHeaders(true)

    const res = await this.fetchWithHandshake(() =>
      this.fetch(`${this.baseUrl}/api/v1/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ txHash, chain }),
      })
    )
    const data = await res.json().catch(() => null)
    return data ?? { ok: false, error: `HTTP ${res.status}: empty response` }
  }

  private async get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)

    const headers = this.baseHeaders(false)

    const res = await this.fetchWithHandshake(() => this.fetch(url.toString(), { headers }))
    const data = (await res.json().catch(() => null)) as T | null

    if (!data) {
      return { ok: false, error: `HTTP ${res.status}: empty response` } as T
    }

    return data
  }

  private async post(path: string, body: unknown): Promise<OrkidResponse> {
    const headers = this.baseHeaders(true)

    const res = await this.fetchWithHandshake(() =>
      this.fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    )

    // /solve and /route return JSON in the 200 body, even when `ok: false`.
    const data = (await res.json().catch(() => null)) as OrkidResponse | null

    if (!data) {
      return {
        ok: false,
        error: `HTTP ${res.status}: empty response`,
        computeMs: 0,
      }
    }

    return data
  }
}
