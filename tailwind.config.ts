import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0e14",
        surface: "#111827",
        card: "#111827",
        border: "#1f2937",
        foreground: "#e5e7eb",
        muted: "#9ca3af",
        accent: "#38bdf8"
      }
    }
  },
  plugins: []
};

export default config;