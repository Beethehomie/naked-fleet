"use client"
import { Bell, Search, Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    // Read saved preference
    const saved = localStorage.getItem("theme")
    const isDark = saved !== "light"
    setDark(isDark)
    document.documentElement.classList.toggle("dark", isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/8"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark
        ? <Sun className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
        : <Moon className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
      }
    </button>
  )
}

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6 sticky top-0 z-30 border-b"
      style={{
        backgroundColor: "var(--color-card)",
        borderColor: "var(--color-line)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div>
        <h1 className="page-title" style={{ fontSize: "1.25rem" }}>{title}</h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-placeholder)" }}
          />
          <input
            placeholder="Search..."
            className="input pl-8 pr-3 py-1.5 text-sm w-44 rounded-lg"
          />
        </div>

        {/* Dark mode toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/8"
        >
          <Bell className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-negative)" }}
          />
        </button>

        {/* User avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: "var(--color-cp-light)" }}
        >
          OW
        </div>
      </div>
    </header>
  )
}
