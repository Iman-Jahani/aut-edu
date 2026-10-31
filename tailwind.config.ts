import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0b6b70",   // Persian turquoise
        primary2: "#13919a",  // brighter turquoise (gradients)
        deep: "#08484c",      // dark turquoise for sidebars / hero panels
        accent: "#f2a93b",    // saffron
        paper: "#fbf8f1",     // warm cream page background
        ink: "#17262b",
        muted: "#5f7077",
        line: "#e7e2d6",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["Vazirmatn", "Segoe UI", "Tahoma", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(23,38,43,.04), 0 4px 16px rgba(23,38,43,.06)",
        lift: "0 2px 4px rgba(23,38,43,.05), 0 12px 32px rgba(11,107,112,.16)",
        glow: "0 8px 24px rgba(11,107,112,.32)",
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
