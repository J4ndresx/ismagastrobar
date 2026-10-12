/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        brand: { 50: '#FEF2F3', 100: '#FDE3E6', 200: '#FACBD1', 500: '#E11D48', 600: '#C8102E', 700: '#A50D26', 800: '#860B20' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        pop: '0 12px 32px -8px rgba(16,24,40,.25)',
      },
      keyframes: {
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulso: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        entrar: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        sheet: 'sheet .28s cubic-bezier(.32,.72,0,1)',
        fade: 'fade .2s ease-out',
        rise: 'rise .25s ease-out',
        pulso: 'pulso 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
