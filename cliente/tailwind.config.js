/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Acento de marca (rojo Jireh). Se usa con moderación: CTA, selección, precios.
        brand: {
          50: '#FEF2F3', 100: '#FDE3E6', 200: '#FACBD1', 500: '#E11D48',
          600: '#C8102E', 700: '#A50D26', 800: '#860B20',
        },
        jireh: { red: '#C8102E', orange: '#E8751A' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        pop: '0 12px 32px -8px rgba(16,24,40,.25)',
      },
      keyframes: {
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        sheet: 'sheet .28s cubic-bezier(.32,.72,0,1)',
        fade: 'fade .2s ease-out',
        rise: 'rise .25s ease-out',
      },
    },
  },
  plugins: [],
};
