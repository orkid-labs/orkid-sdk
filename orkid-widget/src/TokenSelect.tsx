import { useEffect, useRef, useState } from 'react'
import type { OrkidClient } from '@orkid-labs/sdk'
import type { OrkidWidgetToken } from './types'

export function TokenSelect({
  value,
  onChange,
  chainId,
  chainName,
  tokenList,
  client,
  label,
}: {
  value?: OrkidWidgetToken
  onChange: (token: OrkidWidgetToken) => void
  chainId: number
  chainName: string
  tokenList?: OrkidWidgetToken[]
  client: OrkidClient
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tokens, setTokens] = useState<OrkidWidgetToken[]>(tokenList || [])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tokenList) {
      setTokens(tokenList.filter((t) => t.chain === chainName))
      return
    }
    if (!open) return
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await client.listTokens({ search, limit: 50, chain: chainName })
        if (res.ok && res.tokens) {
          setTokens(res.tokens.filter((t: OrkidWidgetToken) => t.address !== '0x0000000000000000000000000000000000000000'))
        }
      } catch (err: any) {
        console.error('TokenSelect fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [open, search, chainName, tokenList, client])

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    setSearch('')
    if (!tokenList) setTokens([])
  }, [chainName, tokenList])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="orkid-widget-select-trigger"
      >
        <span>{value ? value.symbol : 'Select'}</span>
        <span>▼</span>
      </button>
      {open && (
        <div className="orkid-widget-dropdown">
          <div style={{ borderBottom: '1px solid var(--orkid-widget-border)', padding: '0.5rem' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token..."
              className="orkid-widget-search"
            />
          </div>
          <div style={{ maxHeight: '16rem', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--orkid-widget-muted-foreground)' }}>Loading...</div>
            ) : tokens.length === 0 ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--orkid-widget-muted-foreground)' }}>No tokens found</div>
            ) : (
              tokens.map((t) => (
                <button
                  key={t.address}
                  type="button"
                  className="orkid-widget-dropdown-item"
                  onClick={() => {
                    onChange(t)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{t.symbol}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--orkid-widget-muted-foreground)' }}>
                    {t.address.slice(0, 6)}...{t.address.slice(-4)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
