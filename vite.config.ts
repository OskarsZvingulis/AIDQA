import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  server: {
    host: '::',
    port: 8080,
    proxy: {
      '/v1': {
        target: 'http://localhost:54321/functions/v1/aidqa-api',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/v1/, '/v1'),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
