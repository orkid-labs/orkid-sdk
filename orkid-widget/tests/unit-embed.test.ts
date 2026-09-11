import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountOrkidSwap } from '../src/embed'

describe('embed — unit', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'orkid-widget'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('throws when target element is not found', () => {
    expect(() => mountOrkidSwap({ target: '#nonexistent' })).toThrow('target element not found')
  })

  it('accepts a string selector', () => {
    const unmount = mountOrkidSwap({ target: '#orkid-widget' })
    expect(typeof unmount).toBe('function')
    unmount()
  })

  it('accepts an HTMLElement', () => {
    const unmount = mountOrkidSwap({ target: container })
    expect(typeof unmount).toBe('function')
    unmount()
  })

  it('returns an unmount function', () => {
    const unmount = mountOrkidSwap({ target: container })
    expect(typeof unmount).toBe('function')
    unmount()
    // Should not throw on double unmount
    expect(() => unmount()).not.toThrow()
  })
})
