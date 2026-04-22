"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Car, CalendarCheck, Users, CreditCard,
  ClipboardCheck, Shield, FileBarChart, Truck, Settings, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard },
  { label: "Fleet",       href: "/fleet",        icon: Car },
  { label: "Bookings",    href: "/bookings",     icon: CalendarCheck },
  { label: "Customers",   href: "/customers",    icon: Users },
  { label: "Billing",     href: "/billing",      icon: CreditCard },
  { label: "Inspections", href: "/inspections",  icon: ClipboardCheck },
  { label: "Compliance",  href: "/compliance",   icon: Shield },
  { label: "Reports",     href: "/reports",      icon: FileBarChart },
  { label: "Suppliers",   href: "/suppliers",    icon: Truck },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0A0A0A] border-r border-[#2A2A2A] flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00E676] flex items-center justify-center">
            <Car className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">NAKED</p>
            <p className="text-[#00E676] font-bold text-sm leading-none tracking-widest">FLEET</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href} className={cn(active ? "nav-item-active" : "nav-item")}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {active && <div className="ml-auto w-1 h-4 rounded-full bg-[#00E676]" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-2 border-t border-[#2A2A2A] space-y-0.5">
        <Link href="/settings" className="nav-item">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
        <button
          onClick={() => {
            localStorage.clear()
            window.location.href = "/login"
          }}
          className="nav-item w-full text-left hover:text-red-400 hover:bg-red-500/5"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
