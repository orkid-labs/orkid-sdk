import { describe, it, expect } from 'vitest'
import {
  ORKID_CHAIN_CONFIG,
  ORKID_CHAINS,
  PERMIT2,
  getPermit2Address,
  chainIdFromName,
  chainNameFromId,
  chainConfigFromName,
  normalizeChainName,
} from '../src/chains'

describe('chains — unit', () => {
  describe('PERMIT2', () => {
    it('returns the canonical Permit2 address', () => {
      expect(getPermit2Address()).toBe(PERMIT2)
      expect(PERMIT2).toBe('0x000000000022D473030F116dDEE9F6B43aC78BA3')
    })
  })

  describe('ORKID_CHAINS', () => {
    it('lists base, ethereum, arbitrum, polygon', () => {
      expect(ORKID_CHAINS).toContain('base')
      expect(ORKID_CHAINS).toContain('ethereum')
      expect(ORKID_CHAINS).toContain('arbitrum')
      expect(ORKID_CHAINS).toContain('polygon')
    })
  })

  describe('chainIdFromName', () => {
    it('maps base → 8453', () => {
      expect(chainIdFromName('base')).toBe(8453)
    })
    it('maps ethereum → 1', () => {
      expect(chainIdFromName('ethereum')).toBe(1)
    })
    it('maps arbitrum → 42161', () => {
      expect(chainIdFromName('arbitrum')).toBe(42161)
    })
    it('maps polygon → 137', () => {
      expect(chainIdFromName('polygon')).toBe(137)
    })
    it('maps mainnet → 1 (alias)', () => {
      expect(chainIdFromName('mainnet')).toBe(1)
    })
    it('throws on unknown chain', () => {
      expect(() => chainIdFromName('solana')).toThrow('Unsupported chain')
    })
  })

  describe('chainNameFromId', () => {
    it('maps 8453 → base', () => {
      expect(chainNameFromId(8453)).toBe('base')
    })
    it('maps 1 → ethereum', () => {
      expect(chainNameFromId(1)).toBe('ethereum')
    })
    it('throws on unknown id', () => {
      expect(() => chainNameFromId(99999)).toThrow('Unsupported chain id')
    })
  })

  describe('chainConfigFromName', () => {
    it('returns full config for base', () => {
      const cfg = chainConfigFromName('base')
      expect(cfg.id).toBe(8453)
      expect(cfg.name).toBe('base')
      expect(cfg.isLive).toBe(true)
      expect(cfg.tvmExecutor).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(cfg.permit2).toBe(PERMIT2)
    })
    it('returns isLive=false for unichain', () => {
      const cfg = chainConfigFromName('unichain')
      expect(cfg.isLive).toBe(false)
    })
    it('throws on unknown chain', () => {
      expect(() => chainConfigFromName('bitcoin')).toThrow('Unsupported chain')
    })
  })

  describe('normalizeChainName', () => {
    it('normalizes mainnet → ethereum', () => {
      expect(normalizeChainName('mainnet')).toBe('ethereum')
    })
    it('lowercases chain names', () => {
      expect(normalizeChainName('BASE')).toBe('base')
      expect(normalizeChainName('Arbitrum')).toBe('arbitrum')
    })
    it('passes through already-normalized names', () => {
      expect(normalizeChainName('polygon')).toBe('polygon')
    })
  })

  describe('ORKID_CHAIN_CONFIG integrity', () => {
    it('every live chain has a non-zero tvmExecutor', () => {
      for (const cfg of Object.values(ORKID_CHAIN_CONFIG)) {
        if (cfg.isLive) {
          expect(cfg.tvmExecutor).not.toBe('0x0000000000000000000000000000000000000000')
        }
      }
    })
    it('every chain has permit2 set to canonical address', () => {
      for (const cfg of Object.values(ORKID_CHAIN_CONFIG)) {
        expect(cfg.permit2).toBe(PERMIT2)
      }
    })
    it('every chain has an rpcUrl', () => {
      for (const cfg of Object.values(ORKID_CHAIN_CONFIG)) {
        expect(cfg.rpcUrl).toBeTruthy()
        expect(cfg.rpcUrl).toMatch(/^https?:\/\//)
      }
    })
  })
})
