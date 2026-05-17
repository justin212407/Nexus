import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/webhook': 'http://localhost:8000',
      '/stream': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
      '/health': 'http://localhost:8000'
    }
  }
})
