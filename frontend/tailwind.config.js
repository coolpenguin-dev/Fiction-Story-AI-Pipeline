/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f6f4",
          100: "#edeae4",
          200: "#d9d4c8",
          300: "#c0b8a6",
          400: "#a39682",
          500: "#8a7d68",
          600: "#6f6454",
          700: "#5a5145",
          800: "#4a433a",
          900: "#3d3832",
          950: "#211e1a",
        },
        accent: {
          DEFAULT: "#c45d3e",
          hover: "#a84d33",
          light: "#f4e8e4",
          muted: "#e8cfc6",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(33, 30, 26, 0.06), 0 8px 24px rgba(33, 30, 26, 0.08)",
        elevated: "0 4px 12px rgba(33, 30, 26, 0.1), 0 16px 40px rgba(33, 30, 26, 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
