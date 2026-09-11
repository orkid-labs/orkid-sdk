import { describe, it, expect } from 'vitest'
import {
  PERMIT_TRANSFER_FROM_TYPES,
  buildPermit2Domain,
  buildPermitMessage,
  toOrkidPermit,
  buildSwapPermit,
  parseAmount,
  formatAmount,
  defaultDeadline,
  buildNonce,
} from '../src/permit'
import { chainConfigFromName } from '../src/chains'

describe('permit — unit', () => {
  describe('PERMIT_TRANSFER_FROM_TYPES', () => {
    it('has PermitTransferFrom primary type', () => {
      expect(PERMIT_TRANSFER_FROM_TYPES.PermitTransferFrom).toBeDefined()
      expect(PERMIT_TRANSFER_FROM_TYPES.PermitTransferFrom.length).toBe(4)
    })
    it('has TokenPermissions secondary type', () => {
      expect(PERMIT_TRANSFER_FROM_TYPES.TokenPermissions).toBeDefined()
      expect(PERMIT_TRANSFER_FROM_TYPES.TokenPermissions.length).toBe(2)
    })
    it('includes permitted, spender, nonce, deadline fields', () => {
      const fields = PERMIT_TRANSFER_FROM_TYPES.PermitTransferFrom.map((f) => f.name)
      expect(fields).toEqual(['permitted', 'spender', 'nonce', 'deadline'])
    })
  })

  describe('buildPermit2Domain', () => {
    it('builds domain with Permit2 name', () => {
      const domain = buildPermit2Domain(8453)
      expect(domain.name).toBe('Permit2')
      expect(domain.chainId).toBe(8453)
      expect(domain.verifyingContract).toBe('0x000000000022D473030F116dDEE9F6B43aC78BA3')
    })
    it('works for ethereum chain id', () => {
      const domain = buildPermit2Domain(1)
      expect(domain.chainId).toBe(1)
    })
  })

  describe('buildPermitMessage', () => {
    it('builds a complete permit message', () => {
      const msg = buildPermitMessage({
        token: '0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E',
        amount: '25000000',
        nonce: '1',
        deadline: '1700000000',
        spender: '0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289',
      })
      expect(msg.permitted.token).toBe('0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E')
      expect(msg.permitted.amount).toBe('25000000')
      expect(msg.spender).toBe('0x60AB9E090abF9B6BcFbA16017eE18AEf5f2c2289')
      expect(msg.nonce).toBe('1')
      expect(msg.deadline).toBe('1700000000')
    })
  })

  describe('toOrkidPermit', () => {
    it('strips spender from the message', () => {
      const msg = buildPermitMessage({
        token: '0xabc',
        amount: '100',
        nonce: '5',
        deadline: '999',
        spender: '0xdef',
      })
      const permit = toOrkidPermit(msg)
      expect(permit.permitted).toEqual({ token: '0xabc', amount: '100' })
      expect(permit.nonce).toBe('5')
      expect(permit.deadline).toBe('999')
      expect((permit as any).spender).toBeUndefined()
    })
  })

  describe('buildSwapPermit', () => {
    it('uses the chain TVMExecutor as spender', () => {
      const { message, permit, chainConfig } = buildSwapPermit(
        'base',
        '0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E',
        '25000000',
        '1',
        1700000000
      )
      expect(chainConfig.name).toBe('base')
      expect(message.spender).toBe(chainConfig.tvmExecutor)
      expect(permit.permitted.token).toBe('0x833589fCD6e6D0896C1dE0e08fe62DB89C20B6E')
      expect(permit.permitted.amount).toBe('25000000')
    })
    it('throws on unsupported chain', () => {
      expect(() => buildSwapPermit('solana', '0xabc', '100', '1', 1000)).toThrow()
    })
  })

  describe('parseAmount', () => {
    it('parses 25 USDC (6 decimals)', () => {
      expect(parseAmount('25', 6)).toBe('25000000')
    })
    it('parses 1.5 ETH (18 decimals)', () => {
      expect(parseAmount('1.5', 18)).toBe('1500000000000000000')
    })
    it('parses 0.0001 ETH', () => {
      expect(parseAmount('0.0001', 18)).toBe('100000000000000')
    })
    it('parses whole numbers with decimals', () => {
      expect(parseAmount('100', 6)).toBe('100000000')
    })
    it('parses with trailing zeros in fraction', () => {
      expect(parseAmount('1.500000', 6)).toBe('1500000')
    })
    it('throws on invalid amount', () => {
      expect(() => parseAmount('abc', 6)).toThrow('Invalid amount')
      expect(() => parseAmount('-5', 6)).toThrow('Invalid amount')
      expect(() => parseAmount('', 6)).toThrow('Invalid amount')
    })
    it('throws when fraction exceeds decimals', () => {
      expect(() => parseAmount('1.1234567', 6)).toThrow('exceeds')
    })
  })

  describe('formatAmount', () => {
    it('formats 25000000 as 25 (6 decimals)', () => {
      expect(formatAmount('25000000', 6)).toBe('25')
    })
    it('formats 1500000000000000000 as 1.5 (18 decimals)', () => {
      expect(formatAmount('1500000000000000000', 18)).toBe('1.5')
    })
    it('formats 0 as 0', () => {
      expect(formatAmount('0', 18)).toBe('0')
    })
    it('trims trailing zeros', () => {
      expect(formatAmount('1500000', 6)).toBe('1.5')
    })
  })

  describe('parseAmount ↔ formatAmount roundtrip', () => {
    it('roundtrips 25 USDC', () => {
      const raw = parseAmount('25', 6)
      expect(formatAmount(raw, 6)).toBe('25')
    })
    it('roundtrips 1.234567 ETH', () => {
      const raw = parseAmount('1.234567', 18)
      const formatted = formatAmount(raw, 18)
      expect(parseAmount(formatted, 18)).toBe(raw)
    })
  })

  describe('defaultDeadline', () => {
    it('returns a timestamp ~1 hour in the future', () => {
      const now = Math.floor(Date.now() / 1000)
      const deadline = defaultDeadline()
      expect(deadline).toBeGreaterThan(now + 3500)
      expect(deadline).toBeLessThan(now + 3700)
    })
  })

  describe('buildNonce', () => {
    it('builds nonce from word and bit position', () => {
      expect(buildNonce(BigInt(0), 0)).toBe('0')
      expect(buildNonce(BigInt(0), 1)).toBe('1')
      expect(buildNonce(BigInt(1), 0)).toBe('256')
      expect(buildNonce(BigInt(1), 1)).toBe('257')
    })
    it('builds large nonce correctly', () => {
      expect(buildNonce(BigInt(255), 255)).toBe(String((255n << 8n) | 255n))
    })
  })
})
