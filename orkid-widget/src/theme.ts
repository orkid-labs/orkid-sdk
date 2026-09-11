import type { OrkidWidgetTheme } from './types'

export const defaultLightTheme: Required<OrkidWidgetTheme> = {
  background: '#ffffff',
  card: '#ffffff',
  cardForeground: '#0f172a',
  primary: '#0052ff',
  primaryForeground: '#ffffff',
  text: '#0f172a',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  border: '#e2e8f0',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  radius: '0.625rem',
  fontFamily: 'EquityB, Georgia, serif',
  accent: '#f1f5f9',
  accentForeground: '#0f172a',
  popover: '#ffffff',
  popoverForeground: '#0f172a',
  input: '#e2e8f0',
  ring: '#0052ff',
}

export const defaultDarkTheme: Required<OrkidWidgetTheme> = {
  background: '#0f172a',
  card: '#1e293b',
  cardForeground: '#f8fafc',
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  text: '#f8fafc',
  muted: '#334155',
  mutedForeground: '#94a3b8',
  border: '#334155',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#f87171',
  radius: '0.625rem',
  fontFamily: 'EquityB, Georgia, serif',
  accent: '#334155',
  accentForeground: '#f8fafc',
  popover: '#1e293b',
  popoverForeground: '#f8fafc',
  input: '#334155',
  ring: '#3b82f6',
}

export function resolveTheme(partial: OrkidWidgetTheme = {}): Required<OrkidWidgetTheme> {
  return { ...defaultLightTheme, ...partial }
}

export function themeToCssVariables(theme: Required<OrkidWidgetTheme>): Record<string, string> {
  return {
    '--orkid-widget-bg': theme.background,
    '--orkid-widget-card': theme.card,
    '--orkid-widget-card-foreground': theme.cardForeground,
    '--orkid-widget-primary': theme.primary,
    '--orkid-widget-primary-foreground': theme.primaryForeground,
    '--orkid-widget-text': theme.text,
    '--orkid-widget-muted': theme.muted,
    '--orkid-widget-muted-foreground': theme.mutedForeground,
    '--orkid-widget-border': theme.border,
    '--orkid-widget-success': theme.success,
    '--orkid-widget-warning': theme.warning,
    '--orkid-widget-danger': theme.danger,
    '--orkid-widget-radius': theme.radius,
    '--orkid-widget-font-family': theme.fontFamily,
    '--orkid-widget-accent': theme.accent,
    '--orkid-widget-accent-foreground': theme.accentForeground,
    '--orkid-widget-popover': theme.popover,
    '--orkid-widget-popover-foreground': theme.popoverForeground,
    '--orkid-widget-input': theme.input,
    '--orkid-widget-ring': theme.ring,
  }
}
