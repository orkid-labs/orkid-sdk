import { useEffect, useRef, useState } from 'react'
import { ORKID_CHAIN_CONFIG } from '@orkid-labs/sdk'

const CHAIN_NAME: Record<number, string> = {
  8453: 'base',
  1: 'ethereum',
  42161: 'arbitrum',
  137: 'polygon',
}

const CHAIN_LIVE: Record<number, boolean> = {
  8453: true,
  1: true,
  42161: true,
  137: true,
}

export function ChainSelect({
  selected,
  onSelect,
  supported,
}: {
  selected: number
  onSelect: (id: number) => void
  supported: number[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentConfig = ORKID_CHAIN_CONFIG[selected]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="orkid-widget-select-trigger"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <span
          style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            background: currentConfig?.color || 'var(--orkid-widget-primary)',
          }}
        />
        <span>{currentConfig?.shortName || 'BASE'}</span>
        <span>▼</span>
      </button>
      {open && (
        <div className="orkid-widget-dropdown" style={{ right: 0, left: 'auto', width: '12rem' }}>
          {supported.map((id) => {
            const config = ORKID_CHAIN_CONFIG[id]
            const live = CHAIN_LIVE[id]
            return (
              <button
                key={id}
                type="button"
                className="orkid-widget-dropdown-item"
                onClick={() => {
                  if (live) onSelect(id)
                  setOpen(false)
                }}
                disabled={!live}
                title={live ? undefined : 'Contact Orkid to enable this chain'}
              >
                <span className="orkid-widget-row" style={{ gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: config?.color || 'var(--orkid-widget-primary)',
                    }}
                  />
                  <span>{config?.name || CHAIN_NAME[id]}</span>
                </span>
                {id === selected && <span style={{ color: 'var(--orkid-widget-primary)' }}>✓</span>}
                {!live && <span style={{ fontSize: '0.7rem', color: 'var(--orkid-widget-muted-foreground)' }}>soon</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
