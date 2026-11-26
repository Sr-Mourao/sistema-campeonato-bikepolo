import { QRCodeSVG } from 'qrcode.react'
import { urlPublica } from './paginaPublica'

/** value: endereço do QR (padrão: página pública do torneio) */
export default function IntervalQr({ value = urlPublica() }: { value?: string }) {
  return (
    <aside className="iv-qr">
      <span className="iv-qr-costura" aria-hidden="true" />
      <div className="iv-qr-tab">
        <strong>Acompanhe ao vivo</strong>
        <span>Tabelas, jogos e classificação</span>
      </div>
      <div className="iv-qr-plate">
        <QRCodeSVG
          value={value}
          size={188}
          level="M"
          marginSize={1}
          bgColor="var(--pal-white)"
          fgColor="var(--pal-purple-d35)"
          title="Acompanhe o campeonato pelo celular"
        />
      </div>
    </aside>
  )
}
