/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand marks — sidebar, logo, wordmark.
        brandNavy: '#101B2D',
        brandNavyLight: '#16233A',
        brandGold: '#C9A24B',
        // Product accent — primary actions, "compliant" state.
        brand: '#0F766E',
        danger: '#dc2626',
        warn: '#b45309',
        safe: '#0F766E',
        unassessed: '#7C3AED',
      },
    },
  },
  plugins: [],
}
