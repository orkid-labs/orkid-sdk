import { describe, it, expect } from 'vitest'
import {
  resolveTheme,
  themeToCssVariables,
  defaultLightTheme,
  defaultDarkTheme,
} from '../src/theme'
import type { OrkidWidgetTheme } from '../src/types'

describe('theme — unit', () => {
  describe('defaultLightTheme', () => {
    it('has all required keys', () => {
      expect(defaultLightTheme.background).toBeDefined()
      expect(defaultLightTheme.card).toBeDefined()
      expect(defaultLightTheme.primary).toBeDefined()
      expect(defaultLightTheme.text).toBeDefined()
      expect(defaultLightTheme.border).toBeDefined()
      expect(defaultLightTheme.radius).toBeDefined()
      expect(defaultLightTheme.fontFamily).toBeDefined()
    })
    it('has blue primary for Base branding', () => {
      expect(defaultLightTheme.primary).toMatch(/^#/)
    })
  })

  describe('defaultDarkTheme', () => {
    it('has dark background', () => {
      expect(defaultDarkTheme.background).toMatch(/^#/)
    })
    it('has all required keys', () => {
      expect(defaultDarkTheme.background).toBeDefined()
      expect(defaultDarkTheme.card).toBeDefined()
      expect(defaultDarkTheme.primary).toBeDefined()
      expect(defaultDarkTheme.text).toBeDefined()
    })
  })

  describe('resolveTheme', () => {
    it('returns defaults when given empty object', () => {
      const theme = resolveTheme({})
      expect(theme.background).toBe(defaultLightTheme.background)
      expect(theme.primary).toBe(defaultLightTheme.primary)
    })
    it('overrides specific keys', () => {
      const theme = resolveTheme({ primary: '#ff0000', background: '#000000' })
      expect(theme.primary).toBe('#ff0000')
      expect(theme.background).toBe('#000000')
      // Non-overridden keys keep defaults
      expect(theme.card).toBe(defaultLightTheme.card)
    })
    it('handles undefined', () => {
      const theme = resolveTheme(undefined as any)
      expect(theme.background).toBe(defaultLightTheme.background)
    })
  })

  describe('themeToCssVariables', () => {
    it('converts all theme keys to CSS custom properties', () => {
      const vars = themeToCssVariables(defaultLightTheme)
      expect(vars['--orkid-widget-bg']).toBe(defaultLightTheme.background)
      expect(vars['--orkid-widget-card']).toBe(defaultLightTheme.card)
      expect(vars['--orkid-widget-primary']).toBe(defaultLightTheme.primary)
      expect(vars['--orkid-widget-text']).toBe(defaultLightTheme.text)
      expect(vars['--orkid-widget-border']).toBe(defaultLightTheme.border)
      expect(vars['--orkid-widget-radius']).toBe(defaultLightTheme.radius)
      expect(vars['--orkid-widget-font-family']).toBe(defaultLightTheme.fontFamily)
    })
    it('produces valid CSS variable names', () => {
      const vars = themeToCssVariables(defaultDarkTheme)
      for (const key of Object.keys(vars)) {
        expect(key).toMatch(/^--orkid-widget-/)
      }
    })
  })
})
