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

function stripAnsi(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length
}

function padLine(content: string, innerWidth = 76): string {
  const visibleLen = stripAnsi(content)
  const padding = Math.max(0, innerWidth - visibleLen)
  return content + ' '.repeat(padding)
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
          const magenta = '\x1b[35m'
          const bold = '\x1b[1m'
          const underline = '\x1b[4m'
          const reset = '\x1b[0m'
          const W = 76

          const borderTop = `${magenta}╔${'═'.repeat(W + 2)}╗${reset}`
          const borderSep = `${magenta}╠${'═'.repeat(W + 2)}╣${reset}`
          const borderBottom = `${magenta}╚${'═'.repeat(W + 2)}╝${reset}`
          const line = (txt: string) => `${magenta}║${reset} ${padLine(txt, W)} ${magenta}║${reset}`
          const empty = () => line('')

          console.log(`
${borderTop}
${line(`${yellow}${bold}🚴 PIOR CAMPEONATO DE BICI POLO · STREAMING & MESA AO VIVO${reset}`)}
${borderSep}
${empty()}
${line(`${green}${bold}📱 ACESSO NO CELULAR DO ÁRBITRO (MESA DE CONTROLE):${reset}`)}
${line(`   ${cyan}${underline}http://${lanIp}:${port}/streaming/mesa${reset}`)}
${empty()}
${line(`${bold}🖥️  ACESSO NO PC (OVERLAY 1080p OBS STUDIO):${reset}`)}
${line(`   ${cyan}${underline}http://localhost:${port}/streaming/overlay${reset}`)}
${empty()}
${line(`${bold}📋 PAINEL DE GESTÃO STREAMING:${reset}`)}
${line(`   ${cyan}${underline}http://localhost:${port}/admin/streaming${reset}`)}
${empty()}
${line(`${yellow}💡 DICA:${reset} O celular e o PC devem estar no mesmo Wi-Fi.`)}
${line(`${yellow}⚙️  BACKEND:${reset} Certifique-se de que o PHP está rodando (:8000).`)}
${borderBottom}
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
