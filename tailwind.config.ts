import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // enzi-ws: Poppins is the standard app typeface.
        sans: ["var(--font-poppins)", "Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        // Playfair is the display serif — enzi-ws uses it for the hero only.
        // Here: the big countdown + activity name, the hero of this page.
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
      },
      colors: {
        // ── BSI brand palette, exactly as in enzi-ws ──────────
        // Primary teal #00A39D, secondary gold #F8AD3C,
        // tertiary deep teal #003D36. No emerald/amber/purple/blue.
        bsi: {
          50: "#e6f7f5",
          100: "#c8efec",
          200: "#99dfdb",
          300: "#5ccbc5",
          400: "#1fb3ac",
          500: "#00a39d",
          600: "#00857f",
          700: "#00695c",
          800: "#00544a",
          900: "#003d36",
          950: "#002b26",
        },
        gold: {
          50: "#fef6e7",
          100: "#fdeecb",
          200: "#fbe3a1",
          300: "#f9d170",
          400: "#f8ad3c",
          500: "#e89b1f",
          600: "#c77f0a",
          700: "#9a6208",
          800: "#6e4505",
          900: "#4a2f03",
          950: "#332006",
        },
        deep: {
          50: "#e8f1f0",
          100: "#d1e3e1",
          200: "#a3c7c3",
          300: "#75aba5",
          400: "#478f87",
          500: "#197369",
          600: "#005e57",
          700: "#004d46",
          800: "#003d36",
          900: "#002b26",
          950: "#001f1b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
