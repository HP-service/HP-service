"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"

export type ForecastPoint = {
  month: string
  label: string
  revenue: number
  occupancy: number
  adr: number
  revpar: number
}

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  // Recharts vuole occupancy in 0..100 per la visualizzazione
  const display = data.map((d) => ({
    ...d,
    occupancyPct: Math.round(d.occupancy * 100),
  }))

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={display} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${Math.round(Number(v) / 1000)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(v, name) => {
              if (name === "Revenue") return ["€ " + Math.round(Number(v) || 0).toLocaleString("it-IT"), name]
              if (name === "Occupancy") return [v + "%", name]
              return [v, name]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
          />
          <Bar
            yAxisId="left"
            dataKey="revenue"
            name="Revenue"
            fill="url(#barGradient)"
            radius={[8, 8, 0, 0]}
            barSize={48}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="occupancyPct"
            name="Occupancy"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ fill: "#10b981", r: 5 }}
          />
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
