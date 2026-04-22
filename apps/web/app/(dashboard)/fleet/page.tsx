"use client"
import TopBar from "@/components/layout/TopBar"
import { Car, Plus, Search, Filter, Fuel, Gauge, MapPin, AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const vehicles = [
  { id: "1", reg: "GP 12 ABC", make: "Toyota", model: "Camry", year: 2023, colour: "White", status: "AVAILABLE", fuel: "PETROL", mileage: 24500, location: "Head Office", compliance: "COMPLIANT", dailyRate: 850 },
  { id: "2", reg: "GP 34 DEF", make: "BMW",    model: "3 Series", year: 2022, colour: "Black", status: "RENTED", fuel: "PETROL", mileage: 42100, location: "Head Office", compliance: "COMPLIANT", dailyRate: 1400 },
  { id: "3", reg: "GP 56 GHI", make: "Mercedes", model: "C-Class", year: 2023, colour: "Silver", status: "AVAILABLE", fuel: "PETROL", mileage: 18900, location: "Head Office", compliance: "ATTENTION_NEEDED", dailyRate: 1600 },
  { id: "4", reg: "WC 78 JKL", make: "Volkswagen", model: "Polo", year: 2022, colour: "Red", status: "MAINTENANCE", fuel: "PETROL", mileage: 67200, location: "Cape Town", compliance: "COMPLIANT", dailyRate: 620 },
  { id: "5", reg: "GP 90 MNO", make: "Range Rover", model: "Sport", year: 2023, colour: "Black", status: "AVAILABLE", fuel: "DIESEL", mileage: 12300, location: "Head Office", compliance: "COMPLIANT", dailyRate: 3200 },
  { id: "6", reg: "GP 11 PQR", make: "Audi", model: "A4", year: 2022, colour: "Grey", status: "RENTED", fuel: "PETROL", mileage: 38700, location: "Head Office", compliance: "COMPLIANT", dailyRate: 1200 },
  { id: "7", reg: "GP 22 STU", make: "Ford", model: "Ranger", year: 2023, colour: "Blue", status: "RESERVED", fuel: "DIESEL", mileage: 15600, location: "Head Office", compliance: "COMPLIANT", dailyRate: 980 },
  { id: "8", reg: "WC 33 VWX", make: "Hyundai", model: "Tucson", year: 2022, colour: "White", status: "AVAILABLE", fuel: "PETROL", mileage: 29800, location: "Cape Town", compliance: "NON_COMPLIANT", dailyRate: 890 },
]

const statusConfig: Record<string, { label: string; badge: string; dot: string }> = {
  AVAILABLE:   { label: "Available",   badge: "badge-green",  dot: "bg-[#00E676]" },
  RENTED:      { label: "Rented",      badge: "badge-blue",   dot: "bg-[#2979FF]" },
  RESERVED:    { label: "Reserved",    badge: "badge-yellow", dot: "bg-yellow-400" },
  MAINTENANCE: { label: "Maintenance", badge: "badge-red",    dot: "bg-red-400" },
  DAMAGED:     { label: "Damaged",     badge: "badge-red",    dot: "bg-red-500" },
  RETIRED:     { label: "Retired",     badge: "badge-muted",  dot: "bg-[#606060]" },
}

const complianceConfig: Record<string, { badge: string; icon: any }> = {
  COMPLIANT:        { badge: "badge-green",  icon: CheckCircle },
  ATTENTION_NEEDED: { badge: "badge-yellow", icon: AlertTriangle },
  NON_COMPLIANT:    { badge: "badge-red",    icon: AlertTriangle },
}

const FILTERS = ["All", "Available", "Rented", "Reserved", "Maintenance"]

export default function FleetPage() {
  const [search, setSearch]   = useState("")
  const [filter, setFilter]   = useState("All")
  const [view, setView]       = useState<"grid" | "list">("grid")

  const filtered = vehicles.filter(v => {
    const matchSearch = `${v.make} ${v.model} ${v.reg}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "All" || v.status === filter.toUpperCase()
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Fleet" subtitle={`${vehicles.length} vehicles across all locations`} />

      <div className="p-6 space-y-5">
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
              <Search className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search vehicles..."
                className="input pl-9 w-52 text-sm py-2"
              />
            </div>
            <button className="btn-primary flex items-center gap-2 py-2 text-sm">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(vehicle => {
            const st = statusConfig[vehicle.status]
            const comp = complianceConfig[vehicle.compliance]
            const CompIcon = comp.icon
            return (
              <div
                key={vehicle.id}
                className="card hover:border-[#3A3A3A] transition-all duration-200 cursor-pointer group"
              >
                {/* Vehicle image placeholder */}
                <div className="w-full h-28 rounded-lg bg-[#1A1A1A] flex items-center justify-center mb-3 relative overflow-hidden group-hover:bg-[#222222] transition-colors">
                  <Car className="w-12 h-12 text-[#2A2A2A]" />
                  <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", st.dot)} />
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">{vehicle.make} {vehicle.model}</p>
                      <p className="text-[#606060] text-xs">{vehicle.year} · {vehicle.colour}</p>
                    </div>
                    <span className={st.badge}>{st.label}</span>
                  </div>

                  <p className="font-mono text-[#00E676] text-xs">{vehicle.reg}</p>

                  <div className="flex items-center gap-3 text-xs text-[#A0A0A0] pt-1">
                    <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{vehicle.mileage.toLocaleString()} km</span>
                    <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{vehicle.fuel}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#A0A0A0]">
                    <MapPin className="w-3 h-3" />{vehicle.location}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A]">
                    <span className="text-[#00E676] font-bold text-sm">R{vehicle.dailyRate}<span className="text-[#606060] font-normal text-xs">/day</span></span>
                    <span className={comp.badge}>
                      <CompIcon className="w-3 h-3" />
                      {vehicle.compliance === "COMPLIANT" ? "OK" : vehicle.compliance === "ATTENTION_NEEDED" ? "Alert" : "Non-compliant"}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-[#606060]">
            <Car className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No vehicles found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  )
}
