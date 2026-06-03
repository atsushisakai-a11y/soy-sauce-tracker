import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        soy: {
          50:  "#fdf8f0",
          100: "#faefd8",
          200: "#f5d9a1",
          300: "#efbe64",
          400: "#e8a030",
          500: "#d97706",  // amber — primary accent
          600: "#b45309",
          700: "#92400e",
          800: "#78350f",
          900: "#451a03",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
