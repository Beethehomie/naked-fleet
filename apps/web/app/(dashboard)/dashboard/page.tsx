"use client"
import TopBar from "@/components/layout/TopBar"
import {
  Car, CalendarCheck, AlertTriangle, Clock,
  DollarSign, CheckCircle, XCircle, TrendingUp, TrendingDown,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

// ── Mock data ──────────────────────────────────────────────────
const revenueData = [
  { month: "Nov", revenue: 42000 },
  { month: "Dec", revenue: 58000 },
  { month: "Jan", revenue: 51000 },
  { month: "Feb", revenue: 67000 },
  { month: "Mar", revenue: 73000 },
  { month: "Apr", revenue: 89000 },
]

const fleetData = [
  { name: "Available",   value: 14, color: "#30D158" },
  { name: "Rented",      value: 8,  color: "#0A84FF" },
  { name: "Maintenance", value: 3,  color: "#FF9F0A" },
  { name: "Reserved",    value: 2,  color: "#636366" },
]

const recentBookings = [
  { ref: "BK-2026-00041", customer: "James Mokoena",    vehicle: "Toyota Camry",    start: "21 Apr", end: "24 Apr", status: "ACTIVE" },
  { ref: "BK-2026-00040", customer: "Thandi Nkosi",     vehicle: "BMW 3 Series",    start: "20 Apr", end: "23 Apr", status: "CONFIRMED" },
  { ref: "BK-2026-00039", customer: "Sipho Dlamini",    vehicle: "Mercedes C-Class",start: "18 Apr", end: "21 Apr", status: "COMPLETED" },
  { ref: "BK-2026-00038", customer: "Lerato Molefe",    vehicle: "Range Rover",     start: "17 Apr", end: "20 Apr", status: "COMPLETED" },
  { ref: "BK-2026-00037", customer: "Andile Zulu",      vehicle: "Audi A4",         start: "15 Apr", end: "18 Apr", status: "COMPLETED" },
]

const statusBadge: Record<string, string> = {
  ACTIVE:    "badge-blue",
  CONFIRMED: "badge-green",
  COMPLETED: "badge-muted",
  PENDING:   "badge-yellow",
  CANCELLED: "badge-red",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-4 py-2.5 text-sm shadow-xl border"
      style={{
        backgroundColor: "var(--color-card)",
        borderColor: "var(--color-line)",
      }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>{label}</p>
      <p className="font-bold" style={{ color: "var(--color-text-accent)" }}>
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const totalFleet = fleetData.reduce((s, d) => s + d.value, 0)
  const utilisation = Math.round((fleetData.find(d => d.name === "Rented")?.value ?? 0) / totalFleet * 100)

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Dashboard" subtitle="Welcome back — here's what's happening today" />

      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-6">

        {/* ── KPI Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Monthly Revenue",
              value: formatCurrency(89000),
              change: "+21.9%",
              up: true,
              icon: DollarSign,
              accent: "var(--color-positive)",
            },
            {
              label: "Active Bookings",
              value: "8",
              change: "+2 today",
              up: true,
              icon: CalendarCheck,
              accent: "#5B9BF8",
            },
            {
              label: "Fleet Utilisation",
              value: `${utilisation}%`,
              change: "+5% vs last month",
              up: true,
              icon: Car,
              accent: "var(--color-positive)",
            },
            {
              label: "Held Deposits",
              value: formatCurrency(24500),
              change: "3 unresolved",
              up: false,
              icon: AlertTriangle,
              accent: "var(--color-warning)",
            },
          ].map(({ label, value, change, up, icon: Icon, accent }) => (
            <div key={label} className="stat-card">
              <div className="flex items-start justify-between gap-3">
                <p className="stat-label">{label}</p>
                <div
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
                >
                  <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
              </div>
              <p className="stat-value" style={{ color: accent }}>{value}</p>
              <div className="flex items-center gap-1 mt-1">
                {up
                  ? <TrendingUp  className="w-3 h-3" style={{ color: "var(--color-positive)" }} />
                  : <TrendingDown className="w-3 h-3" style={{ color: "var(--color-warning)" }} />
                }
                <span className="text-xs" style={{ color: up ? "var(--color-positive)" : "var(--color-warning)" }}>
                  {change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts row ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="col-span-2 card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="section-heading">Revenue Trend</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                  Last 6 months
                </p>
              </div>
              <span className="badge-green">+21.9% MoM</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#5B9BF8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5B9BF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R${v / 1000}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#5B9BF8"
                  strokeWidth={2}
                  fill="url(#areaGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Fleet donut */}
          <div className="card flex flex-col">
            <div className="mb-4">
              <h3 className="section-heading">Fleet Status</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                {totalFleet} vehicles total
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={fleetData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {fleetData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {utilisation}%
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>utilised</p>
              </div>
            </div>
            <div className="space-y-2 mt-2">
              {fleetData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span style={{ color: "var(--color-text-secondary)" }}>{d.name}</span>
                  </div>
                  <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom row ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-6">
          {/* Recent bookings */}
          <div className="col-span-2 card p-0 overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "var(--color-line)" }}
            >
              <h3 className="section-heading">Recent Bookings</h3>
              <a
                href="/bookings"
                className="text-xs hover:underline"
                style={{ color: "var(--color-text-accent)" }}
              >
                View all →
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Dates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map(b => (
                    <tr key={b.ref} className="clickable">
                      <td className="font-mono text-xs" style={{ color: "var(--color-text-accent)" }}>
                        {b.ref}
                      </td>
                      <td style={{ color: "var(--color-text-primary)" }}>{b.customer}</td>
                      <td>{b.vehicle}</td>
                      <td className="text-xs">{b.start} → {b.end}</td>
                      <td>
                        <span className={statusBadge[b.status] ?? "badge-muted"}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts */}
          <div className="card flex flex-col gap-3">
            <h3 className="section-heading">Alerts</h3>
            {[
              { icon: AlertTriangle, color: "var(--color-warning)",  bg: "rgba(251,191,36,0.1)",   msg: "2 vehicles compliance expiring in 7 days", time: "Today" },
              { icon: Clock,         color: "var(--color-negative)", bg: "rgba(248,113,113,0.1)",  msg: "BK-2026-00035 overdue by 2 days",         time: "2d ago" },
              { icon: DollarSign,    color: "#5B9BF8",               bg: "rgba(91,155,248,0.1)",   msg: "3 deposits pending resolution",            time: "Today" },
              { icon: CheckCircle,   color: "var(--color-positive)", bg: "rgba(52,211,153,0.1)",   msg: "Monthly supplier fees due today",          time: "1h ago" },
              { icon: XCircle,       color: "var(--color-negative)", bg: "rgba(248,113,113,0.1)",  msg: "Insurance policy expiring — VW Polo",     time: "3d ago" },
            ].map(({ icon: Icon, color, bg, msg, time }, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                style={{
                  backgroundColor: "var(--color-cp-muted)",
                  borderColor: "var(--color-line)",
                }}
              >
                <div
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: bg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug" style={{ color: "var(--color-text-primary)" }}>
                    {msg}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    {time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
