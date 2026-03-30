/**
 * 多折线图组件 — 支持多条线叠加，每条线独立颜色和标签
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'

export interface LineConfig {
  key: string
  label: string
  color: string
  unit?: string
}

interface MultiLineChartProps {
  data: Record<string, unknown>[]
  lines: LineConfig[]
  height?: number
  xKey?: string
  xFormatter?: (v: string) => string
  yDomain?: [number | 'auto', number | 'auto']
  referenceLines?: { value: number; label: string; color: string }[]
}

function defaultFmt(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function MultiLineChart({
  data,
  lines,
  height = 240,
  xKey = 'time',
  xFormatter,
  yDomain = [0, 'auto'],
  referenceLines = [],
}: MultiLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.06)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickFormatter={xFormatter ?? defaultFmt}
          interval="preserveStartEnd"
          tick={{ fill: '#7A90B3', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fill: '#7A90B3', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: '#0F1628',
            border: '1px solid #1E2D4A',
            borderRadius: '2px',
            fontSize: 11,
            color: '#E8F0FF',
          }}
          labelFormatter={(label: string) => (xFormatter ?? defaultFmt)(label)}
        />
        <Legend
          wrapperStyle={{ fontSize: 9, paddingTop: 8, color: '#7A90B3' }}
        />
        {referenceLines.map((rl) => (
          <ReferenceLine
            key={rl.label}
            y={rl.value}
            stroke={rl.color}
            strokeDasharray="5 4"
            label={{ value: rl.label, fill: rl.color, fontSize: 8 }}
          />
        ))}
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: l.color, stroke: 'none' }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
