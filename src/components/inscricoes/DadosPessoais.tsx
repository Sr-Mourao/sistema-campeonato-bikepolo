import { useState, useRef, useEffect, useCallback } from 'react'
import { User } from 'lucide-react'

const GENEROS = [
  'Mulher cis',
  'Mulher trans',
  'Homem trans',
  'Homem cis',
  'Pessoa não-binárie',
  'Agênero',
  'Prefiro descrever',
]

function formatBRPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const DDI_OPTIONS = [
  { value: '55',  label: '🇧🇷 +55' },
  { value: '54',  label: '🇦🇷 +54' },
  { value: '598', label: '🇺🇾 +598' },
  { value: '56',  label: '🇨🇱 +56' },
  { value: '595', label: '🇵🇾 +595' },
  { value: '51',  label: '🇵🇪 +51' },
  { value: '57',  label: '🇨🇴 +57' },
  { value: '1',   label: '🇺🇸 +1'  },
]

export interface DadosPessoaisValues {
  nome: string
  email: string
  ddi: string
  telefone: string
  genero: string
  generoDescricao: string
  clubeId: number | null
  clubeNome: string
  cidade: string
  nacionalidade: string
}

interface Props {
  values: DadosPessoaisValues
  errors: Partial<Record<keyof DadosPessoaisValues, string>>
  onChange: (field: keyof DadosPessoaisValues, value: string | number | null) => void
}

interface Clube { id: number; nome: string }

// Hook genérico de autocomplete para evitar duplicação
function useAutocomplete<T>(
  fetchFn: (q: string) => Promise<T[]>,
  delay = 220
) {
  const [suggestions, setSuggestions]   = useState<T[]>([])
  const [open, setOpen]                 = useState(false)
  const [loading, setLoading]           = useState(false)
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const containerRef                    = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      setSuggestions(await fetchFn(q))
    } catch { /* silencioso */ }
    setLoading(false)
  }, [fetchFn])

  // Fecha ao clicar fora
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function onInputChange(q: string) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), delay)
  }

  function onFocus(q: string) {
    setOpen(true)
    search(q)  // carrega imediatamente ao focar
  }

  return { suggestions, open, loading, search, onInputChange, onFocus, setOpen, containerRef }
}

export default function DadosPessoais({ values, errors, onChange }: Props) {
  const generoAberto = values.genero === 'Prefiro descrever'

  // ── Clube autocomplete ──────────────────────────────────────
  const fetchClubes = useCallback(async (q: string): Promise<Clube[]> => {
    const res = await fetch(`/api/clubes.php?q=${encodeURIComponent(q)}`)
    return res.ok ? res.json() : []
  }, [])

  const {
    suggestions: clubeSuggestions,
    open: clubeOpen,
    loading: clubeLoading,
    onInputChange: clubeOnInputChange,
    onFocus: clubeOnFocus,
    setOpen: setClubeOpen,
    containerRef: clubeContainerRef,
  } = useAutocomplete(fetchClubes)

  function handleClubeInput(v: string) {
    onChange('clubeId', null)
    onChange('clubeNome', v)
    clubeOnInputChange(v)
    setClubeOpen(true)
  }

  function selectClube(c: Clube) {
    onChange('clubeId', c.id)
    onChange('clubeNome', c.nome)
    setClubeOpen(false)
  }

  const showNewClube = values.clubeNome.trim().length > 1 &&
    !clubeSuggestions.some(c => c.nome.toLowerCase() === values.clubeNome.trim().toLowerCase())

  // ── Cidade autocomplete ─────────────────────────────────────
  const fetchCidades = useCallback(async (q: string): Promise<string[]> => {
    const res = await fetch(`/api/cidades.php?q=${encodeURIComponent(q)}`)
    return res.ok ? res.json() : []
  }, [])

  const {
    suggestions: cidadeSuggestions,
    open: cidadeOpen,
    loading: cidadeLoading,
    onInputChange: cidadeOnInputChange,
    onFocus: cidadeOnFocus,
    setOpen: setCidadeOpen,
    containerRef: cidadeContainerRef,
  } = useAutocomplete(fetchCidades)

  function handleCidadeInput(v: string) {
    onChange('cidade', v)
    cidadeOnInputChange(v)
    setCidadeOpen(true)
  }

  function selectCidade(c: string) {
    onChange('cidade', c)
    setCidadeOpen(false)
  }

  // Filtra sugestões que já batem exatamente com o valor atual
  const cidadeSugestoesFiltradas = cidadeSuggestions.filter(
    c => c.toLowerCase() !== values.cidade.trim().toLowerCase()
  )

  return (
    <section className="ins-card ins-card--has-dropdown">
      <div className="ins-card-header">
        <div className="ins-card-icon"><User size={18} /></div>
        <div>
          <div className="ins-card-title">Dados Pessoais</div>
          <div className="ins-card-subtitle">Como vamos te chamar no campeonato</div>
        </div>
      </div>

      {/* Nome */}
      <div className="ins-field">
        <label className="ins-label" htmlFor="ins-nome">
          Nome
          <span className="ins-label-hint">
            Nome que vai aparecer nas listas, comunicação e placar do evento 💛
          </span>
        </label>
        <input
          id="ins-nome"
          className={`ins-input${errors.nome ? ' ins-input--error' : ''}`}
          type="text"
          placeholder="Como você quer ser chamade"
          value={values.nome}
          onChange={e => onChange('nome', e.target.value)}
          autoComplete="given-name"
        />
        {errors.nome && <p className="ins-error-msg">{errors.nome}</p>}
      </div>

      {/* Email */}
      <div className="ins-field">
        <label className="ins-label" htmlFor="ins-email">Email</label>
        <input
          id="ins-email"
          className={`ins-input${errors.email ? ' ins-input--error' : ''}`}
          type="email"
          placeholder="seuemail@exemplo.com"
          value={values.email}
          onChange={e => onChange('email', e.target.value)}
          autoComplete="email"
        />
        {errors.email && <p className="ins-error-msg">{errors.email}</p>}
      </div>

      {/* DDI + Telefone */}
      <div className="ins-field">
        <label className="ins-label" htmlFor="ins-telefone">
          Telefone / WhatsApp
          <span className="ins-label-hint">Opcional — para te adicionar no grupo oficial do evento 📲</span>
        </label>
        <div className="ins-row-3 ins-row-phone">
          <div className="ins-select-wrap">
            <select
              className="ins-select"
              value={values.ddi}
              onChange={e => {
                const newDdi = e.target.value
                onChange('ddi', newDdi)
                if (values.ddi === '55' && newDdi !== '55') {
                  onChange('telefone', values.telefone.replace(/\D/g, ''))
                }
              }}
              aria-label="DDI"
            >
              {DDI_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <input
            id="ins-telefone"
            className="ins-input"
            type="tel"
            placeholder={values.ddi === '55' ? '(48) 99999-9999' : 'Número de telefone'}
            value={values.telefone}
            onChange={e => {
              if (values.ddi === '55') {
                onChange('telefone', formatBRPhone(e.target.value))
              } else {
                onChange('telefone', e.target.value)
              }
            }}
            autoComplete="tel"
          />
        </div>
      </div>

      {/* Gênero */}
      <div className="ins-field">
        <label className="ins-label" htmlFor="ins-genero">Gênero</label>
        <div className="ins-select-wrap">
          <select
            id="ins-genero"
            className="ins-select"
            value={values.genero}
            onChange={e => {
              onChange('genero', e.target.value)
              if (e.target.value !== 'Prefiro descrever') {
                onChange('generoDescricao', '')
              }
            }}
          >
            {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        {generoAberto && (
          <input
            className="ins-input"
            type="text"
            placeholder="Como você gostaria de descrever seu gênero?"
            value={values.generoDescricao}
            onChange={e => onChange('generoDescricao', e.target.value)}
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      {/* Clube */}
      <div className="ins-field">
        <label className="ins-label" htmlFor="ins-clube">
          Clube
          <span className="ins-label-hint">Seu clube atual, ou Independente se não tiver clube</span>
        </label>
        <div className="ins-autocomplete" ref={clubeContainerRef}>
          <input
            id="ins-clube"
            className="ins-input"
            type="text"
            placeholder="Digite para buscar ou criar novo"
            value={values.clubeNome}
            onChange={e => handleClubeInput(e.target.value)}
            onFocus={() => clubeOnFocus(values.clubeNome)}
            autoComplete="off"
          />

          {clubeOpen && (
            <ul className="ins-autocomplete-list" role="listbox">
              {clubeLoading && (
                <li className="ins-autocomplete-empty">Buscando…</li>
              )}
              {!clubeLoading && clubeSuggestions.map(c => (
                <li
                  key={c.id}
                  className="ins-autocomplete-item"
                  role="option"
                  onMouseDown={() => selectClube(c)}
                >
                  {c.nome}
                </li>
              ))}
              {!clubeLoading && showNewClube && (
                <li
                  className="ins-autocomplete-new"
                  onMouseDown={() => {
                    onChange('clubeId', null)
                    onChange('clubeNome', values.clubeNome.trim())
                    setClubeOpen(false)
                  }}
                >
                  <span>+</span> Criar "{values.clubeNome.trim()}"
                </li>
              )}
              {!clubeLoading && clubeSuggestions.length === 0 && !showNewClube && (
                <li className="ins-autocomplete-empty">Nenhum clube encontrado</li>
              )}
            </ul>
          )}
        </div>
        {values.clubeId && (
          <p style={{ fontSize: 12, color: '#4CE0A8', marginTop: 5 }}>
            ✓ {values.clubeNome}
          </p>
        )}
      </div>

      {/* Cidade + Nacionalidade */}
      <div className="ins-row">
        <div className="ins-field" style={{ marginBottom: 0 }}>
          <label className="ins-label" htmlFor="ins-cidade">Cidade</label>
          <div className="ins-autocomplete" ref={cidadeContainerRef}>
            <input
              id="ins-cidade"
              className="ins-input"
              type="text"
              placeholder="Florianópolis/SC"
              value={values.cidade}
              onChange={e => handleCidadeInput(e.target.value)}
              onFocus={() => cidadeOnFocus(values.cidade)}
              autoComplete="off"
            />
            {cidadeOpen && (cidadeSugestoesFiltradas.length > 0 || cidadeLoading) && (
              <ul className="ins-autocomplete-list" role="listbox">
                {cidadeLoading && (
                  <li className="ins-autocomplete-empty">Buscando…</li>
                )}
                {!cidadeLoading && cidadeSugestoesFiltradas.map(c => (
                  <li
                    key={c}
                    className="ins-autocomplete-item"
                    role="option"
                    onMouseDown={() => selectCidade(c)}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="ins-field" style={{ marginBottom: 0 }}>
          <label className="ins-label">Você é</label>
          <div className="ins-radio-group">
            {(['brasileire', 'estrangeire'] as const).map(v => (
              <label key={v} className="ins-radio-item">
                <input
                  type="radio"
                  name="ins-nac"
                  value={v}
                  checked={values.nacionalidade === v}
                  onChange={() => onChange('nacionalidade', v)}
                />
                <span className="ins-radio-label">
                  <span className="ins-radio-dot" />
                  {v === 'brasileire' ? 'Brasileire' : 'Estrangeire'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

    </section>
  )
}
