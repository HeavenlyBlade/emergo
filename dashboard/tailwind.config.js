/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emergo: {
          red: '#D32F2F',
          'red-light': '#EF5350',
          'red-dark': '#B71C1C',
        }
      }
    },
  },
  plugins: [],
}
