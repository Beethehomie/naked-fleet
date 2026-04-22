"use client"
import TopBar from "@/components/layout/TopBar"
import { Plus, Search, Users, CheckCircle, XCircle, ChevronRight, Phone, Mail } from "lucide-react"
import { cn, formatDate, formatCurrency, initials } from "@/lib/utils"
import { useState } from "react"

const customers = [
  { id: "1", firstName: "James",   lastName: "Mokoena",  email: "james@email.com",   phone: "+27 82 111 2222", status: "ACTIVE",      bookings: 7,  totalSpend: 42500, licenceExpiry: "2027-06-15", canRent: true  },
  { id: "2", firstName: "Thandi",  lastName: "Nkosi",    email: "thandi@email.com",  phone: "+27 83 333 4444", status: "ACTIVE",      bookings: 4,  totalSpend: 24800, licenceExpiry: "2026-03-20", canRent: false },
  { id: "3", firstName: "Sipho",   lastName: "Dlamini",  email: "sipho@email.com",   phone: "+27 84 555 6666", status: "ACTIVE",      bookings: 12, totalSpend: 87600, licenceExpiry: "2028-11-30", canRent: true  },
  { id: "4", firstName: "Lerato",  lastName: "Molefe",   email: "lerato@email.com",  phone: "+27 85 777 8888", status: "ACTIVE",      bookings: 3,  totalSpend: 18400, licenceExpiry: "2027-09-10", canRent: true  },
  { id: "5", firstName: "Andile",  lastName: "Zulu",     email: "andile@email.com",  phone: "+27 71 999 0000", status: "ACTIVE",      bookings: 9,  totalSpend: 61200, licenceExpiry: "2026-12-05", canRent: true  },
  { id: "6", firstName: "Nomsa",   lastName: "Khumalo",  email: "nomsa@email.com",   phone: "+27 72 111 3333", status: "ACTIVE",      bookings: 2,  totalSpend: 9800,  licenceExpiry: "2027-04-22", canRent: true  },
  { id: "7", firstName: "Bongani", lastName: "Sithole",  email: "bongani@email.com", phone: "+27 73 444 5555", status: "BLACKLISTED", bookings: 1,  totalSpend: 4200,  licenceExpiry: "2025-01-10", canRent: false },
  { id: "8", firstName: "Zanele",  lastName: "Mokoena",  email: "zanele@email.com",  phone: "+27 74 666 7777", status: "ACTIVE",      bookings: 6,  totalSpend: 38700, licenceExpiry: "2028-08-15", canRent: true  },
]

const statusConfig: Record<string, { badge: string; label: string }> = {
  ACTIVE:      { badge: "badge-green", label: "Active" },
  INACTIVE:    { badge: "badge-muted", label: "Inactive" },
  BLACKLISTED: { badge: "badge-red",   label: "Blacklisted" },
}

const FILTERS = ["All", "Active", "Inactive", "Blacklisted"]

const AVATAR_COLORS = ["#1D4ED8", "#2E86C1", "#1A5276", "#5B9BF8", "#0369A1", "#0E7490"]

export default function CustomersPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")

  const filtered = customers.filter(c => {
    const matchSearch = `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "All" || c.status === filter.toUpperCase()
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Customers" subtitle={`${customers.length} registered customers`} />

      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total",       count: customers.length,                                          accent: "var(--color-text-secondary)" },
            { label: "Active",      count: customers.filter(c => c.status === "ACTIVE").length,       accent: "var(--color-positive)" },
            { label: "Can Rent",    count: customers.filter(c => c.canRent).length,                   accent: "#5B9BF8" },
            { label: "Blacklisted", count: customers.filter(c => c.status === "BLACKLISTED").length,  accent: "var(--color-negative)" },
          ].map(s => (
            <div key={s.label} className="card flex items-center justify-between">
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
                className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all"
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
                placeholder="Search customers..."
                className="input pl-9 w-56 py-2"
              />
            </div>
            <button className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Customer
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
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Bookings</th>
                  <th className="text-right">Total Spend</th>
                  <th>Licence Expiry</th>
                  <th>Can Rent</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  const st = statusConfig[c.status]
                  const licenceExpired = new Date(c.licenceExpiry) < new Date()
                  const isBlacklisted = c.status === "BLACKLISTED"

                  return (
                    <tr
                      key={c.id}
                      className={cn("clickable", isBlacklisted && "flagged")}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials(c.firstName, c.lastName)}
                          </div>
                          <p className="font-medium text-sm" style={{ color: "var(--color-text-primary)" }}>
                            {c.firstName} {c.lastName}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {c.email}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {c.phone}
                          </div>
                        </div>
                      </td>
                      <td className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {c.bookings}
                      </td>
                      <td className="text-right font-semibold font-mono" style={{ color: "var(--color-positive)" }}>
                        {formatCurrency(c.totalSpend)}
                      </td>
                      <td>
                        <span
                          className="text-xs"
                          style={{ color: licenceExpired ? "var(--color-negative)" : "var(--color-text-secondary)" }}
                        >
                          {formatDate(c.licenceExpiry)}
                          {licenceExpired && " ⚠️"}
                        </span>
                      </td>
                      <td>
                        {c.canRent
                          ? <span className="badge-green"><CheckCircle className="w-3 h-3" />Yes</span>
                          : <span className="badge-red"><XCircle className="w-3 h-3" />No</span>
                        }
                      </td>
                      <td><span className={st.badge}>{st.label}</span></td>
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
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No customers found</p>
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
