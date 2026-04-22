import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title:       "Naked Fleet — Fleet Management",
  description: "Premium vehicle rental & fleet operating system",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
