import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0a0a0a",
        primary2: "#2b2b2e",
        ink: "#18181b",
        muted: "#6b6b73",
        line: "#e4e4e7",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["Vazirmatn", "Segoe UI", "Tahoma", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06)",
        lift: "0 2px 4px rgba(0,0,0,.05), 0 12px 32px rgba(0,0,0,.12)",
        glow: "0 8px 24px rgba(0,0,0,.28)",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
