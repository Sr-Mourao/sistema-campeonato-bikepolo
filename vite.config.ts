import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'

// Ajuste a porta do Apache/PHP se necessário (padrão: 80)
const PHP_SERVER = 'http://localhost:8000'

// Servidor de streaming (scripts/servidor_streaming.py, `npm run streaming`).
// Porta configurável por STREAMING_PORT (a mesma que o servidor Python lê).
const STREAMING_SERVER = `http://localhost:${process.env.STREAMING_PORT || 8787}`

function getLanIp(): string {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

function streamingLanBannerPlugin(): Plugin {
  return {
    name: 'streaming-lan-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address()
        const port = typeof address === 'object' && address?.port ? address.port : 5173
        const lanIp = getLanIp()

        setTimeout(() => {
          const cyan = '\x1b[36m'
          const yellow = '\x1b[33m'
          const green = '\x1b[32m'
          const bold = '\x1b[1m'
          const underline = '\x1b[4m'
          const reset = '\x1b[0m'

          console.log(`
  ${yellow}${bold}🚴 PIOR CAMPEONATO DE BICI POLO · STREAMING & MESA AO VIVO${reset}

  ${green}${bold}📱 Celular do Árbitro (Mesa de Controle):${reset}
     ${cyan}${underline}http://${lanIp}:${port}/streaming/mesa${reset}

  ${bold}🖥️  PC da Transmissão (Overlay OBS 1080p):${reset}
     ${cyan}${underline}http://localhost:${port}/streaming/overlay${reset}

  ${bold}📋 Painel de Gestão Streaming (Admin):${reset}
     ${cyan}${underline}http://localhost:${port}/admin/streaming${reset}

  ${yellow}💡 Dica:${reset} Para abrir no celular, ambos precisam estar na mesma rede Wi-Fi.
  ${yellow}⚙️  Backend:${reset} Certifique-se de que o PHP está rodando (:8000).
`)
        }, 150)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), streamingLanBannerPlugin()],
  server: {
    host: true, // Libera o acesso via IP local na rede Wi-Fi para o celular
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
