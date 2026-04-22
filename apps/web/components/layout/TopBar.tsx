"use client"
import { Bell, Search } from "lucide-react"

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="h-16 bg-[#0A0A0A]/80 backdrop-blur border-b border-[#2A2A2A] flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="page-title text-lg">{title}</h1>
        {subtitle && <p className="text-[#606060] text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Search..."
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#606060] focus:outline-none focus:border-[#00E676]/50 w-52 transition-all"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-[#1A1A1A] transition-colors">
          <Bell className="w-5 h-5 text-[#A0A0A0]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00E676]" />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] text-xs font-bold">
          OW
        </div>
      </div>
    </header>
  )
}
