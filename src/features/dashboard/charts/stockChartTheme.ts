import { formatMoney } from '@/lib/formatters'

export type ChartTheme = {
  background: string
  text: string
  gridVert: string
  gridHorz: string
  border: string
  crosshairVert: string
  crosshairHorz: string
  labelBackground: string
  positive: string
  negative: string
  neutral: string
}

export const DEFAULT_CHART_THEME: ChartTheme = {
  background: '#ffffff',
  text: '#334155',
  gridVert: 'rgba(148, 163, 184, 0.18)',
  gridHorz: 'rgba(148, 163, 184, 0.22)',
  border: 'rgba(100, 116, 139, 0.22)',
  crosshairVert: 'rgba(15, 23, 42, 0.36)',
  crosshairHorz: 'rgba(15, 23, 42, 0.28)',
  labelBackground: '#334155',
  positive: '#008f5a',
  negative: '#d93025',
  neutral: '#1c36be',
}

function readCssVariable(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()

  return value || fallback
}

export function getChartTheme(): ChartTheme {
  return {
    background: readCssVariable('--chart-bg', DEFAULT_CHART_THEME.background),
    text: readCssVariable('--chart-text', DEFAULT_CHART_THEME.text),
    gridVert: readCssVariable('--chart-grid-v', DEFAULT_CHART_THEME.gridVert),
    gridHorz: readCssVariable('--chart-grid-h', DEFAULT_CHART_THEME.gridHorz),
    border: readCssVariable('--chart-border', DEFAULT_CHART_THEME.border),
    crosshairVert: readCssVariable(
      '--chart-crosshair-v',
      DEFAULT_CHART_THEME.crosshairVert
    ),
    crosshairHorz: readCssVariable(
      '--chart-crosshair-h',
      DEFAULT_CHART_THEME.crosshairHorz
    ),
    labelBackground: readCssVariable(
      '--chart-label-bg',
      DEFAULT_CHART_THEME.labelBackground
    ),
    positive: readCssVariable('--chart-positive', DEFAULT_CHART_THEME.positive),
    negative: readCssVariable('--chart-negative', DEFAULT_CHART_THEME.negative),
    neutral: readCssVariable('--chart-neutral', DEFAULT_CHART_THEME.neutral),
  }
}

export function formatPriceLabel(value: number): string {
  return formatMoney(value).replace(',00', '')
}
