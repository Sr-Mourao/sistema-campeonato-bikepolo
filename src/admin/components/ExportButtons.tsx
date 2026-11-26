import { Download } from 'lucide-react'

const EXPORTS = [
  { tipo: 'inscricoes',  label: 'Inscrições' },
  { tipo: 'times',       label: 'Times' },
  { tipo: 'lojinha',     label: 'Pedidos Lojinha' },
]

export default function ExportButtons() {
  function download(tipo: string) {
    window.open(`/api/admin/export.php?tipo=${tipo}`, '_blank')
  }

  return (
    <div className="adm-export-bar">
      {EXPORTS.map(e => (
        <button key={e.tipo} className="adm-btn adm-btn--sm" onClick={() => download(e.tipo)}>
          <Download size={13} />
          {e.label}
        </button>
      ))}
    </div>
  )
}
