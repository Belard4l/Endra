/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f3",
          100: "#ffe4e8",
          200: "#fecdd6",
          300: "#fda4b4",
          400: "#fb7190",
          500: "#e11d48",
          600: "#be123c",
          700: "#9f1239",
          800: "#881337",
          900: "#4c0519",
        },
        ink: "#1c1917",
        sand: "#faf7f5",
      },
      fontFamily: {
        Roboto: ["var(--font-roboto)"],
        Poppins: ["var(--font-poppins)"],
      },
    },
  },
  plugins: [],
};
