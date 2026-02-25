import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/login': { target: 'http://localhost:8080', changeOrigin: true },
      '/admin/api': { target: 'http://localhost:8080', changeOrigin: true },
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
