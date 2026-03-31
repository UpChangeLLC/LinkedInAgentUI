
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
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
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'stream': 'stream 2s linear infinite',
      },
      keyframes: {
        stream: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        }
      }
    },
  },
  plugins: [],
}
