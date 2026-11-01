import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1b6ca8",   // ocean blue
        primary2: "#2f95d6",  // brighter sky blue (gradients)
        deep: "#0d3b66",      // deep navy-blue for sidebars / hero panels
        accent: "#3fbf7f",    // leaf green
        paper: "#f3faf7",     // pale mint page background
        ink: "#13262f",
        muted: "#5a6f78",
        line: "#d9e8e3",
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
        lift: "0 2px 4px rgba(23,38,43,.05), 0 12px 32px rgba(27,108,168,.16)",
        glow: "0 8px 24px rgba(27,108,168,.32)",
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
