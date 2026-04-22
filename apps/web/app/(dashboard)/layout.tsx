import Sidebar from "@/components/layout/Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--color-page)" }}>
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}
