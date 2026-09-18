import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F8F4",
        ink: "#141413",
        grey: {
          700: "#3B3E38", // body
          500: "#6E726A", // labels
          400: "#8A8E84", // chart steps, secondary display
          300: "#A6AA9F",
          250: "#C2C5BC",
          200: "#D6D9CF", // hairline
          100: "#E6E8E0", // row rule
        },
        // Control Room surface tints from the design spec sheet (not in the landing palette).
        tint: {
          DEFAULT: "#EEF0EA", // table header, skeleton, chip hover
          alt: "#F2F3EE", // alternate row
          hover: "#E8EAE2", // row hover
        },
        allow: { DEFAULT: "#128A60", fill: "#18B981" }, // DEFAULT = text (4.5:1 on paper)
        lime: { DEFAULT: "#B8F227", hover: "#C9F94F" },
        amber: { DEFAULT: "#9A6B00", fill: "#F3B83F" },
        deny: { DEFAULT: "#D93636", fill: "#FF4D4D" },
        clay: "#D97757",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "pf-row": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "pf-pulse": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.25" } },
        "pf-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-2px)" },
          "75%": { transform: "translateX(2px)" },
        },
      },
      animation: {
        "pf-row": "pf-row 200ms ease both",
        "pf-shake": "pf-shake 150ms linear 1",
        "pf-pulse": "pf-pulse 1.2s ease-in-out infinite",
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
