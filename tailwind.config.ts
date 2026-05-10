import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        /* School brand colors */
        "school-primary": "#610000",
        "school-secondary": "#009688",
        "school-accent": "#FFC107",
        "school-primary-light": "#8B0000",
        "school-secondary-light": "#00BFA5",
        /* Material 3 Design System */
        m3: {
          primary: "var(--m3-primary)",
          "on-primary": "var(--m3-on-primary)",
          "primary-container": "var(--m3-primary-container)",
          "on-primary-container": "var(--m3-on-primary-container)",
          secondary: "var(--m3-secondary)",
          "on-secondary": "var(--m3-on-secondary)",
          "secondary-container": "var(--m3-secondary-container)",
          "on-secondary-fixed": "var(--m3-on-secondary-fixed)",
          surface: "var(--m3-surface)",
          "on-surface": "var(--m3-on-surface)",
          "surface-variant": "var(--m3-surface-variant)",
          "on-surface-variant": "var(--m3-on-surface-variant)",
          "outline-variant": "var(--m3-outline-variant)",
          "surface-container": "var(--m3-surface-container)",
          "surface-container-lowest": "var(--m3-surface-container-lowest)",
          "surface-container-low": "var(--m3-surface-container-low)",
          "surface-container-high": "var(--m3-surface-container-high)",
          error: "var(--m3-error)",
          "on-error": "var(--m3-on-error)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "var(--font-geist)", "sans-serif"],
        arabic: ["var(--font-cairo)", "sans-serif"],
      },
      animation: {
        "news-ticker": "news-ticker 30s linear infinite",
        "news-ticker-scroll": "news-ticker-scroll 40s linear infinite",
        "vertical-scroll": "vertical-scroll 20s linear infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
      },
      keyframes: {
        "news-ticker": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(-100%)" },
        },
        "news-ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "vertical-scroll": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
