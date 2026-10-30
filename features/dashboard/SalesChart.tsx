import { dashboardINR } from './money'
import type { TrendDay } from './api'
import { t } from './messages'

const WIDTH = 640
const HEIGHT = 230
const LEFT = 46
const RIGHT = 8
const TOP = 12
const BOTTOM = 28

/** ₹1,200 -> "₹1.2k", ₹250,000 -> "₹2.5L": short enough for an axis. */
function compactRupees(paise: number): string {
  const rupees = paise / 100
  if (rupees >= 100_000) return `₹${Number((rupees / 100_000).toFixed(1))}L`
  if (rupees >= 1000) return `₹${Number((rupees / 1000).toFixed(1))}k`
  return `₹${Math.round(rupees)}`
}

/** A "nice" top for the axis (1, 2, 2.5, 5 or 10 times a power of ten) so the grid lines read as round numbers. */
function niceMax(paise: number): number {
  if (paise <= 0) return 100_000
  const magnitude = 10 ** Math.floor(Math.log10(paise))
  const step = [1, 2, 2.5, 5, 10].find(factor => factor * magnitude >= paise) ?? 10
  return step * magnitude
}

const dayLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** Sales per day as bars, today highlighted. Plain SVG: no chart library, no extra browser code. */
export function SalesChart({ days }: { days: TrendDay[] }) {
  const max = niceMax(Math.max(...days.map(day => day.revenuePaise), 0))
  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const slot = plotWidth / days.length
  const barWidth = Math.min(28, slot * 0.62)
  const grid = [0, 0.5, 1]
  const labelled = new Set([0, Math.floor(days.length / 2), days.length - 1])
  const summary = days.map(day => `${dayLabel(day.date)}: ${dashboardINR(day.revenuePaise)}, ${t(day.orders === 1 ? 'ordersOne' : 'ordersMany', { count: day.orders })}`).join('; ')
  return <svg className="sales-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${t('salesChartLabel')}. ${summary}`}>
    {grid.map(fraction => {
      const y = TOP + plotHeight * (1 - fraction)
      return <g key={fraction}>
        <line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} className="chart-grid" />
        <text x={LEFT - 8} y={y + 4} textAnchor="end" className="chart-axis">{compactRupees(max * fraction)}</text>
      </g>
    })}
    {days.map((day, index) => {
      const height = Math.max(day.revenuePaise > 0 ? 2 : 0, (day.revenuePaise / max) * plotHeight)
      const x = LEFT + slot * index + (slot - barWidth) / 2
      const isToday = index === days.length - 1
      return <g key={day.date}>
        <rect x={x} y={TOP + plotHeight - height} width={barWidth} height={height} rx={3} className={isToday ? 'chart-bar is-today' : 'chart-bar'}>
          <title>{`${dayLabel(day.date)}: ${dashboardINR(day.revenuePaise)} · ${t(day.orders === 1 ? 'ordersOne' : 'ordersMany', { count: day.orders })}`}</title>
        </rect>
        {labelled.has(index) && <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="chart-axis">{dayLabel(day.date)}</text>}
      </g>
    })}
  </svg>
}
