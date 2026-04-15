/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        tradeshow: '#3B82F6',
        event: '#F97316',
        award: '#10B981',
      },
    },
  },
  plugins: [],
}
