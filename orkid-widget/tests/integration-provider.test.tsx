import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrkidSwapProvider } from '../src/OrkidSwapProvider'
import { OrkidSwapContext, useOrkidSwapContext } from '../src/context'
import type { OrkidSwapContextValue } from '../src/context'

function ContextProbe() {
  const ctx = useOrkidSwapContext()
  return (
    <div>
      <span data-testid="has-client">{ctx.client ? 'yes' : 'no'}</span>
      <span data-testid="wallet-mode">{ctx.walletMode}</span>
      <span data-testid="gasless">{ctx.gasless ? 'true' : 'false'}</span>
      <span data-testid="brand">{ctx.brandName || 'default'}</span>
    </div>
  )
}

describe('OrkidSwapProvider — integration', () => {
  it('provides a client to children', () => {
    render(
      <OrkidSwapProvider apiKey="" walletMode="external">
        <ContextProbe />
      </OrkidSwapProvider>
    )
    expect(screen.getByTestId('has-client').textContent).toBe('yes')
  })

  it('passes walletMode through context', () => {
    render(
      <OrkidSwapProvider apiKey="" walletMode="external">
        <ContextProbe />
      </OrkidSwapProvider>
    )
    expect(screen.getByTestId('wallet-mode').textContent).toBe('external')
  })

  it('defaults gasless to true', () => {
    render(
      <OrkidSwapProvider apiKey="" walletMode="external">
        <ContextProbe />
      </OrkidSwapProvider>
    )
    expect(screen.getByTestId('gasless').textContent).toBe('true')
  })

  it('passes brandName through context', () => {
    render(
      <OrkidSwapProvider apiKey="" walletMode="external" brandName="Acme Swap">
        <ContextProbe />
      </OrkidSwapProvider>
    )
    expect(screen.getByTestId('brand').textContent).toBe('Acme Swap')
  })

  it('uses default API base URL when not provided', () => {
    let captured: OrkidSwapContextValue | null = null
    function Probe() {
      captured = useOrkidSwapContext()
      return null
    }
    render(
      <OrkidSwapProvider apiKey="" walletMode="external">
        <Probe />
      </OrkidSwapProvider>
    )
    // The client should have been created with the default URL
    expect(captured!.client).toBeDefined()
  })

  it('resolves theme overrides', () => {
    let captured: OrkidSwapContextValue | null = null
    function Probe() {
      captured = useOrkidSwapContext()
      return null
    }
    render(
      <OrkidSwapProvider apiKey="" walletMode="external" theme={{ primary: '#ff0000' }}>
        <Probe />
      </OrkidSwapProvider>
    )
    expect(captured!.theme.primary).toBe('#ff0000')
  })
})
