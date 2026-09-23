import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Bangladesh flag-inspired palette used throughout the poster UI
        flagGreen: "#006A4E",
        flagRed: "#F42A41",
      },
    },
  },
  plugins: [],
};

export default config;
