/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0A0A0F',
        'dark-surface': '#12121A',
        'electric-blue': '#4F8EF7',
        'glass-white': 'rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'blue-gradient': 'linear-gradient(135deg, #4F8EF7 0%, #2A5298 100%)',
      },
    },
  },
  plugins: [],
}
