/**
 * 实时滚动折线图（设计稿 8.3 节）
 *
 * 最多 60 个数据点，渐变面积填充，无数据点圆圈，accent 色主线。
 *
 * Props:
 *   data       时间序列数据 [{time: string, value: number}]
 *   color      线/面积颜色（默认 accent #00D4FF）
 *   height     图表高度（默认 120px）
 *   yDomain    Y 轴范围（默认 auto）
 *   title      左上角可选标题
 */
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface DataPoint {
  time: string
  value: number
}

interface RealtimeChartProps {
  data: DataPoint[]
  color?: string
  height?: number
  yDomain?: [number | 'auto', number | 'auto']
  title?: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${mm}:${ss}`
}

const GRADIENT_ID = 'realtimeAreaGradient'

export function RealtimeChart({
  data,
  color = '#00D4FF',
  height = 120,
  yDomain = [0, 'auto'],
  title,
}: RealtimeChartProps) {
  const visible = data.slice(-60)

  return (
    <div className="flex flex-col gap-1">
      {title && (
        <span className="text-[10px] font-medium tracking-widest text-text-secondary uppercase">
          {title}
        </span>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={visible} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          {/* 渐变：accent → transparent */}
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(0,212,255,0.08)"
            vertical={false}
          />

          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            interval={9}
            tick={{ fill: '#7A90B3', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            domain={yDomain}
            tick={{ fill: '#7A90B3', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />

          <Tooltip
            contentStyle={{
              background: '#0F1628',
              border: '1px solid #1E2D4A',
              borderRadius: '2px',
              fontSize: 11,
              color: '#E8F0FF',
            }}
            labelFormatter={(label: string) => formatTime(label)}
            formatter={(value: number) => [value, '车辆数']}
            cursor={{ stroke: 'rgba(0,212,255,0.2)', strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${GRADIENT_ID})`}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: 'none' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
