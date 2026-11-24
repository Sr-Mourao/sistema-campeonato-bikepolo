import { CheckCircle } from 'lucide-react'
import { calcTotal, type PacoteAlim } from '../../inscricoes.config'
import type { TipoParticipacao } from './TipoParticipacao'

interface FormSummary {
  tipoParticipacao: TipoParticipacao
  nome: string; email: string; clubeNome: string; genero: string
  misto: boolean
  timeMistoNome: string; timeMistoAcao: string; timeMistoCodigo: string
  latino: boolean | null
  acaoPreta: boolean; acaoParda: boolean
  acaoIndigena: boolean; acaoPrimeiroTorneio: boolean
  alimentacaoDia5: PacoteAlim; alimentacaoDia6: PacoteAlim; alimentacaoDia7: PacoteAlim
  alojamento: boolean
  diasAlojamento: number[]
  aceitouTermos: boolean
  acoesAtivas?: boolean
}

interface Props {
  form: FormSummary
  submitting: boolean
  error: string
  emailExiste: boolean
  onSubmit: () => void
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const DESCONTO_LABEL: Record<string, string> = {
  ppi:             'Isenção ações afirmativas',
  primeiroTorneio: 'Desconto primeiro torneio (50%)',
}

export default function ResumoFinal({ form, submitting, error, emailExiste, onSubmit }: Props) {
  const {
    valorMistoBase, subtotalBase,
    descontoValor, descontoTipo,
    temPPI, temPrimeiroTorneio,
    valorEsportivo, valorAlim, valorAloj, total,
  } = calcTotal(form)

  const ehAtleta = form.tipoParticipacao === 'atleta'

  const categorias: string[] = []
  if (form.misto) categorias.push('Brasileiro Misto')

  const acoesPPI: string[] = []
  if (form.acaoPreta)    acoesPPI.push('Pessoa preta')
  if (form.acaoParda)    acoesPPI.push('Pessoa parda')
  if (form.acaoIndigena) acoesPPI.push('Pessoa indígena')

  const diasAlimNomes: string[] = []
  if (form.alimentacaoDia5) diasAlimNomes.push('5/set')
  if (form.alimentacaoDia6) diasAlimNomes.push('6/set')
  if (form.alimentacaoDia7) diasAlimNomes.push('7/set')

  const diasAlojNomes = form.diasAlojamento.slice().sort((a, b) => a - b).map(d => `${d}/set`)

  const temServicos = valorAlim > 0 || valorAloj > 0

  const semCategoriaAtleta = ehAtleta && categorias.length === 0
  const btnDisabled = submitting || semCategoriaAtleta || emailExiste || !form.aceitouTermos

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><CheckCircle size={18} /></div>
        <div>
          <div className="ins-card-title">Resumo da Inscrição</div>
          <div className="ins-card-subtitle">Confira tudo antes de finalizar</div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="ins-summary-block">
        <p className="ins-summary-block-title">Dados Pessoais</p>
        <div className="ins-summary-row"><span>{form.nome}</span></div>
        <div className="ins-summary-row"><span>{form.email}</span></div>
        {form.genero    && <div className="ins-summary-row"><span>{form.genero}</span></div>}
        {form.clubeNome && <div className="ins-summary-row"><span>{form.clubeNome}</span></div>}
        <div className="ins-summary-row">
          <span style={{ color: 'rgba(255,255,255,0.50)' }}>Participação</span>
          <span>{ehAtleta ? 'Atleta' : 'Acompanhante / Apoio'}</span>
        </div>
      </div>

      {/* Categorias (só atletas) */}
      {ehAtleta && categorias.length > 0 && (
        <div className="ins-summary-block">
          <p className="ins-summary-block-title">Categorias</p>
          {form.misto && (
            <div className="ins-summary-row">
              <span>Brasileiro Misto</span>
              <span>{fmt(valorMistoBase)}</span>
            </div>
          )}
        </div>
      )}

      {/* Times (só atletas) */}
      {ehAtleta && form.misto && (
        <div className="ins-summary-block">
          <p className="ins-summary-block-title">Times</p>
          {form.misto && (
            <div className="ins-summary-row">
              <span>Misto — {form.timeMistoAcao === 'criar'
                ? `Criando "${form.timeMistoNome}"`
                : `Entrando no time ${form.timeMistoCodigo}`
              }</span>
            </div>
          )}
        </div>
      )}

      {/* Inscrição esportiva (só atletas) */}
      {ehAtleta && (
        <div className="ins-summary-block">
          <p className="ins-summary-block-title">Inscrição Esportiva</p>
          {subtotalBase > 0 && (
            <div className="ins-summary-row">
              <span>Subtotal</span>
              <span>{fmt(subtotalBase)}</span>
            </div>
          )}
          {descontoValor > 0 && descontoTipo && (
            <div className="ins-summary-row ins-summary-row--discount">
              <span>{DESCONTO_LABEL[descontoTipo]}</span>
              <span className="ins-summary-row-val">− {fmt(descontoValor)}</span>
            </div>
          )}
          <div className="ins-summary-row ins-summary-row--subtotal">
            <span>Total esportivo</span>
            <span>{fmt(valorEsportivo)}</span>
          </div>
        </div>
      )}

      {/* Serviços opcionais */}
      <div className="ins-summary-block">
        <p className="ins-summary-block-title">
          Serviços Opcionais
          {!temServicos && (
            <span className="ins-summary-block-note">nenhum selecionado</span>
          )}
        </p>
        {valorAlim > 0 && (
          <div className="ins-summary-row">
            <span>Alimentação ({diasAlimNomes.join(', ')})</span>
            <span>{fmt(valorAlim)}</span>
          </div>
        )}
        {valorAloj > 0 && (
          <div className="ins-summary-row">
            <span>Alojamento ({diasAlojNomes.join(', ')})</span>
            <span>{fmt(valorAloj)}</span>
          </div>
        )}
        {!temServicos && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>
            Você pode contratar alimentação e alojamento depois pela área do participante.
          </p>
        )}
      </div>

      {/* Total */}
      <div className="ins-summary-row ins-summary-row--total" style={{ marginTop: 4 }}>
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>

      {form.latino === true && (
        <div className="ins-info-box ins-info-box--green" style={{ marginBottom: 16, marginTop: 16 }}>
          🌎 <strong>Você optou por disputar vaga para o Latinoamericano 2026</strong>
        </div>
      )}

      {temPPI && acoesPPI.length > 0 && (
        <div className="ins-info-box ins-info-box--green" style={{ marginBottom: 16, marginTop: form.latino !== true ? 16 : 0 }}>
          💛 <strong>Isenção ações afirmativas:</strong> {acoesPPI.join(', ')}
        </div>
      )}

      {temPrimeiroTorneio && !temPPI && (
        <div className="ins-info-box ins-info-box--green" style={{ marginBottom: 16, marginTop: form.latino !== true ? 16 : 0 }}>
          🌟 <strong>Desconto primeiro torneio:</strong> 50% aplicado
        </div>
      )}

      {!form.aceitouTermos && (
        <div className="ins-info-box" style={{ marginBottom: 16, marginTop: 16 }}>
          Aceite os Termos de Participação para finalizar sua inscrição.
        </div>
      )}

      {error && (
        <div className="ins-info-box ins-info-box--red" style={{ marginBottom: 16 }}>
          <strong>Opa!</strong> {error}
        </div>
      )}

      <button
        type="button"
        className={`ins-btn${submitting ? ' ins-btn--loading' : ''}`}
        onClick={onSubmit}
        disabled={btnDisabled}
      >
        {submitting ? (
          <>
            <span className="ins-spinner" />
            Salvando…
          </>
        ) : (
          `Finalizar inscrição — ${fmt(total)}`
        )}
      </button>

      <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,.35)', textAlign: 'center', lineHeight: 1.5 }}>
        Você receberá um email de confirmação. O pagamento será informado em breve.
      </p>
    </section>
  )
}
