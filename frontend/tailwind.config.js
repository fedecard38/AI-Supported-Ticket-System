/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#b1c2fc',
          400: '#7694f9',
          500: '#3b66f6',
          600: '#355cdd',
          700: '#2c4db9',
          800: '#233d94',
          900: '#1d3279',
          950: '#111d47',
        },
      },
    },
  },
  plugins: [],
}
