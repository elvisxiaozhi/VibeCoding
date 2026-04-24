import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^lucide-react$/, replacement: path.resolve(__dirname, './src/vendor/lucide.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
