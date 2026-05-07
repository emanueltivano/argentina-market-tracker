'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type AreaData,
  type LineData,
  type Time,
} from 'lightweight-charts'
import { type StockHistoryPoint } from '@/lib/stockHistory'
import { formatMoney } from '@/lib/formatters'

type LightweightStockChartProps = {
  points: StockHistoryPoint[]
  symbol: string
  type?: 'area' | 'line'
}

const CHART_HEIGHT = 236

function formatPriceLabel(value: number): string {
  return formatMoney(value).replace(',00', '')
}

function formatDateLabel(value: unknown): string {
  if (typeof value !== 'string') {
    return String(value)
  }

  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}/${year}`
}

function getSeriesColor(first: StockHistoryPoint, last: StockHistoryPoint) {
  if (last.close > first.close) {
    return '#008f5a'
  }

  if (last.close < first.close) {
    return '#d93025'
  }

  return '#1c36be'
}

export default function LightweightStockChart({
  points,
  symbol,
  type = 'area',
}: LightweightStockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartData = useMemo(
    () =>
      points.map((point) => ({
        time: point.date,
        value: point.close,
      })),
    [points]
  )
  const first = points[0]
  const last = points.at(-1)
  const hasPoints = chartData.length > 0
  const seriesColor = first && last ? getSeriesColor(first, last) : '#1c36be'

  useEffect(() => {
    const container = containerRef.current

    if (!container || chartData.length === 0) {
      return
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: CHART_HEIGHT,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#334155',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.18)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.22)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(100, 116, 139, 0.22)',
        scaleMargins: {
          top: 0.12,
          bottom: 0.18,
        },
      },
      timeScale: {
        borderColor: 'rgba(100, 116, 139, 0.22)',
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: Time) => formatDateLabel(time),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(15, 23, 42, 0.36)',
          style: LineStyle.Solid,
          width: 1,
          labelBackgroundColor: '#334155',
        },
        horzLine: {
          color: 'rgba(15, 23, 42, 0.28)',
          style: LineStyle.Solid,
          width: 1,
          labelBackgroundColor: '#334155',
        },
      },
      localization: {
        priceFormatter: (price: number) => formatPriceLabel(price),
        timeFormatter: (time: Time) => formatDateLabel(time),
      },
      handleScroll: false,
      handleScale: false,
    })

    if (type === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: seriesColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      })

      lineSeries.setData(chartData as LineData[])
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: seriesColor,
        topColor: `${seriesColor}44`,
        bottomColor: `${seriesColor}00`,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      })

      areaSeries.setData(chartData as AreaData[])
    }

    chart.timeScale().fitContent()

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: CHART_HEIGHT,
      })
      chart.timeScale().fitContent()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [chartData, seriesColor, type])

  if (!hasPoints) {
    return (
      <div
        className="stock-history-chart stock-history-chart-empty"
        aria-label={`Histórico de ${symbol}`}
      >
        <div className="stock-history-chart-empty-state">
          Sin histórico disponible
        </div>
      </div>
    )
  }

  return (
    <div className="stock-history-chart" aria-label={`Histórico de ${symbol}`}>
      <div
        ref={containerRef}
        className="stock-history-lightweight-chart"
        role="img"
        aria-label={`Evolución del precio de cierre de ${symbol}`}
      />

      <div className="stock-history-chart-footer">
        <span className="stock-history-chart-footer-item">
          <span>Inicio</span>
          <strong>{first ? formatPriceLabel(first.close) : '-'}</strong>
        </span>
        <span className="stock-history-chart-footer-item stock-history-chart-footer-item-end">
          <span>Fin</span>
          <strong>{last ? formatPriceLabel(last.close) : '-'}</strong>
        </span>
      </div>
    </div>
  )
}
