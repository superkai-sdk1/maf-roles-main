/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        titan: {
          DEFAULT: '#6d28d9',
          dark: '#4c1d95',
          light: '#8b5cf6',
        }
      }
    },
  },
  plugins: [],
}
