import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Naked Fleet Design System
        black:    "#000000",
        rich:     "#0A0A0A",
        surface:  "#111111",
        elevated: "#1A1A1A",
        border:   "#2A2A2A",
        muted:    "#3A3A3A",
        green: {
          DEFAULT: "#00E676",
          dim:     "#00C853",
          dark:    "#007A3D",
          glow:    "rgba(0,230,118,0.15)",
        },
        text: {
          primary:   "#FFFFFF",
          secondary: "#A0A0A0",
          muted:     "#606060",
        },
        status: {
          success: "#00E676",
          warning: "#FFB300",
          danger:  "#FF1744",
          info:    "#2979FF",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        "green-glow": "radial-gradient(circle at 50% 0%, rgba(0,230,118,0.08) 0%, transparent 60%)",
      },
      boxShadow: {
        "green-sm":  "0 0 12px rgba(0,230,118,0.2)",
        "green-md":  "0 0 24px rgba(0,230,118,0.25)",
        "green-lg":  "0 0 48px rgba(0,230,118,0.3)",
        "card":      "0 1px 3px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6)",
      },
      animation: {
        "pulse-green": "pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":     "fade-in 0.3s ease-out",
        "slide-in":    "slide-in 0.3s ease-out",
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.5" },
        },
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%":   { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
