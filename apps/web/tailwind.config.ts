import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — light / dark via CSS variables
        cp: {
          DEFAULT: "var(--color-cp)",
          light:   "var(--color-cp-light)",
          muted:   "var(--color-cp-muted)",
        },
        // Surfaces
        page:  "var(--color-page)",
        card:  "var(--color-card)",
        input: "var(--color-input)",
        // Borders
        line:  "var(--color-line)",
        // Text
        primary:   "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        accent:    "var(--color-text-accent)",
        placeholder: "var(--color-placeholder)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "JetBrains Mono",
          "Fira Code",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card:        "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-dark": "0 1px 4px rgba(0,0,0,0.4)",
        elevated:    "0 4px 20px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        modal:       "0 20px 60px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
