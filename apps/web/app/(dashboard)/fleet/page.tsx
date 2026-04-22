"use client"
import TopBar from "@/components/layout/TopBar"
import { Car, Plus, Search, Fuel, Gauge, MapPin, AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const vehicles = [
  { id: "1", reg: "GP 12 ABC",  make: "Toyota",      model: "Camry",    year: 2023, colour: "White",  status: "AVAILABLE",   fuel: "PETROL", mileage: 24500, location: "Head Office", compliance: "COMPLIANT",        dailyRate: 850  },
  { id: "2", reg: "GP 34 DEF",  make: "BMW",         model: "3 Series", year: 2022, colour: "Black",  status: "RENTED",      fuel: "PETROL", mileage: 42100, location: "Head Office", compliance: "COMPLIANT",        dailyRate: 1400 },
  { id: "3", reg: "GP 56 GHI",  make: "Mercedes",    model: "C-Class",  year: 2023, colour: "Silver", status: "AVAILABLE",   fuel: "PETROL", mileage: 18900, location: "Head Office", compliance: "ATTENTION_NEEDED", dailyRate: 1600 },
  { id: "4", reg: "WC 78 JKL",  make: "Volkswagen",  model: "Polo",     year: 2022, colour: "Red",    status: "MAINTENANCE", fuel: "PETROL", mileage: 67200, location: "Cape Town",   compliance: "COMPLIANT",        dailyRate: 620  },
  { id: "5", reg: "GP 90 MNO",  make: "Range Rover", model: "Sport",    year: 2023, colour: "Black",  status: "AVAILABLE",   fuel: "DIESEL", mileage: 12300, location: "Head Office", compliance: "COMPLIANT",        dailyRate: 3200 },
  { id: "6", reg: "GP 11 PQR",  make: "Audi",        model: "A4",       year: 2022, colour: "Grey",   status: "RENTED",      fuel: "PETROL", mileage: 38700, location: "Head Office", compliance: "COMPLIANT",        dailyRate: 1200 },
  { id: "7", reg: "GP 22 STU",  make: "Ford",        model: "Ranger",   year: 2023, colour: "Blue",   status: "RESERVED",    fuel: "DIESEL", mileage: 15600, location: "Head Office", compliance: "COMPLIANT",        dailyRate: 980  },
  { id: "8", reg: "WC 33 VWX",  make: "Hyundai",     model: "Tucson",   year: 2022, colour: "White",  status: "AVAILABLE",   fuel: "PETROL", mileage: 29800, location: "Cape Town",   compliance: "NON_COMPLIANT",    dailyRate: 890  },
]

const statusConfig: Record<string, { badge: string; dotColor: string; label: string }> = {
  AVAILABLE:   { badge: "badge-green",  dotColor: "var(--color-positive)", label: "Available" },
  RENTED:      { badge: "badge-blue",   dotColor: "#5B9BF8",               label: "Rented" },
  RESERVED:    { badge: "badge-yellow", dotColor: "var(--color-warning)",  label: "Reserved" },
  MAINTENANCE: { badge: "badge-red",    dotColor: "var(--color-negative)", label: "Maintenance" },
  DAMAGED:     { badge: "badge-red",    dotColor: "var(--color-negative)", label: "Damaged" },
  RETIRED:     { badge: "badge-muted",  dotColor: "var(--color-placeholder)", label: "Retired" },
}

const complianceConfig: Record<string, { badge: string; icon: any; label: string }> = {
  COMPLIANT:        { badge: "badge-green",  icon: CheckCircle,  label: "OK" },
  ATTENTION_NEEDED: { badge: "badge-yellow", icon: AlertTriangle, label: "Alert" },
  NON_COMPLIANT:    { badge: "badge-red",    icon: AlertTriangle, label: "Non-compliant" },
}

const FILTERS = ["All", "Available", "Rented", "Reserved", "Maintenance"]

export default function FleetPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")

  const filtered = vehicles.filter(v => {
    const matchSearch = `${v.make} ${v.model} ${v.reg}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "All" || v.status === filter.toUpperCase()
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Fleet" subtitle={`${vehicles.length} vehicles across all locations`} />

      <div className="max-w-7xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Filter pills */}
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
                {f !== "All" && (
                  <span className="ml-1.5 text-xs opacity-60">
                    {vehicles.filter(v => v.status === f.toUpperCase()).length}
                  </span>
                )}
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
                placeholder="Search vehicles..."
                className="input pl-9 w-52 py-2"
              />
            </div>
            <button className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          </div>
        </div>

        {/* Vehicle grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(vehicle => {
            const st   = statusConfig[vehicle.status]
            const comp = complianceConfig[vehicle.compliance]
            const CompIcon = comp.icon
            const flagged = vehicle.compliance !== "COMPLIANT"

            return (
              <div
                key={vehicle.id}
                className="card cursor-pointer transition-all duration-200 hover:shadow-lg p-0 overflow-hidden"
                style={flagged ? { borderLeft: "4px solid var(--color-warning)" } : {}}
              >
                {/* Image placeholder */}
                <div
                  className="w-full h-28 flex items-center justify-center relative"
                  style={{ backgroundColor: "var(--color-cp-muted)" }}
                >
                  <Car className="w-12 h-12 opacity-20" style={{ color: "var(--color-text-accent)" }} />
                  <div
                    className="absolute top-3 right-3 w-2 h-2 rounded-full"
                    style={{ backgroundColor: st.dotColor }}
                  />
                  <div
                    className="absolute top-3 left-3"
                  >
                    <span className={st.badge}>{st.label}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
                        {vehicle.make} {vehicle.model}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {vehicle.year} · {vehicle.colour}
                      </p>
                    </div>
                  </div>

                  <p className="font-mono text-xs" style={{ color: "var(--color-text-accent)" }}>
                    {vehicle.reg}
                  </p>

                  <div
                    className="flex items-center gap-3 text-xs"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3" />
                      {vehicle.mileage.toLocaleString()} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Fuel className="w-3 h-3" />
                      {vehicle.fuel}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1 text-xs"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <MapPin className="w-3 h-3" />
                    {vehicle.location}
                  </div>

                  <div
                    className="flex items-center justify-between pt-2 border-t"
                    style={{ borderColor: "var(--color-line)" }}
                  >
                    <span className="font-bold text-sm" style={{ color: "var(--color-positive)" }}>
                      R{vehicle.dailyRate}
                      <span
                        className="font-normal text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        /day
                      </span>
                    </span>
                    <span className={comp.badge}>
                      <CompIcon className="w-3 h-3" />
                      {comp.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-24"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Car className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No vehicles found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  )
}
