import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBF9F5",
        ink: "#16161A",
        muted: "#6B6B73",
        rule: "#DDD8CE",
        panel: "#F3EFE7",
        accent: "#C2410C",
        allow: "#2F7A4E",
        hold: "#B07503",
        deny: "#B4232B",
        terminal: "#1B1B20",
      },
      fontFamily: {
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-ibm-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
    },
    // Design rules: no rounded corners > 2px, no shadows.
    borderRadius: {
      none: "0",
      sm: "1px",
      DEFAULT: "2px",
    },
    boxShadow: {
      none: "none",
    },
  },
  plugins: [],
};

export default config;
