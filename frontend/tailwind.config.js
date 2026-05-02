import colors from 'tailwindcss/colors';

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
        gray: colors.neutral,
        brand: {
          50:  '#fff9eb',
          100: '#fef0c7',
          200: '#fde08b',
          300: '#fccb4b',
          400: '#fbb315',
          500: '#f59e0b', // Engine light amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f5f5',
          border: '#e5e5e5',
          dark: '#000000',          // True black
          'dark-muted': '#0a0a0a',  // Very dark gray
          'dark-border': '#262626', // Neutral border
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
