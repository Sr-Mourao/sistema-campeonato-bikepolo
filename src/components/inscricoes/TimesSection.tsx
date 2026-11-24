import { useState, useEffect, useRef, useCallback } from 'react'
import { Users, Plus, Key } from 'lucide-react'
import { CONFIG } from '../../inscricoes.config'

export interface TimeState {
  acao: 'criar' | 'entrar'
  nome: string
  codigo: string
  timeInfo: TimeInfo | null
  timeLoading: boolean
  timeError: string
}

interface TimeInfo {
  id: number
  nome: string
  categoria: string
  total_membros: number
  atletas: string[]
}

interface Props {
  misto: boolean
  timeMisto: TimeState
  onChange: (cat: 'misto', field: keyof TimeState, value: unknown) => void
  errors?: { misto?: string }
}

function TeamBlock({
  categoria,
  label,
  limite,
  state,
  onChange,
  externalError,
}: {
  categoria: 'misto' | 'mtnb'
  label: string
  limite: number
  state: TimeState
  onChange: (field: keyof TimeState, value: unknown) => void
  externalError?: string
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const showModal = Boolean(externalError) && externalError !== dismissedError

  useEffect(() => {
    if (state.acao !== 'entrar') {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
      onChange('timeLoading', false)
      return
    }
    const cod = state.codigo.trim()
    if (cod.length < 6) {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
      onChange('timeLoading', false)
      onChange('timeInfo', null)
      onChange('timeError', '')
      return
    }

    clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    onChange('timeLoading', true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      const kill = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(
          `/api/times.php?codigo=${encodeURIComponent(cod.toUpperCase())}&categoria=${categoria}`,
          { signal: controller.signal }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          onChange('timeInfo', null)
          onChange('timeError', (data as { error?: string }).error || 'Time não encontrado')
        } else {
          onChange('timeInfo', data as TimeInfo)
          onChange('timeError', '')
        }
      } catch (e) {
        onChange('timeInfo', null)
        const aborted =
          (e instanceof DOMException && e.name === 'AbortError') ||
          (typeof e === 'object' && e !== null && 'name' in e && (e as { name?: string }).name === 'AbortError')
        onChange('timeError', aborted ? 'Tempo esgotado ao buscar time' : 'Erro ao buscar time')
      } finally {
        clearTimeout(kill)
        onChange('timeLoading', false)
      }
    }, 500)

    return () => {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [state.codigo, state.acao, categoria, onChange])

  const vagasOcupadas = state.timeInfo?.total_membros ?? 0
  const vagas = limite - vagasOcupadas
  const timeCheio = vagas <= 0

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Modal: time cheio */}
      {showModal && externalError && (
        <div className="ins-modal-overlay" onClick={() => setDismissedError(externalError)}>
          <div className="ins-modal" onClick={e => e.stopPropagation()}>
            <div className="ins-modal-icon">🚫</div>
            <h2 className="ins-modal-title">Time cheio</h2>
            <p className="ins-modal-body">{externalError}</p>
            <button
              type="button"
              className="ins-modal-btn-primary"
              onClick={() => setDismissedError(externalError)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <div className="ins-team-cat-header">{label}</div>

      {/* Opções: criar / entrar */}
      <div className="ins-team-opts">
        <button
          type="button"
          className={`ins-team-opt${state.acao === 'criar' ? ' ins-team-opt--active' : ''}`}
          onClick={() => onChange('acao', 'criar')}
        >
          <span className="ins-team-opt-icon"><Plus size={18} /></span>
          <span className="ins-team-opt-title">Criar time</span>
          <span className="ins-team-opt-desc">Você gera um código único e compartilha com a galera</span>
        </button>
        <button
          type="button"
          className={`ins-team-opt${state.acao === 'entrar' ? ' ins-team-opt--active' : ''}`}
          onClick={() => onChange('acao', 'entrar')}
        >
          <span className="ins-team-opt-icon"><Key size={18} /></span>
          <span className="ins-team-opt-title">Entrar com código</span>
          <span className="ins-team-opt-desc">Alguém do time criou e te passou o código</span>
        </button>
      </div>

      {/* Criar time */}
      {state.acao === 'criar' && (
        <div style={{ animation: 'ins-fadeUp 260ms ease' }}>
          <div className="ins-field">
            <label className="ins-label" htmlFor={`ins-time-nome-${categoria}`}>Nome do time</label>
            <input
              id={`ins-time-nome-${categoria}`}
              className="ins-input"
              type="text"
              placeholder="Ex.: Curitiba Polo, Os Incansáveis…"
              value={state.nome}
              onChange={e => onChange('nome', e.target.value)}
            />
          </div>

          <div className="ins-team-code-teaser">
            <span className="ins-team-code-teaser-icon">🔑</span>
            <div>
              <p className="ins-team-code-teaser-title">Seu código aparece na confirmação</p>
              <p className="ins-team-code-teaser-sub">
                Ao finalizar a inscrição você verá o código do time em destaque.
                Compartilhe com as outras {limite - 1} pessoas — elas entram pelo código.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Entrar em time */}
      {state.acao === 'entrar' && (
        <div style={{ animation: 'ins-fadeUp 260ms ease' }}>
          <div className="ins-info-box" style={{ marginBottom: 16 }}>
            Conversem entre si sobre quem cria o time e quem entra via código —
            só uma pessoa cria, as demais entram com o código gerado.
          </div>

          <div className="ins-field">
            <label className="ins-label" htmlFor={`ins-cod-${categoria}`}>Código do time</label>
            <div style={{ position: 'relative' }}>
              <input
                id={`ins-cod-${categoria}`}
                className={`ins-input${(state.timeError || externalError) ? ' ins-input--error' : ''}`}
                type="text"
                placeholder="Ex.: ABX3K9"
                value={state.codigo}
                maxLength={6}
                onChange={e => onChange('codigo', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                style={{ textTransform: 'uppercase', letterSpacing: '0.20em', paddingRight: 44 }}
              />
              {state.timeLoading && (
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                  <span className="ins-spinner" />
                </span>
              )}
            </div>
            {state.timeError && <p className="ins-error-msg">{state.timeError}</p>}
            {externalError && !state.timeError && (
              <p className="ins-error-msg">{externalError}</p>
            )}
          </div>

          {state.timeInfo && !state.timeError && !externalError && (
            <div className="ins-team-preview">
              <div className="ins-team-preview-name">{state.timeInfo.nome}</div>
              <div className="ins-team-preview-members">
                {vagasOcupadas} de {limite} atletas — {timeCheio ? '0' : vagas} vaga{vagas !== 1 ? 's' : ''} restante{vagas !== 1 ? 's' : ''}
              </div>
              {state.timeInfo.atletas.length > 0 && (
                <ul className="ins-team-preview-list">
                  {state.timeInfo.atletas.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}
              {timeCheio && (
                <p className="ins-team-preview-full">Time cheio — não há vagas disponíveis</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TimesSection({ misto, timeMisto, onChange, errors }: Props) {
  const onChangeMisto = useCallback((f: keyof TimeState, v: unknown) => onChange('misto', f, v), [onChange])

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Users size={18} /></div>
        <div>
          <div className="ins-card-title">Times</div>
          <div className="ins-card-subtitle">Crie um time ou entre em um existente via código</div>
        </div>
      </div>

      <div className="ins-info-box">
        Os times <strong>não são listados publicamente</strong>. Para entrar em um time, peça
        o código para a pessoa que o criou. Você também pode configurar seu time pela
        área da pessoa atleta após confirmar a inscrição.
      </div>

      {misto && (
        <TeamBlock
          categoria="misto"
          label="Brasileiro Misto"
          limite={CONFIG.LIMITE_MISTO}
          state={timeMisto}
          onChange={onChangeMisto}
          externalError={errors?.misto}
        />
      )}
    </section>
  )
}
