import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ajuste a porta do Apache/PHP se necessário (padrão: 80)
const PHP_SERVER = 'http://localhost:8000'

// Servidor de streaming (scripts/servidor_streaming.py, `npm run streaming`).
// Guarda o estado compartilhado entre a mesa e os overlays. Sem ele, mesa e
// overlay só sincronizam entre abas do MESMO navegador (localStorage /
// BroadcastChannel) — o OBS, que é outro navegador, não recebe nada.
// Porta configurável por STREAMING_PORT (a mesma que o servidor Python lê).
const STREAMING_SERVER = `http://localhost:${process.env.STREAMING_PORT || 8787}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api/streaming.php vai para o backend PHP (porta 8000).
      // Rotas /api/streaming/* vão para o servidor Python local (porta 8787), se estiver rodando.
      '^/api/streaming/': {
        target: STREAMING_SERVER,
        changeOrigin: true,
      },
      '/api': {
        target: PHP_SERVER,
        changeOrigin: true,
      },
    },
  },
})
