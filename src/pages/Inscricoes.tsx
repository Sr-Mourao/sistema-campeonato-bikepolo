import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, CreditCard, CheckCircle2, Clock, AlertTriangle, Lock } from 'lucide-react'
import './Inscricoes.css'
import PaymentCheckout from '../components/atleta/PaymentCheckout'
import type { Pagamento } from '../components/atleta/AthleteDashboard'
import SiteNavbar from '../components/SiteNavbar'

import { CONFIG, type PacoteAlim } from '../inscricoes.config'
import DadosPessoais from '../components/inscricoes/DadosPessoais'
import type { DadosPessoaisValues } from '../components/inscricoes/DadosPessoais'
import ContatoEmergencia from '../components/inscricoes/ContatoEmergencia'
import type { ContatoEmergenciaValues } from '../components/inscricoes/ContatoEmergencia'
import InformacoesSaude from '../components/inscricoes/InformacoesSaude'
import type { InformacoesSaudeValues } from '../components/inscricoes/InformacoesSaude'
import TipoParticipacaoSection from '../components/inscricoes/TipoParticipacao'
import type { TipoParticipacao } from '../components/inscricoes/TipoParticipacao'
import CategoriasSection from '../components/inscricoes/CategoriasSection'
import AcoesAfirmativas from '../components/inscricoes/AcoesAfirmativas'
import PrimeiroTorneioSection from '../components/inscricoes/PrimeiroTorneioSection'
import TimesSection from '../components/inscricoes/TimesSection'
import type { TimeState } from '../components/inscricoes/TimesSection'
import LatinoSection from '../components/inscricoes/LatinoSection'
import AlimentacaoSection from '../components/inscricoes/AlimentacaoSection'
import AlojamentoSection from '../components/inscricoes/AlojamentoSection'
import TermosParticipacao from '../components/inscricoes/TermosParticipacao'
import ResumoFinanceiroFloating from '../components/inscricoes/ResumoFinanceiroFloating'
import ResumoFinal from '../components/inscricoes/ResumoFinal'

interface TimeResultado { cat: string; nome: string; codigo: string }

interface Resultado {
  inscricao_id: number
  valor_total: number
  times: TimeResultado[]
  pagamento: Pagamento & { checkout_token: string }
}

function CopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard?.writeText(codigo).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }
  return (
    <button className="ins-success-copy-btn" onClick={copiar} type="button">
      {copiado ? '✓ Copiado!' : 'Copiar código'}
    </button>
  )
}

const TIME_INIT: TimeState = {
  acao: 'criar',
  nome: '',
  codigo: '',
  timeInfo: null,
  timeLoading: false,
  timeError: '',
}

const DADOS_INIT: DadosPessoaisValues = {
  nome: '',
  email: '',
  ddi: '55',
  telefone: '',
  genero: 'Mulher cis',
  generoDescricao: '',
  clubeId: null,
  clubeNome: '',
  cidade: '',
  nacionalidade: 'brasileire',
}

const EMERG_INIT: ContatoEmergenciaValues = { nome: '', relacao: '', telefone: '' }
const SAUDE_INIT: InformacoesSaudeValues  = { possuiPlanoSaude: null, planoSaude: '', numeroCarteirinha: '' }

export default function Inscricoes() {
  const timeSectionRef = useRef<HTMLDivElement>(null)

  // Form state — dados pessoais
  const [dados, setDados]     = useState<DadosPessoaisValues>(DADOS_INIT)

  // Contato de emergência
  const [emerg, setEmerg] = useState<ContatoEmergenciaValues>(EMERG_INIT)
  const [emergErrors, setEmergErrors] = useState<Partial<Record<keyof ContatoEmergenciaValues, string>>>({})

  // Informações de saúde
  const [saude, setSaude] = useState<InformacoesSaudeValues>(SAUDE_INIT)

  // Tipo de participação
  const [tipoParticipacao, setTipoParticipacao] = useState<TipoParticipacao>('atleta')

  // Categorias e descontos (só atletas)
  const [misto, setMisto]     = useState(false)
  const [acaoPreta, setAcaoPreta]               = useState(false)
  const [acaoParda, setAcaoParda]               = useState(false)
  const [acaoIndigena, setAcaoIndigena]         = useState(false)
  const [acaoPrimeiroTorneio, setAcaoPrimeiroTorneio] = useState(false)
  const [timeMisto, setTimeMisto] = useState<TimeState>(TIME_INIT)
  const [latino, setLatino]       = useState<boolean | null>(null)

  // Serviços
  const [alimDia5, setAlimDia5]         = useState<PacoteAlim>(null)
  const [alimDia6, setAlimDia6]         = useState<PacoteAlim>(null)
  const [alimDia7, setAlimDia7]         = useState<PacoteAlim>(null)
  const [restricaoTipo, setRestricaoTipo]           = useState<string | null>(null)
  const [restricaoDescricao, setRestricaoDescricao] = useState('')
  const [diasAloj, setDiasAloj] = useState<number[]>([])

  // Termos
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [termosError, setTermosError]     = useState('')

  // Email duplicado
  const [emailExiste, setEmailExiste] = useState(false)
  const emailCheckRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Errors + submit
  const [errors, setErrors] = useState<Partial<Record<keyof DadosPessoaisValues | 'categorias', string>>>({})
  const [timeErrors, setTimeErrors] = useState<{ misto?: string; mtnb?: string }>({})
  const [catError, setCatError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [checkoutAberto, setCheckoutAberto] = useState(false)

  // Abertura das inscrições — consultada no backend, nunca assumida no frontend
  const [inscricoesAbertas, setInscricoesAbertas] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/inscricoes.php')
      .then(res => res.json())
      .then(data => setInscricoesAbertas(Boolean(data?.inscricoes_abertas)))
      .catch(() => setInscricoesAbertas(false))
  }, [])

  function patchDados(field: keyof DadosPessoaisValues, value: string | number | null) {
    if (field === 'email') {
      clearTimeout(emailCheckRef.current)
      setEmailExiste(false)
      const next = String(value ?? '').trim()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
        emailCheckRef.current = setTimeout(async () => {
          try {
            const res = await fetch(`/api/check-email.php?email=${encodeURIComponent(next)}`)
            if (res.ok) {
              const data = await res.json()
              if (data.exists) {
                setEmailExiste(true)
                setErrors(prev => ({
                  ...prev,
                  email: 'Este email já tem uma inscrição — acesse a área da pessoa atleta',
                }))
              }
            }
          } catch { /* silencioso */ }
        }, 700)
      }
    }
    setDados(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  function patchEmerg(field: keyof ContatoEmergenciaValues, value: string) {
    setEmerg(prev => ({ ...prev, [field]: value }))
    setEmergErrors(prev => ({ ...prev, [field]: '' }))
  }

  function patchSaude(field: keyof InformacoesSaudeValues, value: boolean | null | string) {
    setSaude(prev => ({ ...prev, [field]: value }))
  }

  const patchTime = useCallback((cat: 'misto', field: keyof TimeState, value: unknown) => {
    if (cat === 'misto') setTimeMisto(prev => ({ ...prev, [field]: value }))
    if (field === 'codigo' || field === 'acao') {
      setTimeErrors(prev => ({ ...prev, [cat]: undefined }))
    }
  }, [])

  function validate(): { ok: boolean; scrollToTimes: boolean } {
    const errs: typeof errors = {}
    let ok = true
    let hasFieldError = false

    if (!dados.nome.trim()) { errs.nome = 'Coloca seu nome aqui 💛'; ok = false; hasFieldError = true }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)
    if (!emailOk) { errs.email = 'Email inválido'; ok = false; hasFieldError = true }
    else if (emailExiste) { errs.email = 'Este email já tem uma inscrição — acesse a área da pessoa atleta'; ok = false; hasFieldError = true }

    // Contato de emergência
    const newEmergErrors: Partial<Record<keyof ContatoEmergenciaValues, string>> = {}
    if (!emerg.nome.trim())     { newEmergErrors.nome = 'Informe o nome do contato'; ok = false; hasFieldError = true }
    if (!emerg.relacao.trim())  { newEmergErrors.relacao = 'Informe a relação'; ok = false; hasFieldError = true }
    if (!emerg.telefone.trim()) { newEmergErrors.telefone = 'Informe o telefone'; ok = false; hasFieldError = true }
    setEmergErrors(newEmergErrors)

    // Categorias (só atletas)
    if (tipoParticipacao === 'atleta') {
      if (!misto) { setCatError('Selecione pelo menos uma categoria'); ok = false; hasFieldError = true }
      else setCatError('')
    }

    // Times (só atletas)
    const newTimeErrors: { misto?: string; mtnb?: string } = {}
    if (tipoParticipacao === 'atleta') {
      if (misto && timeMisto.acao === 'entrar' && timeMisto.timeInfo) {
        if (timeMisto.timeInfo.total_membros >= CONFIG.LIMITE_MISTO) {
          newTimeErrors.misto = 'Este time está cheio — escolha outro ou crie um novo'
          ok = false
        }
      }
      setTermosError('Você precisa aceitar os termos para continuar')
      ok = false
      hasFieldError = true
    } else {
      setTermosError('')
    }

    setErrors(errs)
    const hasTimeError = Object.keys(newTimeErrors).length > 0
    return { ok, scrollToTimes: hasTimeError && !hasFieldError }
  }

  async function handleSubmit() {
    const { ok, scrollToTimes } = validate()
    if (!ok) {
      if (scrollToTimes && timeSectionRef.current) {
        timeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    setSubmitting(true)
    setSubmitError('')

    const categorias: string[] = []
    if (tipoParticipacao === 'atleta') {
      if (misto) categorias.push('misto')
    }

    const alimentacao: { dia: number; pacote: string }[] = []
    if (alimDia5) alimentacao.push({ dia: 5, pacote: alimDia5 })
    if (alimDia6) alimentacao.push({ dia: 6, pacote: alimDia6 })
    if (alimDia7) alimentacao.push({ dia: 7, pacote: alimDia7 })

    const alojamento: number[] = diasAloj

    const body = {
      nome:              dados.nome.trim(),
      email:             dados.email.trim(),
      ddi:               dados.ddi,
      telefone:          dados.telefone,
      genero:            dados.genero,
      generoDescricao:   dados.generoDescricao,
      clubeId:           dados.clubeId,
      clubeNome:         dados.clubeNome,
      cidade:            dados.cidade,
      nacionalidade:     dados.nacionalidade,
      tipoParticipacao,
      emergNome:         emerg.nome.trim(),
      emergRelacao:      emerg.relacao.trim(),
      emergTelefone:     emerg.telefone.trim(),
      possuiPlanoSaude:  saude.possuiPlanoSaude ?? false,
      planoSaude:        saude.planoSaude.trim() || null,
      numeroCarteirinha: saude.numeroCarteirinha.trim() || null,
      aceitouTermos,
      categorias,
      acoesAfirmativas:  acaoPreta || acaoParda || acaoIndigena,
      acaoPreta,
      acaoParda,
      acaoIndigena,
      acaoPrimeiroTorneio,
      timeMisto: {
        acao:   timeMisto.acao,
        nome:   timeMisto.nome,
        codigo: timeMisto.codigo,
      },
      latino,
      alimentacao,
      alojamento,
      restricaoTipo:      restricaoTipo || null,
      restricaoDescricao: restricaoDescricao.trim() || null,
    }

    try {
      const res = await fetch('/api/inscricoes.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Erro ao salvar inscrição')
      } else {
        setResultado(data)
        if ((data.pagamento?.valor ?? 0) > 0) setCheckoutAberto(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch {
      setSubmitError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Carregando status das inscrições ────────────────────
  if (inscricoesAbertas === null && !resultado) {
    return (
      <div className="ins-page">
        <SiteNavbar currentPath="/inscricoes" scrollThreshold={120} />
        <main className="ins-main">
          <div className="ins-closed">
            <span className="ins-closed-spinner" />
          </div>
        </main>
      </div>
    )
  }

  // ── Inscrições encerradas ────────────────────────────────
  if (inscricoesAbertas === false && !resultado) {
    return (
      <div className="ins-page">
        <SiteNavbar currentPath="/inscricoes" scrollThreshold={120} />
        <main className="ins-main">
          <div className="ins-closed">
            <div className="ins-closed-icon"><Lock size={30} strokeWidth={1.5} /></div>
            <h1 className="ins-closed-title">Inscrições encerradas</h1>
            <p className="ins-closed-sub">
              O período de inscrições para o 2° Pior Campeonato de Bici Polo foi encerrado.
              Agradecemos a participação de todos! 💛
            </p>
            <p className="ins-closed-sub">
              Já tem inscrição? Você ainda pode contratar ou ajustar alojamento e alimentação na{' '}
              <a href="/minha-inscricao" className="ins-closed-link">área da pessoa atleta</a>.
            </p>
            <a href="/" className="ins-success-back">
              <ArrowLeft size={14} /> Voltar à página principal
            </a>
          </div>
        </main>
      </div>
    )
  }

  // ── Tela de sucesso ────────────────────────────────────
  if (resultado) {
    const primeiroNome = dados.nome.split(' ')[0]
    const timesCriados = resultado.times ?? []
    const pg = resultado.pagamento

    function fmtVal(v: number) {
      return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
    }

    return (
      <div className="ins-page">
        <SiteNavbar currentPath="/inscricoes" scrollThreshold={120} />

        <main className="ins-main">
          <div className="ins-success">
            <div className="ins-success-icon">🎉</div>
            <h1 className="ins-success-title">Inscrição realizada!</h1>
            <p style={{ color: 'rgba(255,255,255,.60)', fontSize: 16, lineHeight: 1.55, maxWidth: 440, textAlign: 'center' }}>
              Boa, <strong style={{ color: '#fff' }}>{primeiroNome}</strong>!
              {timesCriados.length > 0
                ? ' Compartilhe o código do seu time com a galera — é assim que eles entram.'
                : ' Sua inscrição foi salva com sucesso.'
              }
            </p>

            {timesCriados.map(t => (
              <div key={t.codigo} className="ins-success-team-card">
                <p className="ins-success-team-label">
                  {t.cat === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB'} · {t.nome}
                </p>
                <p className="ins-success-team-code">{t.codigo}</p>
                <p className="ins-success-team-hint">
                  Compartilhe esse código com as outras pessoas do time.<br />
                  Elas entram pelo formulário de inscrição, aba "Entrar em time existente".
                </p>
                <CopiarCodigo codigo={t.codigo} />
              </div>
            ))}

            {pg.valor > 0 ? (
              <div className="ins-success-payment">
                {(pg.itens ?? []).map((it, i) => (
                  <div key={i} className="ins-success-payment-row" style={{ marginBottom: 8 }}>
                    <span className="ins-success-payment-label" style={{
                      color: it.valor < 0 ? '#4CE0A8' : 'rgba(255,255,255,0.55)',
                    }}>
                      {it.descricao}
                    </span>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: it.valor < 0 ? '#4CE0A8' : 'rgba(255,255,255,0.75)',
                    }}>
                      {it.valor < 0 ? `− ${fmtVal(Math.abs(it.valor))}` : fmtVal(it.valor)}
                    </span>
                  </div>
                ))}
                <div className="ins-success-payment-row" style={{
                  marginBottom: 14, marginTop: 6,
                  borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 12,
                }}>
                  <span className="ins-success-payment-label" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.80)' }}>
                    Total
                  </span>
                  <span className="ins-success-payment-val">{fmtVal(pg.valor)}</span>
                </div>
                <div className="ins-success-payment-status">
                  {pg.status === 'pago' ? (
                    <span className="ins-success-badge ins-success-badge--pago">
                      <CheckCircle2 size={12} /> Pago
                    </span>
                  ) : pg.status === 'cancelado' ? (
                    <>
                      <span className="ins-success-badge ins-success-badge--cancelado">
                        <AlertTriangle size={12} /> Pagamento não aprovado
                      </span>
                      <button
                        className="ins-success-pay-btn"
                        onClick={() => setCheckoutAberto(true)}
                      >
                        <CreditCard size={13} /> Tentar pagar novamente
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="ins-success-badge ins-success-badge--pendente">
                        <Clock size={12} /> Aguardando pagamento
                      </span>
                      <button
                        className="ins-success-pay-btn"
                        onClick={() => setCheckoutAberto(true)}
                      >
                        <CreditCard size={13} /> Pagar agora
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="ins-success-payment">
                <div className="ins-success-payment-status">
                  <span className="ins-success-badge ins-success-badge--pago">
                    <CheckCircle2 size={12} /> Inscrição isenta de pagamento
                  </span>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.40)', lineHeight: 1.6, textAlign: 'left' }}>
                  Nenhum pagamento é necessário para sua inscrição. Se quiser contratar
                  alimentação ou alojamento, você pode fazer isso a qualquer momento na{' '}
                  <a href="/minha-inscricao" style={{ color: '#F8A23C' }}>área do participante</a>.
                </p>
              </div>
            )}

            <div className="ins-success-access">
              <p className="ins-success-access-title">Acompanhe sua inscrição</p>
              <p className="ins-success-access-sub">
                Em <a href="/minha-inscricao" className="ins-success-access-link">/minha-inscricao</a> você
                acompanha pagamentos e pode contratar ou alterar serviços. Só precisa do seu email — sem senha.
              </p>
            </div>

            <a href="/" className="ins-success-back">
              <ArrowLeft size={14} /> Voltar à página principal
            </a>
          </div>
        </main>

        {checkoutAberto && pg && (
          <PaymentCheckout
            pagamento={pg}
            checkoutToken={pg.checkout_token}
            onPaid={updated => {
              setResultado(prev => prev ? {
                ...prev,
                pagamento: {
                  ...prev.pagamento,
                  ...updated,
                  checkout_token: prev.pagamento.checkout_token,
                },
              } : prev)
              setCheckoutAberto(false)
            }}
            onClose={() => setCheckoutAberto(false)}
            onPaymentCancelled={() => {
              setResultado(prev => prev ? {
                ...prev,
                pagamento: {
                  ...prev.pagamento,
                  status: 'cancelado',
                },
              } : prev)
            }}
          />
        )}
      </div>
    )
  }

  // ── Formulário ─────────────────────────────────────────
  const calcState = {
    misto:   tipoParticipacao === 'atleta' ? misto : false,
    acaoPreta, acaoParda, acaoIndigena, acaoPrimeiroTorneio,
    alimentacaoDia5: alimDia5, alimentacaoDia6: alimDia6, alimentacaoDia7: alimDia7,
    alojamento: true,
    diasAlojamento: diasAloj,
  }

  const ehAtleta = tipoParticipacao === 'atleta'

  return (
    <div className="ins-page">
      {emailExiste && (
        <div className="ins-modal-overlay" onClick={() => setEmailExiste(false)}>
          <div className="ins-modal" onClick={e => e.stopPropagation()}>
            <div className="ins-modal-icon">📬</div>
            <h2 className="ins-modal-title">Email já cadastrado</h2>
            <p className="ins-modal-body">
              O email <strong>{dados.email.trim()}</strong> já tem uma inscrição no CB10.
              Quer acessar a área da pessoa atleta?
            </p>
            <a
              href={`/minha-inscricao?email=${encodeURIComponent(dados.email.trim().toLowerCase())}`}
              className="ins-modal-btn-primary"
            >
              Entrar na minha inscrição
            </a>
            <button
              type="button"
              className="ins-modal-btn-secondary"
              onClick={() => { setEmailExiste(false); patchDados('email', '') }}
            >
              Usar outro email
            </button>
          </div>
        </div>
      )}

      <SiteNavbar currentPath="/inscricoes" scrollThreshold={120} />

      <main className="ins-main">
        <header className="ins-hero">
          <p className="ins-hero-eyebrow">5–7 de Setembro · Curitiba/PR</p>
          <h1 className="ins-hero-title">Inscrições</h1>
          <p className="ins-hero-sub">
            2° Pior Campeonato de Bici Polo · 4º Brasileiro MTNB
          </p>
        </header>

        <section className="ins-intro" aria-labelledby="ins-intro-title">
          <p className="ins-intro-eyebrow">Como Funciona</p>
          <h2 id="ins-intro-title" className="ins-intro-title">Inscrição individual 💛</h2>
          <div className="ins-intro-body">
            <p>
              A inscrição para o campeonato é realizada individualmente para facilitar a
              organização das equipes.
            </p>
            <p>
              Assim, ninguém precisa ficar responsável por reunir os dados de todas as
              pessoas do time, calcular descontos, cobrar valores ou concentrar os
              pagamentos da equipe. Cada participante realiza sua própria inscrição,
              informa seus dados, seleciona as categorias que pretende disputar e efetua
              seu pagamento de forma independente.
            </p>
            <p>
              Todos os valores exibidos neste formulário são individuais e correspondem
              apenas à sua participação.
            </p>
            <p>
              Durante a inscrição, você poderá criar uma nova equipe ou informar uma
              equipe já criada por outra pessoa. Dessa forma, os times são formados
              normalmente, mas cada atleta mantém sua inscrição e pagamento sob sua
              própria responsabilidade.
            </p>
          </div>
        </section>

        <div className="ins-layout">
          <div>
            <DadosPessoais
              values={dados}
              errors={errors}
              onChange={patchDados}
            />

            <ContatoEmergencia
              values={emerg}
              errors={emergErrors}
              onChange={patchEmerg}
            />

            <InformacoesSaude
              values={saude}
              onChange={patchSaude}
            />

            <TipoParticipacaoSection
              value={tipoParticipacao}
              onChange={v => {
                setTipoParticipacao(v)
                if (v === 'acompanhante') {
                  setAcaoPreta(false); setAcaoParda(false)
                  setAcaoIndigena(false); setAcaoPrimeiroTorneio(false)
                  setCatError('')
                }
              }}
            />

            {ehAtleta && (
              <>
                <CategoriasSection
                  genero={dados.genero}
                  misto={misto}
                  onChange={(f, v) => {
                    if (f === 'misto') setMisto(v)
                    setCatError('')
                  }}
                  error={catError}
                />

                <AcoesAfirmativas
                  preta={acaoPreta}
                  parda={acaoParda}
                  indigena={acaoIndigena}
                  onChange={(field, val) => {
                    if (field === 'preta')    setAcaoPreta(val)
                    if (field === 'parda')    setAcaoParda(val)
                    if (field === 'indigena') setAcaoIndigena(val)
                  }}
                />

                <PrimeiroTorneioSection
                  checked={acaoPrimeiroTorneio}
                  desativado={false}
                  onChange={setAcaoPrimeiroTorneio}
                />

                {misto && (
                  <div ref={timeSectionRef}>
                    <TimesSection
                      misto={misto}
                      timeMisto={timeMisto}
                      onChange={patchTime}
                      errors={timeErrors}
                    />
                  </div>
                )}

                <LatinoSection
                  latino={latino}
                  nacionalidade={dados.nacionalidade}
                  onChange={setLatino}
                />
              </>
            )}

            <AlimentacaoSection
              dia5={alimDia5}
              dia6={alimDia6}
              dia7={alimDia7}
              onChange={(dia, val) => {
                if (dia === '5') setAlimDia5(val)
                else if (dia === '6') setAlimDia6(val)
                else setAlimDia7(val)
              }}
              restricaoTipo={restricaoTipo}
              restricaoDescricao={restricaoDescricao}
              onRestricaoChange={(t, d) => { setRestricaoTipo(t); setRestricaoDescricao(d) }}
            />

            <AlojamentoSection
              selecionados={diasAloj}
              onChange={(dia, val) => {
                setDiasAloj(prev => val ? [...prev, dia] : prev.filter(d => d !== dia))
              }}
            />

            <TermosParticipacao
              aceito={aceitouTermos}
              onChange={v => { setAceitouTermos(v); if (v) setTermosError('') }}
              error={termosError}
            />

            <ResumoFinal
              form={{
                tipoParticipacao,
                nome: dados.nome, email: dados.email,
                clubeNome: dados.clubeNome, genero: dados.genero,
                timeMistoNome: timeMisto.nome, timeMistoAcao: timeMisto.acao, timeMistoCodigo: timeMisto.codigo,
                latino,
                aceitouTermos,
                ...calcState,
              }}
              submitting={submitting}
              error={submitError}
              emailExiste={emailExiste}
              onSubmit={handleSubmit}
            />
          </div>

          <div>
            <ResumoFinanceiroFloating state={calcState} />
          </div>
        </div>
      </main>
    </div>
  )
}
