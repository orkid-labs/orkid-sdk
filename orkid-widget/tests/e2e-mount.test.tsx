import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'

// Mock viem before anything else — parseAbi is called at module level
vi.mock('viem', () => ({
  parseAbi: (..._args: any[]) => [],
  maxUint256: BigInt(2) ** BigInt(256) - BigInt(1),
}))

// Mock wagmi hooks before importing widget components
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 8453,
  useConnect: () => ({ connect: vi.fn(), connectors: [], isPending: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({ switchChain: vi.fn(), chains: [] }),
  usePublicClient: () => ({}),
  useReadContract: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn(), data: undefined, isPending: false }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ data: undefined, isLoading: false, isSuccess: false }),
  useWriteContract: () => ({ writeContract: vi.fn(), writeContractAsync: vi.fn(), data: undefined, isPending: false }),
  WagmiProvider: ({ children }: any) => children,
  createConfig: () => ({}),
  http: () => ({}),
}))

vi.mock('wagmi/chains', () => ({
  base: { id: 8453, name: 'base' },
  mainnet: { id: 1, name: 'ethereum' },
  arbitrum: { id: 42161, name: 'arbitrum' },
  polygon: { id: 137, name: 'polygon' },
}))

vi.mock('wagmi/connectors', () => ({
  injected: () => ({}),
  walletConnect: () => ({}),
}))

vi.mock('@tanstack/react-query', () => ({
  QueryClient: function QueryClient() { return {} },
  QueryClientProvider: ({ children }: any) => children,
  useQuery: () => ({ data: undefined, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))

import { mountOrkidSwap } from '../src/embed'
import { OrkidSwapProvider, OrkidSwapWidget } from '../src/index'

describe('Widget — e2e (DOM mount)', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('mounts full widget via mountOrkidSwap', () => {
    act(() => {
      mountOrkidSwap({
        target: container,
        apiKey: '',
        walletMode: 'external',
        brandName: 'Test Swap',
      })
    })
    expect(container.innerHTML).not.toBe('')
    expect(container.innerHTML).toContain('Test Swap')
    expect(container.innerHTML).toContain('Connect Wallet')
  })

  it('renders OrkidSwapWidget inside OrkidSwapProvider', () => {
    const { container: renderContainer } = render(
      <OrkidSwapProvider apiKey="" walletMode="external" brandName="E2E Test">
        <OrkidSwapWidget />
      </OrkidSwapProvider>
    )
    expect(renderContainer.innerHTML).not.toBe('')
    expect(renderContainer.innerHTML).toContain('E2E Test')
  })

  it('cleans up DOM on unmount', () => {
    let unmount: () => void
    act(() => {
      unmount = mountOrkidSwap({
        target: container,
        apiKey: '',
        walletMode: 'external',
      })
    })
    expect(container.innerHTML).not.toBe('')
    act(() => unmount())
    expect(container.children.length).toBe(0)
  })

  it('mounts with custom theme', () => {
    act(() => {
      mountOrkidSwap({
        target: container,
        apiKey: '',
        walletMode: 'external',
        theme: { primary: '#00ff00', background: '#111111' },
      })
    })
    expect(container.innerHTML).not.toBe('')
  })

  it('mounts with supported chains override', () => {
    act(() => {
      mountOrkidSwap({
        target: container,
        apiKey: '',
        walletMode: 'external',
        supportedChains: [8453],
      })
    })
    expect(container.innerHTML).not.toBe('')
  })

  it('shows brand name in rendered output', () => {
    act(() => {
      mountOrkidSwap({
        target: container,
        apiKey: '',
        walletMode: 'external',
        brandName: 'Acme DEX',
      })
    })
    expect(container.innerHTML).toContain('Acme DEX')
  })

  it('shows Connect Wallet button when disconnected', () => {
    act(() => {
      mountOrkidSwap({
        target: container,
        apiKey: '',
        walletMode: 'external',
      })
    })
    expect(container.innerHTML).toContain('Connect Wallet')
  })
})
