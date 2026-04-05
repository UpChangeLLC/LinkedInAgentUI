
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
        // Dark premium theme tokens — powered by CSS variables for light/dark toggle
        dark: {
          bg: 'rgb(var(--bg))',
          card: 'rgb(var(--bg-card))',
          elevated: 'rgb(var(--bg-elevated))',
          sidebar: 'rgb(var(--sidebar))',
          accent: 'rgb(var(--accent))',
          accentDim: 'rgb(var(--accent-dim) / 0.12)',
          textPri: 'rgb(var(--text-pri))',
          textSec: 'rgb(var(--text-sec))',
          textMuted: 'rgb(var(--text-muted))',
          border: 'rgb(var(--border) / 0.08)',
          borderHov: 'rgb(var(--border-hov) / 0.15)',
          green: 'rgb(var(--green))',
          amber: 'rgb(var(--amber))',
          red: 'rgb(var(--red))',
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
