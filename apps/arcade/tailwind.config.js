/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Design System Colors (from tokens.json)
        primary: {
          DEFAULT: "#0A1020",
          foreground: "#E5E7EB",
        },
        accent: {
          DEFAULT: "#7C3AED",
          foreground: "#FFFFFF",
          hover: "#6D28D9",
        },
        highlight: "#E5E7EB",
        background: "#050814",
        surface: {
          DEFAULT: "#0B1022",
          hover: "#111936",
          active: "#1a2347",
        },
        border: "#1E293B",
        "border-light": "#334155",

        // Status Colors
        status: {
          online: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          offline: "#6B7280",
          pending: "#3B82F6",
        },

        // Legacy arcade compatibility
        arcade: {
          bg: "#050814",
          surface: "#0B1022",
          "surface-hover": "#111936",
          "surface-active": "#1a2347",
          border: "#1E293B",
          "border-light": "#334155",
          "text-primary": "#E5E7EB",
          "text-secondary": "#94A3B8",
          "text-tertiary": "#64748B",
          primary: "#7C3AED",
          secondary: "#A78BFA",
        },
      },
      spacing: {
        "2xs": "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        "2xl": "64px",
      },
      borderRadius: {
        sm: "6px",
        md: "12px",
        lg: "20px",
        xl: "28px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.08)",
        md: "0 8px 24px rgba(0,0,0,0.14)",
        lg: "0 16px 48px rgba(0,0,0,0.20)",
        glow: "0 0 30px rgba(124, 58, 237, 0.3)",
        "glow-sm": "0 0 15px rgba(124, 58, 237, 0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};
