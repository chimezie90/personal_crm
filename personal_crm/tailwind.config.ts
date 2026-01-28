import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Brutalism design system
        cream: "#FAF8F5",
        warmGray: {
          50: "#FAFAF9",
          100: "#F5F3F0",
          200: "#E7E4E0",
          300: "#D4D0CA",
          400: "#A8A29E",
          500: "#78716C",
          600: "#57534E",
          700: "#44403C",
          800: "#292524",
          900: "#2C2A27",
        },
        terracotta: {
          DEFAULT: "#C65D3B",
          50: "#FCF4F1",
          100: "#F9E8E2",
          200: "#F2CEC2",
          300: "#E8A997",
          400: "#DB7D5E",
          500: "#C65D3B",
          600: "#B24A2E",
          700: "#943D27",
          800: "#793426",
          900: "#642F24",
        },
        sage: {
          DEFAULT: "#7B8F6E",
          50: "#F5F7F4",
          100: "#E8ECE5",
          200: "#D2DACE",
          300: "#B1C0A8",
          400: "#8FA27E",
          500: "#7B8F6E",
          600: "#5F7253",
          700: "#4C5B44",
          800: "#3F4A39",
          900: "#363F32",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        brutal: "4px 4px 0 0 #2C2A27",
        "brutal-sm": "2px 2px 0 0 #2C2A27",
        "brutal-lg": "6px 6px 0 0 #2C2A27",
        "brutal-terracotta": "4px 4px 0 0 #C65D3B",
      },
    },
  },
  plugins: [],
} satisfies Config;
