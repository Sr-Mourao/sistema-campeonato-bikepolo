import { QRCodeSVG } from 'qrcode.react'
import { urlPublica } from './paginaPublica'

export default function IntervalQr() {
  return (
    <aside className="iv-qr">
      <span className="iv-qr-costura" aria-hidden="true" />
      <div className="iv-qr-tab">
        <strong>Acompanhe ao vivo</strong>
        <span>Tabelas, jogos e classificação</span>
      </div>
      <div className="iv-qr-plate">
        <QRCodeSVG
          value={urlPublica()}
          size={188}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#12052f"
          title="Acompanhe o campeonato pelo celular"
        />
      </div>
    </aside>
  )
}
