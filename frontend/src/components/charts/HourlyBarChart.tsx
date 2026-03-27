/**
 * 小时双轴图（设计稿 9.1 节）
 *
 * 左轴：过车量（柱状，accent 色）
 * 右轴：预警次数（折线，alert-l4 色）
 *
 * Props:
 *   data    HourlyStatisticsItem[] 数组（由 History 页转换后传入）
 *   height  图表高度（默认 260px）
 */
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { HourlyStatisticsItem } from '@/types/api'

interface HourlyBarChartProps {
  data: HourlyStatisticsItem[]
  height?: number
}

const ACCENT = '#00D4FF'
const DANGER = '#F44336'

function formatHourLabel(isoStr: string): string {
  const d = new Date(isoStr)
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  return `${mo}/${dd} ${hh}:00`
}

function formatShortLabel(isoStr: string): string {
  const d = new Date(isoStr)
  const hh = d.getHours().toString().padStart(2, '0')
  return `${hh}:00`
}

export function HourlyBarChart({ data, height = 260 }: HourlyBarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-sm border border-dashed border-[#1E2D4A]"
        style={{ height }}
      >
        <p className="text-xs text-text-secondary/40">暂无数据</p>
      </div>
    )
  }

  // 超过 48 条数据时简化 X 轴标签
  const useShorter = data.length <= 48
  const tickFormatter = useShorter ? formatShortLabel : formatHourLabel

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 40, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.07)" vertical={false} />

        <XAxis
          dataKey="hour_at"
          tickFormatter={tickFormatter}
          interval={Math.max(0, Math.floor(data.length / 12) - 1)}
          tick={{ fill: '#7A90B3', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
        />

        {/* 左轴：过车量 */}
        <YAxis
          yAxisId="left"
          tick={{ fill: '#7A90B3', fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />

        {/* 右轴：预警次数 */}
        <YAxis
          yAxisId="right"
          orientation="right"
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
          labelFormatter={(v: string) => formatHourLabel(v)}
          formatter={(value: number, name: string) => [
            value,
            name === 'total_passed' ? '过车量' : '预警次数',
          ]}
          cursor={{ fill: 'rgba(0,212,255,0.04)' }}
        />

        <Legend
          iconSize={8}
          iconType="square"
          wrapperStyle={{ fontSize: 10, color: '#7A90B3' }}
          formatter={(v: string) => (v === 'total_passed' ? '过车量' : '预警次数')}
        />

        {/* 过车量柱状 */}
        <Bar
          yAxisId="left"
          dataKey="total_passed"
          fill={ACCENT}
          fillOpacity={0.6}
          radius={[2, 2, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />

        {/* 预警次数折线 */}
        <Line
          yAxisId="right"
          dataKey="alert_count"
          stroke={DANGER}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: DANGER, stroke: 'none' }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
