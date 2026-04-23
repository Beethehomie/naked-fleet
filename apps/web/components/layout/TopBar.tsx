"use client"
import { Bell, Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
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
      className="p-2 rounded-lg transition-colors"
      style={{ color: "var(--color-text-secondary)" }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--color-card-elevated)")}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark
        ? <Sun  className="w-4 h-4" />
        : <Moon className="w-4 h-4" />
      }
    </button>
  )
}

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        backgroundColor: "var(--color-sidebar)",
        borderBottom: "1px solid var(--color-sidebar-border)",
      }}
    >
      {/* Left: page title */}
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--color-card-elevated)")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Bell className="w-4 h-4" />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-negative)" }}
          />
        </button>

        {/* User avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ml-1 cursor-pointer"
          style={{ backgroundColor: "var(--color-text-accent)" }}
        >
          BM
        </div>
      </div>
    </header>
  )
}
