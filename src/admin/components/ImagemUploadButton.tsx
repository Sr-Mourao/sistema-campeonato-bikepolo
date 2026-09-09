import { useRef, useState } from 'react'

interface Props {
  label: string
  /** Recebe o Blob já redimensionado/convertido — o caller decide o endpoint/campo do form. */
  onUpload: (blob: Blob) => Promise<boolean>
  /** Lado máximo em px antes de reamostrar (seção "normalização" da migração de mídia). */
  maxDim?: number
  disabled?: boolean
}

/**
 * Botão de upload de imagem que já normaliza no NAVEGADOR antes de mandar pro servidor —
 * redimensiona (maxDim) e converte pra WebP via Canvas. Não depende de GD/Imagick no
 * servidor (não disponíveis neste ambiente). `createImageBitmap({imageOrientation:
 * 'from-image'})` já corrige orientação EXIF na hora de desenhar no canvas.
 */
export default function ImagemUploadButton({ label, onUpload, maxDim = 800, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo numa próxima tentativa
    if (!file) return
    setErro('')
    setEnviando(true)
    try {
      const blob = await normalizarImagem(file, maxDim)
      const ok = await onUpload(blob)
      if (!ok) setErro('Não foi possível enviar a imagem.')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao processar a imagem.')
    }
    setEnviando(false)
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button type="button" className="adm-btn adm-btn--sm" disabled={disabled || enviando} onClick={() => inputRef.current?.click()}>
        {enviando ? 'Enviando…' : label}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onChange} />
      {erro && <span className="adm-badge adm-badge--err" style={{ fontSize: '.68rem' }}>{erro}</span>}
    </span>
  )
}

async function normalizarImagem(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let { width, height } = bitmap
  if (width > maxDim || height > maxDim) {
    const escala = Math.min(maxDim / width, maxDim / height)
    width = Math.max(1, Math.round(width * escala))
    height = Math.max(1, Math.round(height * escala))
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não suporta o processamento de imagem necessário.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Falha ao converter a imagem.'))),
      'image/webp',
      0.86
    )
  })
}
