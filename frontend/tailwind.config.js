/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd8ff',
          300: '#8ec0ff',
          400: '#599dff',
          500: '#3478ff',
          600: '#1a56f5',
          700: '#1543e1',
          800: '#1837b6',
          900: '#1a338f',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8f9fb',
          border: '#e5e7eb',
          dark: '#111827',
          'dark-muted': '#1f2937',
          'dark-border': '#374151',
        },
      },
      spacing: {
        '4.5': '1.125rem', /* 18px */
        '13': '3.25rem',   /* 52px */
        '15': '3.75rem',   /* 60px */
        '18': '4.5rem',    /* 72px — navbar height */
      },
      borderRadius: {
        'card': '0.625rem',   /* 10px */
        'pill': '9999px',
        'btn': '0.5rem',      /* 8px */
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  /* 10px */
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'nav': '0 1px 3px 0 rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
