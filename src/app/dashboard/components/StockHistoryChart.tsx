import { useMemo, useState, type PointerEvent } from 'react'
import { type StockHistoryPoint } from '@/lib/stockHistory'
import { formatMoney, formatSignedPercent } from '@/lib/formatters'

type StockHistoryChartProps = {
  points: StockHistoryPoint[]
  symbol: string
}

const WIDTH = 640
const HEIGHT = 220
const PADDING_X = 34
const PADDING_TOP = 14
const PADDING_BOTTOM = 24
const CURVE_TENSION = 0.22

function getY(value: number, min: number, max: number): number {
  if (max === min) {
    return HEIGHT / 2
  }

  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const ratio = (value - min) / (max - min)

  return HEIGHT - PADDING_BOTTOM - ratio * chartHeight
}

function getX(index: number, count: number): number {
  if (count <= 1) {
    return WIDTH / 2
  }

  const chartWidth = WIDTH - PADDING_X * 2

  return PADDING_X + (index / (count - 1)) * chartWidth
}

function getPointCoordinates(
  points: StockHistoryPoint[],
  min: number,
  max: number
) {
  return points.map((point, index) => ({
    point,
    x: getX(index, points.length),
    y: getY(point.close, min, max),
  }))
}

function buildSmoothPath(
  points: StockHistoryPoint[],
  min: number,
  max: number
): string {
  const coordinates = getPointCoordinates(points, min, max)
  const first = coordinates[0]

  if (!first) {
    return ''
  }

  if (coordinates.length === 1) {
    return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  }

  return coordinates.slice(1).reduce((path, point, index) => {
    const previous = coordinates[index]
    const controlOffset = (point.x - previous.x) * CURVE_TENSION

    return `${path} C ${(previous.x + controlOffset).toFixed(2)} ${previous.y.toFixed(
      2
    )}, ${(point.x - controlOffset).toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(
      2
    )} ${point.y.toFixed(2)}`
  }, `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`)
}

function buildAreaPath(
  points: StockHistoryPoint[],
  min: number,
  max: number
): string {
  const linePath = buildSmoothPath(points, min, max)
  const coordinates = getPointCoordinates(points, min, max)
  const first = coordinates[0]
  const last = coordinates.at(-1)
  const baseline = HEIGHT - PADDING_BOTTOM

  if (!linePath || !first || !last) {
    return ''
  }

  return [
    linePath,
    `L ${last.x.toFixed(2)} ${baseline.toFixed(2)}`,
    `L ${first.x.toFixed(2)} ${baseline.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function getTrendClass(first: StockHistoryPoint, last: StockHistoryPoint): string {
  if (last.close > first.close) {
    return 'stock-history-chart-positive'
  }

  if (last.close < first.close) {
    return 'stock-history-chart-negative'
  }

  return 'stock-history-chart-neutral'
}

function getGradientId(symbol: string): string {
  return `stock-history-gradient-${symbol.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function getGridLines(min: number, max: number): number[] {
  if (min === max) {
    return [min]
  }

  return [min, min + (max - min) / 2, max]
}

function formatPriceLabel(value: number): string {
  return formatMoney(value).replace(',00', '')
}

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}/${year}`
}

function getVariationFromStart(
  first: StockHistoryPoint | undefined,
  point: StockHistoryPoint | undefined
): number | null {
  if (!first || !point || first.close === 0) {
    return null
  }

  return ((point.close - first.close) / first.close) * 100
}

function getTooltipPlacementClass(x: number, y: number): string {
  const classes: string[] = []

  if (y < PADDING_TOP + 72) {
    classes.push('stock-history-chart-tooltip-bottom')
  }

  if (x < PADDING_X + 60) {
    classes.push('stock-history-chart-tooltip-start')
  }

  if (x > WIDTH - PADDING_X - 60) {
    classes.push('stock-history-chart-tooltip-end')
  }

  return classes.join(' ')
}

function getNearestPointIndex(
  clientX: number,
  svg: SVGSVGElement,
  coordinates: ReturnType<typeof getPointCoordinates>
): number | null {
  if (coordinates.length === 0) {
    return null
  }

  const rect = svg.getBoundingClientRect()
  const svgX = ((clientX - rect.left) / rect.width) * WIDTH
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  coordinates.forEach((coordinate, index) => {
    const distance = Math.abs(coordinate.x - svgX)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

export default function StockHistoryChart({
  points,
  symbol,
}: StockHistoryChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const closeValues = useMemo(() => points.map((point) => point.close), [points])
  const hasPoints = closeValues.length > 0
  const min = hasPoints ? Math.min(...closeValues) : 0
  const max = hasPoints ? Math.max(...closeValues) : 0
  const first = points[0]
  const last = points.at(-1)
  const path = useMemo(() => buildSmoothPath(points, min, max), [max, min, points])
  const areaPath = useMemo(() => buildAreaPath(points, min, max), [max, min, points])
  const coordinates = useMemo(
    () => getPointCoordinates(points, min, max),
    [max, min, points]
  )
  const activeCoordinate =
    activeIndex === null ? null : coordinates[activeIndex] ?? null
  const activeVariation = getVariationFromStart(first, activeCoordinate?.point)
  const trendClass = first && last ? getTrendClass(first, last) : ''
  const gradientId = getGradientId(symbol)

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    setActiveIndex(
      getNearestPointIndex(event.clientX, event.currentTarget, coordinates)
    )
  }

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
    <div
      className={`stock-history-chart ${trendClass}`.trim()}
      aria-label={`Histórico de ${symbol}`}
    >
      <div className="stock-history-chart-plot">
        <svg
          className="stock-history-chart-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Evolución del precio de cierre de ${symbol}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" className="stock-history-chart-gradient-start" />
              <stop offset="100%" className="stock-history-chart-gradient-end" />
            </linearGradient>
          </defs>

          {getGridLines(min, max).map((value) => (
            <line
              key={value}
              x1={PADDING_X}
              y1={getY(value, min, max)}
              x2={WIDTH - PADDING_X}
              y2={getY(value, min, max)}
              className="stock-history-chart-grid"
            />
          ))}

          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
              className="stock-history-chart-area"
            />
          )}

          <path d={path} className="stock-history-chart-line" />

          {last && (
            <circle
              cx={getX(points.length - 1, points.length)}
              cy={getY(last.close, min, max)}
              r="2.6"
              className="stock-history-chart-point"
            />
          )}

          {activeCoordinate && (
            <>
              <line
                x1={activeCoordinate.x}
                y1={PADDING_TOP}
                x2={activeCoordinate.x}
                y2={HEIGHT - PADDING_BOTTOM}
                className="stock-history-chart-crosshair"
              />
              <circle
                cx={activeCoordinate.x}
                cy={activeCoordinate.y}
                r="3.4"
                className="stock-history-chart-hover-point"
              />
            </>
          )}
        </svg>

        {activeCoordinate && (
          <div
            className={`stock-history-chart-tooltip ${getTooltipPlacementClass(
              activeCoordinate.x,
              activeCoordinate.y
            )}`.trim()}
            style={{
              left: `${(activeCoordinate.x / WIDTH) * 100}%`,
              top: `${(activeCoordinate.y / HEIGHT) * 100}%`,
            }}
          >
            <span className="stock-history-chart-tooltip-date">
              {formatDateLabel(activeCoordinate.point.date)}
            </span>
            <span className="stock-history-chart-tooltip-price">
              {formatPriceLabel(activeCoordinate.point.close)}
            </span>
            <span className="stock-history-chart-tooltip-var">
              {formatSignedPercent(activeVariation)}
            </span>
          </div>
        )}
      </div>

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
