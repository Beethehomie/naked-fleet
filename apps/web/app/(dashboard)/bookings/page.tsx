"use client"
import TopBar from "@/components/layout/TopBar"
import { Plus, Search, CalendarCheck, Clock, CheckCircle, XCircle, ChevronRight } from "lucide-react"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { useState } from "react"

const bookings = [
  { ref: "BK-2026-00041", customer: "James Mokoena",   vehicle: "Toyota Camry · GP 12 ABC",    start: "2026-04-21", end: "2026-04-24", days: 3, total: 2550,  deposit: 3000, status: "ACTIVE",    agent: "Thabo M." },
  { ref: "BK-2026-00040", customer: "Thandi Nkosi",    vehicle: "BMW 3 Series · GP 34 DEF",    start: "2026-04-20", end: "2026-04-23", days: 3, total: 4200,  deposit: 5000, status: "CONFIRMED", agent: "Sarah K." },
  { ref: "BK-2026-00039", customer: "Sipho Dlamini",   vehicle: "Mercedes C · GP 56 GHI",      start: "2026-04-18", end: "2026-04-21", days: 3, total: 4800,  deposit: 5000, status: "COMPLETED", agent: "Thabo M." },
  { ref: "BK-2026-00038", customer: "Lerato Molefe",   vehicle: "Range Rover · GP 90 MNO",     start: "2026-04-17", end: "2026-04-20", days: 3, total: 9600,  deposit: 8000, status: "COMPLETED", agent: "Sarah K." },
  { ref: "BK-2026-00037", customer: "Andile Zulu",     vehicle: "Audi A4 · GP 11 PQR",         start: "2026-04-15", end: "2026-04-18", days: 3, total: 3600,  deposit: 4000, status: "COMPLETED", agent: "Thabo M." },
  { ref: "BK-2026-00036", customer: "Nomsa Khumalo",   vehicle: "Ford Ranger · GP 22 STU",     start: "2026-04-22", end: "2026-04-25", days: 3, total: 2940,  deposit: 3500, status: "CONFIRMED", agent: "Sarah K." },
  { ref: "BK-2026-00035", customer: "Bongani Sithole", vehicle: "VW Polo · WC 33 VWX",         start: "2026-04-14", end: "2026-04-17", days: 3, total: 1860,  deposit: 2000, status: "CANCELLED", agent: "Thabo M." },
  { ref: "BK-2026-00034", customer: "Zanele Mokoena",  vehicle: "Toyota Camry · GP 12 ABC",    start: "2026-04-10", end: "2026-04-13", days: 3, total: 2550,  deposit: 3000, status: "COMPLETED", agent: "Sarah K." },
]

const statusConfig: Record<string, { badge: string; icon: any; label: string }> = {
  PENDING:   { badge: "badge-yellow", icon: Clock,         label: "Pending" },
  CONFIRMED: { badge: "badge-green",  icon: CheckCircle,   label: "Confirmed" },
  ACTIVE:    { badge: "badge-blue",   icon: CalendarCheck, label: "Active" },
  COMPLETED: { badge: "badge-muted",  icon: CheckCircle,   label: "Completed" },
  CANCELLED: { badge: "badge-red",    icon: XCircle,       label: "Cancelled" },
}

const FILTERS = ["All", "Active", "Confirmed", "Pending", "Completed", "Cancelled"]

export default function BookingsPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")

  const filtered = bookings.filter(b => {
    const matchSearch = `${b.ref} ${b.customer} ${b.vehicle}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "All" || b.status === filter.toUpperCase()
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Bookings" subtitle="Manage the full customer rental lifecycle" />

      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Active",    count: bookings.filter(b => b.status === "ACTIVE").length,    accent: "#5B9BF8" },
            { label: "Confirmed", count: bookings.filter(b => b.status === "CONFIRMED").length, accent: "var(--color-positive)" },
            { label: "Pending",   count: bookings.filter(b => b.status === "PENDING").length,   accent: "var(--color-warning)" },
            { label: "Today",     count: 3,                                                       accent: "var(--color-text-secondary)" },
          ].map(s => (
            <div
              key={s.label}
              className="card flex items-center justify-between"
            >
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {s.label}
              </span>
              <span className="text-2xl font-bold" style={{ color: s.accent }}>
                {s.count}
              </span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
                style={
                  filter === f
                    ? {
                        backgroundColor: "var(--color-cp-muted)",
                        color: "var(--color-text-accent)",
                        border: "1px solid var(--color-text-accent)",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-line)",
                      }
                }
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--color-placeholder)" }}
              />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search bookings..."
                className="input pl-9 w-56 py-2"
              />
            </div>
            <button className="btn-primary">
              <Plus className="w-4 h-4" />
              New Booking
            </button>
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-[14px] border overflow-hidden"
          style={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Dates</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Deposit</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const st = statusConfig[b.status]
                  const Icon = st.icon
                  return (
                    <tr key={b.ref} className="clickable">
                      <td className="font-mono text-xs" style={{ color: "var(--color-text-accent)" }}>
                        {b.ref}
                      </td>
                      <td className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {b.customer}
                      </td>
                      <td>{b.vehicle}</td>
                      <td className="text-xs whitespace-nowrap">
                        {formatDate(b.start)} → {formatDate(b.end)}
                        <span className="ml-1" style={{ color: "var(--color-placeholder)" }}>
                          ({b.days}d)
                        </span>
                      </td>
                      <td className="text-right font-semibold font-mono" style={{ color: "var(--color-text-primary)" }}>
                        {formatCurrency(b.total)}
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(b.deposit)}
                      </td>
                      <td>{b.agent}</td>
                      <td>
                        <span className={cn("badge", st.badge)}>
                          <Icon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <ChevronRight
                          className="w-4 h-4 transition-colors"
                          style={{ color: "var(--color-text-secondary)" }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-20"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <CalendarCheck className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No bookings found</p>
            </div>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <div
              className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 border-t text-sm"
              style={{
                borderColor: "var(--color-line)",
                color: "var(--color-text-secondary)",
              }}
            >
              <span>1–{filtered.length} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button className="page-btn">‹</button>
                <button className="page-btn active">1</button>
                <button className="page-btn">›</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
