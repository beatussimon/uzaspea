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
          muted: '#f9fafb',
          border: '#c4c4c4',        // Balanced border: not too stark, not too subtle
          dark: '#000000',          // True black
          'dark-muted': '#0a0a0a',  // Very dark gray
          'dark-border': '#404040', // Balanced dark border (neutral-700 equivalent)
        },
      },
      spacing: {
        '4.5': '1.125rem', /* 18px */
        '13': '3.25rem',   /* 52px */
        '15': '3.75rem',   /* 60px */
        '18': '4.5rem',    /* 72px — navbar height */
      },
      borderRadius: {
        'card': '1rem',       /* 16px */
        'pill': '9999px',
        'btn': '0.75rem',     /* 12px */
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  /* 10px - restrict usage */
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }], /* 14px */
        'body': ['1rem', { lineHeight: '1.5rem' }],       /* 16px */
        'heading-sm': ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        'heading-md': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        'heading-lg': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        'card': '0 8px 30px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.08)',
        'nav': '0 4px 20px rgba(0,0,0,0.03)',
        'glow': '0 0 30px rgba(245, 158, 11, 0.15)',
        'glow-strong': '0 0 40px rgba(245, 158, 11, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
