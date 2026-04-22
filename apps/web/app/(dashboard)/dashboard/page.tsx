"use client"
import TopBar from "@/components/layout/TopBar"
import {
  Car, CalendarCheck, Users, TrendingUp, TrendingDown,
  AlertTriangle, Clock, DollarSign, CheckCircle, XCircle,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

// ── Mock data (replace with real API calls) ────────────────────
const revenueData = [
  { month: "Nov", revenue: 42000 },
  { month: "Dec", revenue: 58000 },
  { month: "Jan", revenue: 51000 },
  { month: "Feb", revenue: 67000 },
  { month: "Mar", revenue: 73000 },
  { month: "Apr", revenue: 89000 },
]

const fleetData = [
  { name: "Available",  value: 14, color: "#00E676" },
  { name: "Rented",     value: 8,  color: "#2979FF" },
  { name: "Maintenance",value: 3,  color: "#FFB300" },
  { name: "Reserved",   value: 2,  color: "#A0A0A0" },
]

const recentBookings = [
  { ref: "BK-2026-00041", customer: "James Mokoena",   vehicle: "Toyota Camry",   start: "21 Apr", end: "24 Apr", status: "ACTIVE" },
  { ref: "BK-2026-00040", customer: "Thandi Nkosi",    vehicle: "BMW 3 Series",   start: "20 Apr", end: "23 Apr", status: "CONFIRMED" },
  { ref: "BK-2026-00039", customer: "Sipho Dlamini",   vehicle: "Mercedes C-Class",start:"18 Apr", end: "21 Apr", status: "COMPLETED" },
  { ref: "BK-2026-00038", customer: "Lerato Molefe",   vehicle: "Range Rover",    start: "17 Apr", end: "20 Apr", status: "COMPLETED" },
  { ref: "BK-2026-00037", customer: "Andile Zulu",     vehicle: "Audi A4",        start: "15 Apr", end: "18 Apr", status: "COMPLETED" },
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
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm shadow-xl">
      <p className="text-[#A0A0A0] mb-1">{label}</p>
      <p className="text-[#00E676] font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function DashboardPage() {
  const totalFleet = fleetData.reduce((s, d) => s + d.value, 0)
  const utilisation = Math.round((fleetData.find(d => d.name === "Rented")?.value ?? 0) / totalFleet * 100)

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Dashboard" subtitle="Welcome back — here's what's happening today" />

      <div className="p-6 space-y-6 animate-[fade-in_0.3s_ease-out]">

        {/* ── KPI Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Monthly Revenue",
              value: formatCurrency(89000),
              change: "+21.9%",
              up: true,
              icon: DollarSign,
              color: "#00E676",
            },
            {
              label: "Active Bookings",
              value: "8",
              change: "+2 today",
              up: true,
              icon: CalendarCheck,
              color: "#2979FF",
            },
            {
              label: "Fleet Utilisation",
              value: `${utilisation}%`,
              change: "+5% vs last month",
              up: true,
              icon: Car,
              color: "#00E676",
            },
            {
              label: "Held Deposits",
              value: formatCurrency(24500),
              change: "3 unresolved",
              up: false,
              icon: AlertTriangle,
              color: "#FFB300",
            },
          ].map(({ label, value, change, up, icon: Icon, color }) => (
            <div key={label} className="stat-card group hover:border-[#3A3A3A] transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-label">{label}</p>
                  <p className="stat-value mt-1">{value}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                {up ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#00E676]" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-yellow-400" />
                )}
                <span className={`text-xs font-medium ${up ? "text-[#00E676]" : "text-yellow-400"}`}>
                  {change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts row ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {/* Revenue chart */}
          <div className="col-span-2 card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-semibold">Revenue Trend</h3>
                <p className="text-[#606060] text-xs mt-0.5">Last 6 months</p>
              </div>
              <span className="badge-green">+21.9% MoM</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00E676" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis dataKey="month" tick={{ fill: "#606060", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#606060", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `R${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#00E676" strokeWidth={2} fill="url(#greenGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Fleet donut */}
          <div className="card flex flex-col">
            <div className="mb-4">
              <h3 className="text-white font-semibold">Fleet Status</h3>
              <p className="text-[#606060] text-xs mt-0.5">{totalFleet} vehicles total</p>
            </div>
            <div className="flex-1 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={fleetData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {fleetData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-white">{utilisation}%</p>
                <p className="text-[#606060] text-xs">utilised</p>
              </div>
            </div>
            <div className="space-y-2 mt-2">
              {fleetData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-[#A0A0A0]">{d.name}</span>
                  </div>
                  <span className="text-white font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom row ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recent bookings */}
          <div className="col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Recent Bookings</h3>
              <a href="/bookings" className="text-[#00E676] text-xs hover:underline">View all →</a>
            </div>
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
                  <tr key={b.ref}>
                    <td className="font-mono text-[#00E676] text-xs">{b.ref}</td>
                    <td>{b.customer}</td>
                    <td className="text-[#A0A0A0]">{b.vehicle}</td>
                    <td className="text-[#A0A0A0] text-xs">{b.start} → {b.end}</td>
                    <td><span className={statusBadge[b.status] ?? "badge-muted"}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alerts */}
          <div className="card flex flex-col gap-3">
            <h3 className="text-white font-semibold">Alerts</h3>
            {[
              { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", msg: "2 vehicles compliance expiring in 7 days", time: "Today" },
              { icon: Clock,         color: "text-red-400",    bg: "bg-red-500/10",    msg: "BK-2026-00035 overdue by 2 days",         time: "2d ago" },
              { icon: DollarSign,    color: "text-blue-400",   bg: "bg-blue-500/10",   msg: "3 deposits pending resolution",            time: "Today" },
              { icon: CheckCircle,   color: "text-[#00E676]",  bg: "bg-[#00E676]/10",  msg: "Monthly supplier fees due today",          time: "1h ago" },
              { icon: XCircle,       color: "text-red-400",    bg: "bg-red-500/10",    msg: "Insurance policy expiring — VW Polo",     time: "3d ago" },
            ].map(({ icon: Icon, color, bg, msg, time }, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors cursor-pointer">
                <div className={`p-1.5 rounded-lg ${bg} flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs leading-snug">{msg}</p>
                  <p className="text-[#606060] text-xs mt-1">{time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
