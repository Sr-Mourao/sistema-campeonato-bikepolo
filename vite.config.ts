import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ajuste a porta do Apache/PHP se necessário (padrão: 80)
const PHP_SERVER = 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: PHP_SERVER,
        changeOrigin: true,
      },
    },
  },
})
