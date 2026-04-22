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
    <aside
      className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40"
      style={{ backgroundColor: "var(--color-cp)" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <Car className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-tight leading-none">Naked Fleet</p>
            <p className="text-white/50 text-xs leading-none mt-0.5">Fleet Management OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "nav-item",
                active && "nav-item-active"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-2 border-t border-white/10 space-y-0.5">
        <Link href="/settings" className="nav-item">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.clear()
              window.location.href = "/login"
            }
          }}
          className="nav-item w-full text-left hover:!text-red-300 hover:!bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
