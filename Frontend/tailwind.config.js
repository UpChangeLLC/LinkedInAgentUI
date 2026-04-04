
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'sans-serif'],
        serif: ['Cormorant', 'Georgia', 'serif'],
      },
      colors: {
        navy: {
          500: '#2A4A80',
          600: '#1E3A6A',
          700: '#162D54',
          800: '#0F2140',
          900: '#0A1628',
          950: '#050D1A',
        },
        // Mapping accent to LinkedIn Blue for backward compatibility where appropriate
        accent: {
          DEFAULT: '#0A66C2', // LinkedIn Blue
          light: '#70B5F9',   // LinkedIn Light Blue
          dark: '#004182',    // LinkedIn Dark Blue
          glow: 'rgba(10, 102, 194, 0.15)',
        },
        linkedin: {
          DEFAULT: '#0A66C2',
          dark: '#004182',
          light: '#70B5F9',
          bg: '#F3F2EF',
          card: '#FFFFFF',
          hover: '#004182',
          text: '#191919',
          subtext: '#666666',
        },
        surface: {
          white: '#FFFFFF',
          off: '#F3F2EF', // LinkedIn BG
          muted: '#EBEBEB',
          border: '#E0E0E0',
        },
        // Dark premium theme tokens
        dark: {
          bg: '#0B1120',
          card: '#111827',
          elevated: '#1E293B',
          sidebar: '#162032',
          accent: '#14B8A6',
          accentDim: 'rgba(20,184,166,0.12)',
          textPri: '#E2E8F0',
          textSec: '#94A3B8',
          textMuted: '#64748B',
          border: 'rgba(148,163,184,0.08)',
          borderHov: 'rgba(148,163,184,0.15)',
          green: '#34D399',
          amber: '#FBBF24',
          red: '#F87171',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'stream': 'stream 2s linear infinite',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'bar-grow': 'barGrow 0.8s ease-out forwards',
      },
      keyframes: {
        stream: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        barGrow: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--bar-width, 100%)' },
        },
      }
    },
  },
  plugins: [],
}
