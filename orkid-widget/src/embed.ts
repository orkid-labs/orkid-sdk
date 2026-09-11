import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { OrkidSwapProvider } from './OrkidSwapProvider'
import { OrkidSwapWidget } from './OrkidSwapWidget'
import type { OrkidSwapProviderProps } from './types'

export interface OrkidSwapEmbedOptions extends OrkidSwapProviderProps {
  /** The DOM element or selector to mount the widget into. */
  target: HTMLElement | string
}

/**
 * Mounts the Orkid swap widget into a DOM element.
 * Useful for script embeds or non-React hosts.
 */
export function mountOrkidSwap(options: OrkidSwapEmbedOptions): () => void {
  const { target, ...props } = options
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) throw new Error(`OrkidSwap: target element not found: ${target}`)

  const root = createRoot(el)
  root.render(
    createElement(OrkidSwapProvider, props, createElement(OrkidSwapWidget))
  )

  return () => root.unmount()
}
