import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrkidClient, SANDBOX_BASE_URL } from '../src/client'

describe('OrkidClient — unit', () => {
  describe('constructor', () => {
    it('creates client with default base URL', () => {
      const client = new OrkidClient({})
      expect((client as any).baseUrl).toBe('https://orkidlabs.xyz')
    })
    it('creates client with custom base URL', () => {
      const client = new OrkidClient({ baseUrl: 'https://custom.example.com' })
      expect((client as any).baseUrl).toBe('https://custom.example.com')
    })
    it('strips trailing slash from base URL', () => {
      const client = new OrkidClient({ baseUrl: 'https://orkidlabs.xyz/' })
      expect((client as any).baseUrl).toBe('https://orkidlabs.xyz')
    })
    it('accepts a valid 40-char hex API key', () => {
      const key = 'a'.repeat(40)
      const client = new OrkidClient({ apiKey: key })
      expect((client as any).apiKey).toBe(key)
    })
    it('throws on invalid API key (not hex)', () => {
      expect(() => new OrkidClient({ apiKey: 'xyz123' })).toThrow('40-character hex')
    })
    it('throws on invalid API key (wrong length)', () => {
      expect(() => new OrkidClient({ apiKey: 'a'.repeat(39) })).toThrow('40-character hex')
    })
    it('accepts operator secret', () => {
      const client = new OrkidClient({ operatorSecret: 'secret123' })
      expect((client as any).operatorSecret).toBe('secret123')
    })
    it('accepts a custom fetch', () => {
      const customFetch = vi.fn()
      const client = new OrkidClient({ fetch: customFetch as any })
      expect((client as any).fetch).toBe(customFetch)
    })
  })

  describe('SANDBOX_BASE_URL', () => {
    it('exports the sandbox URL', () => {
      expect(SANDBOX_BASE_URL).toBe('https://sandbox.orkidlabs.com')
    })
  })

  describe('baseHeaders', () => {
    it('includes Content-Type for JSON requests', () => {
      const client = new OrkidClient({})
      const headers = (client as any).baseHeaders(true)
      expect(headers['Content-Type']).toBe('application/json')
    })
    it('does not include Content-Type for non-JSON requests', () => {
      const client = new OrkidClient({})
      const headers = (client as any).baseHeaders(false)
      expect(headers['Content-Type']).toBeUndefined()
    })
    it('includes API key header when set', () => {
      const key = 'a'.repeat(40)
      const client = new OrkidClient({ apiKey: key })
      const headers = (client as any).baseHeaders(true)
      expect(headers['X-ORKID-API-Key']).toBe(key)
    })
    it('includes operator header when set', () => {
      const client = new OrkidClient({ operatorSecret: 'op123' })
      const headers = (client as any).baseHeaders(true)
      expect(headers['X-ORKID-Operator']).toBe('op123')
    })
    it('does not include API key header when not set', () => {
      const client = new OrkidClient({})
      const headers = (client as any).baseHeaders(true)
      expect(headers['X-ORKID-API-Key']).toBeUndefined()
    })
  })
})
