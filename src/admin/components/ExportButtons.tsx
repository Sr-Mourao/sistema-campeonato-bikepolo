import { Download } from 'lucide-react'
import { useConfigGeral } from '../useConfigGeral'

export default function ExportButtons() {
  const { config } = useConfigGeral()

  const exports = [
    { tipo: 'inscricoes',  label: 'Inscrições' },
    { tipo: 'times',       label: 'Times' },
    ...(config?.modulo_alimentacao ? [{ tipo: 'alimentacao', label: 'Alimentação' }] : []),
    ...(config?.modulo_alojamento  ? [{ tipo: 'alojamento',  label: 'Alojamento' }] : []),
    { tipo: 'lojinha',     label: 'Pedidos Lojinha' },
  ]

  function download(tipo: string) {
    window.open(`/api/admin/export.php?tipo=${tipo}`, '_blank')
  }

  return (
    <div className="adm-export-bar">
      {exports.map(e => (
        <button key={e.tipo} className="adm-btn adm-btn--sm" onClick={() => download(e.tipo)}>
          <Download size={13} />
          {e.label}
        </button>
      ))}
    </div>
  )
}
