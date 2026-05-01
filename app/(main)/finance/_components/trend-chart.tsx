"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

export type TrendPoint = {
  month: string // "2026-01"
  label: string // "gen"
  revenue: number
  expenses: number
}

export function FinanceTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#94A3B8"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94A3B8"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `€${Math.round(v / 1000)}k`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              fontSize: 12,
            }}
            formatter={(v) =>
              "€ " + Math.round(Number(v) || 0).toLocaleString("it-IT")
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6366F1"
            strokeWidth={2.5}
            fill="url(#rev)"
            name="Entrate"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="#F43F5E"
            strokeWidth={2.5}
            fill="url(#exp)"
            name="Spese"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
