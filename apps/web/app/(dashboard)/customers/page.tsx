"use client"
import TopBar from "@/components/layout/TopBar"
import { Plus, Search, Users, CheckCircle, AlertTriangle, XCircle, ChevronRight, Phone, Mail } from "lucide-react"
import { cn, formatDate, formatCurrency, initials } from "@/lib/utils"
import { useState } from "react"

const customers = [
  { id: "1", firstName: "James",   lastName: "Mokoena",  email: "james@email.com",   phone: "+27 82 111 2222", status: "ACTIVE",     bookings: 7,  totalSpend: 42500, licenceExpiry: "2027-06-15", canRent: true  },
  { id: "2", firstName: "Thandi",  lastName: "Nkosi",    email: "thandi@email.com",  phone: "+27 83 333 4444", status: "ACTIVE",     bookings: 4,  totalSpend: 24800, licenceExpiry: "2026-03-20", canRent: false },
  { id: "3", firstName: "Sipho",   lastName: "Dlamini",  email: "sipho@email.com",   phone: "+27 84 555 6666", status: "ACTIVE",     bookings: 12, totalSpend: 87600, licenceExpiry: "2028-11-30", canRent: true  },
  { id: "4", firstName: "Lerato",  lastName: "Molefe",   email: "lerato@email.com",  phone: "+27 85 777 8888", status: "ACTIVE",     bookings: 3,  totalSpend: 18400, licenceExpiry: "2027-09-10", canRent: true  },
  { id: "5", firstName: "Andile",  lastName: "Zulu",     email: "andile@email.com",  phone: "+27 71 999 0000", status: "ACTIVE",     bookings: 9,  totalSpend: 61200, licenceExpiry: "2026-12-05", canRent: true  },
  { id: "6", firstName: "Nomsa",   lastName: "Khumalo",  email: "nomsa@email.com",   phone: "+27 72 111 3333", status: "ACTIVE",     bookings: 2,  totalSpend: 9800,  licenceExpiry: "2027-04-22", canRent: true  },
  { id: "7", firstName: "Bongani", lastName: "Sithole",  email: "bongani@email.com", phone: "+27 73 444 5555", status: "BLACKLISTED",bookings: 1,  totalSpend: 4200,  licenceExpiry: "2025-01-10", canRent: false },
  { id: "8", firstName: "Zanele",  lastName: "Mokoena",  email: "zanele@email.com",  phone: "+27 74 666 7777", status: "ACTIVE",     bookings: 6,  totalSpend: 38700, licenceExpiry: "2028-08-15", canRent: true  },
]

const statusConfig: Record<string, { badge: string; label: string }> = {
  ACTIVE:      { badge: "badge-green",  label: "Active" },
  INACTIVE:    { badge: "badge-muted",  label: "Inactive" },
  BLACKLISTED: { badge: "badge-red",    label: "Blacklisted" },
}

const FILTERS = ["All", "Active", "Inactive", "Blacklisted"]

// Avatar colour pool
const AVATAR_COLORS = ["#00E676", "#2979FF", "#FFB300", "#FF4081", "#7C4DFF", "#00BCD4"]

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

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",       count: customers.length,                                               color: "#A0A0A0" },
            { label: "Active",      count: customers.filter(c => c.status === "ACTIVE").length,            color: "#00E676" },
            { label: "Can Rent",    count: customers.filter(c => c.canRent).length,                        color: "#2979FF" },
            { label: "Blacklisted", count: customers.filter(c => c.status === "BLACKLISTED").length,       color: "#FF1744" },
          ].map(s => (
            <div key={s.label} className="card-elevated flex items-center justify-between">
              <span className="text-[#A0A0A0] text-sm">{s.label}</span>
              <span className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                  filter === f
                    ? "bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20"
                    : "text-[#A0A0A0] hover:text-white border border-transparent hover:border-[#2A2A2A]"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="input pl-9 w-56 text-sm py-2"
              />
            </div>
            <button className="btn-primary flex items-center gap-2 py-2 text-sm">
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Bookings</th>
                <th>Total Spend</th>
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
                return (
                  <tr key={c.id} className="cursor-pointer">
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                          style={{ background: avatarColor }}
                        >
                          {initials(c.firstName, c.lastName)}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{c.firstName} {c.lastName}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[#A0A0A0] text-xs">
                          <Mail className="w-3 h-3" />{c.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-[#A0A0A0] text-xs">
                          <Phone className="w-3 h-3" />{c.phone}
                        </div>
                      </div>
                    </td>
                    <td className="text-white font-semibold">{c.bookings}</td>
                    <td className="text-[#00E676] font-semibold">{formatCurrency(c.totalSpend)}</td>
                    <td>
                      <span className={cn("text-xs", licenceExpired ? "text-red-400" : "text-[#A0A0A0]")}>
                        {formatDate(c.licenceExpiry)}
                        {licenceExpired && " ⚠️"}
                      </span>
                    </td>
                    <td>
                      {c.canRent ? (
                        <span className="badge-green"><CheckCircle className="w-3 h-3" />Yes</span>
                      ) : (
                        <span className="badge-red"><XCircle className="w-3 h-3" />No</span>
                      )}
                    </td>
                    <td><span className={st.badge}>{st.label}</span></td>
                    <td>
                      <ChevronRight className="w-4 h-4 text-[#606060] hover:text-[#00E676] transition-colors" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-[#606060]">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No customers found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
