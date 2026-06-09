import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read the single shared .env at the repo root (one level up from Frontend/).
  // In Docker the frontend build stage has no root .env, so VITE_* come from the
  // build-arg ENV instead — Vite picks those up automatically.
  envDir: '..',
  build: {
    rollupOptions: {
      output: {
        // Function form: split by module path so we can peel victory-vendor
        // (recharts' bundled d3) into its own chunk — it only exposes subpath
        // exports, so the object form can't resolve it as an entry. Both chart
        // chunks are lazy-loaded (fetched only when a dashboard chart renders).
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('victory-vendor') || /node_modules\/d3-/.test(id)) return 'charts-d3'
            if (id.includes('recharts')) return 'charts'
            if (id.includes('@sentry')) return 'sentry'
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('framer-motion')
            )
              return 'vendor'
          }
        },
      },
    },
  },
  server: {
    host: true,
    proxy: {
      '/mcp': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
