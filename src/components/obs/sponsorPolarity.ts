/**
 * As logos dos apoiadores vêm em polaridades imprevisíveis: arte escura recortada,
 * arte branca recortada, JPEG com fundo branco embutido, PNG com fundo preto embutido.
 * Uma placa de cor fixa faria metade das marcas sumir, então a placa se adapta à marca.
 *
 * A moldura da imagem entrega o caso: se as bordas são opacas, a arte carrega fundo próprio
 * e a placa acompanha esse fundo (o retângulo desaparece); se são transparentes, a arte é
 * recortada e a placa faz o contraste.
 */
export type Polaridade = 'clara' | 'escura'

export interface AmostraMarca {
  /** Pixels com alpha relevante no quadro inteiro. */
  opacos: number
  /** Fração de pixels opacos na moldura da imagem. */
  bordaOpaca: number
  /** Luminância média dos pixels opacos da moldura. */
  bordaLuminancia: number
  /** Fração dos pixels opacos com luminância alta. */
  arteClara: number
  /** Fração dos pixels opacos com luminância baixa. */
  arteEscura: number
}

const LIMITE_CLARO = 0.72
const LIMITE_ESCURO = 0.3
/** Acima disso a imagem tem fundo próprio em vez de recorte. */
const LIMITE_FUNDO_PROPRIO = 0.6

export function placaDaMarca(amostra: AmostraMarca): Polaridade {
  if (amostra.opacos <= 0) return 'clara'
  if (amostra.bordaOpaca > LIMITE_FUNDO_PROPRIO) {
    return amostra.bordaLuminancia > 0.5 ? 'clara' : 'escura'
  }
  const arteBranca = amostra.arteClara > 0.5 && amostra.arteEscura < 0.15
  return arteBranca ? 'escura' : 'clara'
}

/** Amostra a arte num canvas. Devolve null quando o browser não permite ler os pixels. */
export async function medirMarca(src: string): Promise<AmostraMarca | null> {
  try {
    const imagem = new Image()
    imagem.src = src
    await imagem.decode()

    const largura = 96
    const altura = Math.max(1, Math.round(largura * imagem.naturalHeight / imagem.naturalWidth))
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(imagem, 0, 0, largura, altura)

    const { data } = ctx.getImageData(0, 0, largura, altura)
    const margemX = Math.max(1, Math.round(largura * 0.06))
    const margemY = Math.max(1, Math.round(altura * 0.06))

    let opacos = 0, claros = 0, escuros = 0
    let bordaTotal = 0, bordaOpacos = 0, bordaLuz = 0

    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        const i = (y * largura + x) * 4
        const naBorda = x < margemX || x >= largura - margemX || y < margemY || y >= altura - margemY
        const opaco = data[i + 3] >= 24
        const luminancia = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
        if (naBorda) {
          bordaTotal++
          if (opaco) { bordaOpacos++; bordaLuz += luminancia }
        }
        if (!opaco) continue
        opacos++
        if (luminancia > LIMITE_CLARO) claros++
        else if (luminancia < LIMITE_ESCURO) escuros++
      }
    }

    return {
      opacos,
      bordaOpaca: bordaTotal ? bordaOpacos / bordaTotal : 0,
      bordaLuminancia: bordaOpacos ? bordaLuz / bordaOpacos : 0,
      arteClara: opacos ? claros / opacos : 0,
      arteEscura: opacos ? escuros / opacos : 0,
    }
  } catch {
    return null
  }
}
