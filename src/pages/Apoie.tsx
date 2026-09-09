import { useEffect } from 'react'
import './Apoie.css'
import { usePatrocinadores } from '../hooks/usePatrocinadores'
import SiteNavbar from '../components/SiteNavbar'
import { SITE, emailUrl } from '../site.config'

function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          obs.unobserve(e.target)
        }
      }),
      { threshold: 0.10, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

function imgFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
}

const TIMELINE = [
  { year: '2013', city: 'Rio de Janeiro / RJ',       star: false },
  { year: '2014', city: 'Belo Horizonte / MG',        star: false },
  { year: '2015', city: 'São Paulo / SP',             star: false },
  { year: '2016', city: 'Santos / SP',                star: false },
  { year: '2017', city: 'São José dos Campos / SP',   star: false },
  { year: '2018', city: 'Florianópolis / SC',         star: true  },
  { year: '2019', city: 'Curitiba / PR',              star: false },
  { year: '2023', city: 'Curitiba / PR',              star: false },
  { year: '2025', city: 'Recife / PE',                star: false },
  { year: '2026', city: 'Florianópolis / SC',         star: true, current: true },
]

const SPONSORS = [
  {
    num: 'Modalidade 01', title: 'Premiação',
    body: 'Patrocínio através de prêmios — peças para a bike, roupas, acessórios, calçados, vale-manutenção e similares.',
    benefits: 'Exposição da marca no site, Instagram, cartazes, tapumes da quadra e banner oficial. Espaço para stand no evento.',
  },
  {
    num: 'Modalidade 02', title: 'Valor em Dinheiro',
    body: 'Quantia em dinheiro para os custos da estrutura do evento. Valor definido de acordo com a disponibilidade do patrocinador.',
    benefits: 'Exposição da marca no site, Instagram, cartazes e banner oficial. Destaque especial para valores acima de R$ 1.000,00.',
  },
  {
    num: 'Modalidade 03', title: 'Permuta Estrutura',
    body: 'Colaboração com serviço ou produto — gráfica com cartazes, empresa de bebidas com água, hostel com desconto na hospedagem, etc.',
    benefits: 'Exposição da marca no site, Instagram, cartazes, tapumes e banner oficial. Espaço para stand ou material de comunicação.',
  },
  {
    num: 'Modalidade 04', title: 'Suporte Voluntário',
    body: 'Colaboração no dia do evento com tarefas específicas: montagem, limpeza, mesário, comunicação, inscrições, apoio geral.',
    benefits: 'Camiseta do evento · Lanche · Satisfação de contribuir com a evolução do Bike Polo no Brasil.',
  },
]


// A equipe de captação vem de src/site.config.ts — nome e celular de pessoas
// reais não ficam hardcoded numa página. Lista vazia: a seção não aparece.
const TEAM = SITE.equipe

/**
 * PDFs de captação oferecidos no topo da página.
 *
 * ESVAZIADO NA PUBLICAÇÃO. Os dois PDFs do 10º Brasileiro somavam 19 MB e
 * continham os celulares da equipe de captação — não entram num repositório
 * público, e não servem para quem só quer reusar o software.
 *
 * Ponha os SEUS arquivos em public/docs/ e liste aqui. Com a lista vazia, os
 * botões simplesmente não aparecem.
 */
const DOWNLOADS: { label: string; href: string }[] = [
  // { label: 'BAIXAR PDF COMPLETO', href: '/docs/seu-arquivo.pdf' },
]

export default function Apoie() {
  useReveal()
  const patrocinadores = usePatrocinadores()

  return (
    <div className="apoie">
      <SiteNavbar currentPath="/apoie" scrollThreshold={120} hideOnScroll={false} />

      {/* ── 1. HERO ──────────────────────────────────────────── */}
      <section className="ap-hero">
        <div className="ap-hero-bg">
          <img src="/imgs/apoie/DSC_4073.jpg" alt="Bike Polo em ação"
            className="ap-hero-img" onError={imgFallback} />
          <div className="ap-hero-overlay" />
        </div>
        <div className="ap-hero-content">
          <div className="ap-hero-tag reveal">10º Campeonato Brasileiro · 2026</div>
          <h1 className="ap-hero-title reveal d1">
            O Bike Polo
            <em>precisa do seu apoio</em>
          </h1>
          <p className="ap-hero-sub reveal d2">
            <span>5 a 7 de Setembro 2026</span>{' '}·{' '}Florianópolis — SC
          </p>
          <div className="ap-hero-ctas reveal d3" hidden={DOWNLOADS.length === 0}>
            {DOWNLOADS.map(d => (
              <a key={d.href} href={encodeURI(d.href)} className="ap-hero-cta" download>
                {d.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. O QUE É BIKE POLO ─────────────────────────────── */}
      <section id="esporte" className="ap-section ap-section--purple">
        <div className="ap-inner ap-cols ap-cols--wide-img">
          <div>
            <p className="ap-eyebrow reveal">Sobre o Esporte</p>
            <h2 className="ap-title reveal d1">O QUE É<br />BIKE POLO?</h2>
            <div className="ap-body reveal d2">
              <p>
                Bike Polo é um esporte coletivo semelhante ao{' '}
                <span className="ap-hi">Polo Tradicional a Cavalo</span>, praticado com
                bicicletas em uma quadra fechada.
              </p>
              <p>
                São <span className="ap-hi">2 times com 3 integrantes</span> em quadra
                disputando uma partida de até <span className="ap-hi">18 minutos</span>.
              </p>
              <p>
                É um esporte <span className="ap-hi">misto</span> — todos os gêneros
                jogam juntos.
              </p>
            </div>
          </div>
          <div className="ap-img-wrap reveal d3">
            <img src="/imgs/apoie/DSC_3716.jpg" alt="Partida de Bike Polo" onError={imgFallback} />
          </div>
        </div>
      </section>

      {/* ── 3. O CLUBE ───────────────────────────────────────── */}
      <section id="clube" className="ap-section ap-section--purple2">
        <div className="ap-inner ap-cols ap-cols--rev ap-cols--wide-img">
          <div className="ap-img-wrap reveal">
            <img src="/imgs/apoie/DSC_4807.jpg" alt="Clube Bike Polo Floripa" onError={imgFallback} />
          </div>
          <div>
            <p className="ap-eyebrow reveal d1">Florianópolis / SC</p>
            <h2 className="ap-title reveal d2">O CLUBE</h2>
            <div className="ap-body reveal d3">
              <p>
                O <span className="ap-hi">Bike Polo Floripa</span> existe desde 2016. Estamos
                presentes nos Campeonatos Brasileiros, Latino-Americanos, Abertos e Torneios
                Internacionais. Em <span className="ap-hi">2019</span> o clube esteve no Mundial
                de Córdoba, na Argentina.
              </p>
              <p>
                A equipe é <span className="ap-hi">atual Campeã Brasileira</span> — os Pôneis
                Malditos levaram o título em Recife/PE em 2025.
              </p>
              <p>
                São <span className="ap-hi">40 praticantes</span> que se encontram toda semana,
                às terças-feiras na quadra da Costeira com apoio da{' '}
                <span className="ap-hi">Ascop</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. O CAMPEONATO BRASILEIRO ───────────────────────── */}
      <section id="campeonato" className="ap-section ap-section--green">
        <div className="ap-inner">
          <p className="ap-eyebrow reveal">História</p>
          <h2 className="ap-title reveal d1">O CAMPEONATO<br />BRASILEIRO</h2>
          <div className="ap-champ-grid">
            <div>
              <div className="ap-body reveal d2">
                <p>
                  O Campeonato Brasileiro existe desde{' '}
                  <span className="ap-hi">2013</span> e já foi realizado nas seguintes cidades:
                </p>
              </div>
              <div className="ap-img-wrap reveal d3" style={{ marginTop: 'clamp(24px,4vw,40px)' }}>
                <img src="/imgs/apoie/DSC_3849.jpg" alt="Campeonato Brasileiro de Bike Polo" onError={imgFallback} />
              </div>
            </div>
            <div>
              <ul className="ap-timeline">
                {TIMELINE.map((item, i) => (
                  <li
                    key={item.year}
                    className={`ap-tl-item reveal d${Math.min(i + 1, 5)}${item.star ? ' ap-tl-item--star' : ''}`}
                  >
                    <span className="ap-tl-dot" />
                    <span>
                      <strong>{item.year}</strong>{' — '}{item.city}
                      {item.current && <span className="ap-tl-badge">ATUAL</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="ap-champ-note reveal">
                Em 2018 tivemos a primeira oportunidade de organizar o Campeonato Brasileiro —
                na <span className="ap-hi">UFSC</span>, com grande sucesso. Também foi quando
                realizamos a primeira edição do torneio{' '}
                <span className="ap-hi">MTNB</span>, criado para incentivar mulheres, pessoas
                trans e não-binárias.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. O EVENTO 2026 ─────────────────────────────────── */}
      <section id="evento" className="ap-section ap-section--purple">
        <div className="ap-inner">
          <p className="ap-eyebrow reveal">Setembro 2026</p>
          <h2 className="ap-title reveal d1">O EVENTO 2026</h2>
          <div className="ap-body reveal d2">
            <p>
              O evento será nos dias <span className="ap-hi">5, 6 e 7 de Setembro de 2026</span>,
              na quadra coberta do{' '}
              <span className="ap-hi">Instituto Estadual de Educação</span>, no centro de
              Florianópolis.
            </p>
          </div>
          <div className="ap-stats">
            {[
              { num: '60',  label: 'Atletas' },
              { num: '200', label: 'Expectadores' },
              { num: '20',  label: 'Organizadores' },
            ].map((s, i) => (
              <div key={s.label} className={`ap-stat reveal d${i + 1}`}>
                <span className="ap-stat-num">{s.num}</span>
                <span className="ap-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="ap-cities reveal">
            {['Porto Alegre/RS','Florianópolis/SC','Curitiba/PR','São Paulo/SP',
              'Santos/SP','Belo Horizonte/MG','Recife/PE']
              .map(c => <span key={c} className="ap-city">{c}</span>)}
          </div>
          {/* photo strip */}
          <div className="ap-photo-strip">
            {['/imgs/apoie/DSC_3930.jpg', '/imgs/apoie/DSC_4270.jpg', '/imgs/apoie/DSC_4457.jpg'].map((src, i) => (
              <div key={src} className={`ap-img-wrap ap-img-wrap--sq reveal d${i + 1}`}>
                <img src={src} alt="Bike Polo" onError={imgFallback} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. A ESTRUTURA ───────────────────────────────────── */}
      <section id="estrutura" className="ap-section ap-section--green">
        <div className="ap-inner ap-cols ap-cols--wide-img">
          <div>
            <p className="ap-eyebrow reveal">Infraestrutura</p>
            <h2 className="ap-title reveal d1">A ESTRUTURA</h2>
            <div className="ap-body reveal d2">
              <p>
                Para o evento é necessária a montagem de uma{' '}
                <span className="ap-hi">estrutura de madeira</span> em volta da quadra, mais mesas
                e tendas para arbitragem, organização, filmagem e público.
              </p>
              <p>
                Toda a estrutura é montada um dia antes e retirada um dia após o término, com{' '}
                <span className="ap-hi">limpeza geral</span> do espaço garantida.
              </p>
            </div>
            <div className="ap-spec reveal d3">
              <span className="ap-spec-label">Especificação técnica</span>
              <span className="ap-spec-row"><strong>Maderite Resinado</strong> cola fenólica</span>
              <span className="ap-spec-row">Espessura: <strong>8 mm</strong></span>
              <span className="ap-spec-row">Dimensões: <strong>220 × 110</strong></span>
            </div>
          </div>
          <div className="ap-img-wrap reveal d4">
            <img src="/imgs/apoie/croqui.png" alt="Estrutura do evento" onError={imgFallback} />
          </div>
        </div>
      </section>

      {/* ── 7. A DIVULGAÇÃO ──────────────────────────────────── */}
      <section className="ap-section ap-section--purple2">
        <div className="ap-inner">
          <p className="ap-eyebrow reveal">Comunicação</p>
          <h2 className="ap-title reveal d1">A DIVULGAÇÃO</h2>
          <div className="ap-banner-wrap reveal d2">
            <img src="/imgs/apoie/banner.png" alt="Bike Polo em ação" onError={imgFallback} />
          </div>
          <div className="ap-cols">
            <div className="ap-body reveal">
              <p>
                Grande parte da divulgação será via postagens patrocinadas nas páginas{' '}
                <span className="ap-hi">Bike Polo Floripa</span> e{' '}
                <span className="ap-hi">Brasil Bike Polo</span> no Instagram, além dos
                perfis de clubes, jogadores e simpatizantes.
              </p>
              <p>
                Cartazes e banners serão distribuídos em locais estratégicos, lojas e
                oficinas de bicicletas.
              </p>
            </div>
            <div className="ap-body reveal d1">
              <p>
                Durante o evento, alguns jogos serão{' '}
                <span className="ap-hi">transmitidos ao vivo</span> via Instagram ou
                YouTube.
              </p>
              <p>
                Após o evento serão publicados fotos de todos os dias e{' '}
                <span className="ap-hi">vídeos dos jogos</span> no YouTube e nas redes sociais.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. APOIO E PATROCÍNIO ────────────────────────────── */}
      <section id="patrocinio" className="ap-section ap-section--green">
        <div className="ap-inner">
          <p className="ap-eyebrow reveal">Participe</p>
          <h2 className="ap-title reveal d1">APOIO E<br />PATROCÍNIO</h2>
          <div className="ap-dual-imgs reveal d2">
            <div className="ap-dual-img-cell ap-dual-img-cell--landscape">
              <img src="/imgs/apoie/apoio2.jpg" alt="Evento de Bike Polo" onError={imgFallback} />
            </div>
            <div className="ap-dual-img-cell ap-dual-img-cell--portrait">
              <img src="/imgs/apoie/apoio.jpg" alt="Atleta de Bike Polo" onError={imgFallback} />
            </div>
          </div>
          <div className="ap-body reveal d3">
            <p>
              Toda a organização é <span className="ap-hi">voluntária</span>. Os custos envolvem
              estrutura, logística, premiação, material de identificação e divulgação.
              Para o sucesso do <span className="ap-hi">10º Campeonato</span> e do{' '}
              <span className="ap-hi">4º MTNB</span> precisamos de apoio — existem 4 formas:
            </p>
          </div>
          <div className="ap-sponsor-cards">
            {SPONSORS.map((s, i) => (
              <div key={s.num} className={`ap-sponsor-card reveal d${i + 1}`}>
                <div className="ap-card-num">{s.num}</div>
                <div className="ap-card-title">{s.title}</div>
                <p className="ap-card-body">{s.body}</p>
                <p className="ap-card-benefits">{s.benefits}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. APOIADORES CONFIRMADOS ────────────────────────── */}
      <section className="ap-section ap-section--orange">
        <div className="ap-inner">
          <p className="ap-eyebrow reveal">Confirmados</p>
          <h2 className="ap-title reveal d1">APOIADORES<br />CONFIRMADOS</h2>
          <div className="ap-body reveal d2">
            <p>Marcas que já garantiram apoio ao evento:</p>
          </div>
          <div className="ap-supporters-grid">
            {patrocinadores.filter(p => p.logoOriginal).map(p => {
              const cls = 'ap-supporter'
              const inner = (
                <>
                  <img src={p.logoOriginal} alt={p.nome} className="ap-supporter-logo" onError={imgFallback} />
                  <span className="ap-supporter-name">{p.nome}</span>
                </>
              )
              return p.url ? (
                <a key={p.slug} href={p.url} target="_blank" rel="noopener noreferrer"
                  className={cls} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {inner}
                </a>
              ) : (
                <div key={p.slug} className={cls}>{inner}</div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 10. CTA FINAL ────────────────────────────────────── */}
      <section className="ap-section ap-section--purple ap-cta-section">
        <img
          src="/imgs/apoie/DSC_4278.jpg"
          alt=""
          className="ap-cta-bg-img"
          onError={imgFallback}
          aria-hidden="true"
        />
        <div className="ap-inner ap-cta">
          <p className="ap-cta-pre reveal">Seja parte da história</p>
          <h2 className="ap-cta-title reveal d1">
            Ajude o Bike Polo<br />a crescer
          </h2>
          <p className="ap-cta-sub reveal d2">Apoie o evento e venha prestigiar.</p>
          <a href={emailUrl} className="ap-cta-btn reveal d3">
            ENTRAR EM CONTATO
          </a>
          <p className="ap-cta-thanks reveal d4">OBRIGADO!</p>
        </div>
      </section>

      {/* ── 11. CONTATOS ─────────────────────────────────────── */}
      <section id="contato" className="ap-section ap-section--green">
        <div className="ap-inner">
          {/* photo strip */}
          <div className="ap-photo-strip" style={{ marginTop: 0, marginBottom: 'clamp(36px,5vw,56px)' }}>
            {['/imgs/apoie/DSC_4401.jpg', '/imgs/apoie/DSC_3981.jpg', '/imgs/apoie/DSC_4602.jpg'].map((src, i) => (
              <div key={src} className={`ap-img-wrap ap-img-wrap--sq reveal d${i + 1}`}>
                <img src={src} alt="Bike Polo Floripa" onError={imgFallback} />
              </div>
            ))}
          </div>
          <div className="ap-contacts-grid">
            <div>
              <p className="ap-contact-group-title reveal">Contato Oficial</p>
              <div className="ap-contact-item reveal d1">
                <span className="ap-contact-label">Email</span>
                <a href={emailUrl} className="ap-contact-value">
                  {SITE.contato.email}
                </a>
              </div>
              <div className="ap-contact-item reveal d2">
                <span className="ap-contact-label">Instagram</span>
                <a href={SITE.contato.instagram} className="ap-contact-value"
                  target="_blank" rel="noopener noreferrer">
                  {SITE.contato.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')}
                </a>
              </div>
            </div>
            {TEAM.length > 0 && (
              <div>
                <p className="ap-contact-group-title reveal">Equipe de Contato</p>
                {TEAM.map((t, i) => (
                  <div key={t.nome} className={`ap-team-item reveal d${Math.min(i + 1, 5)}`}>
                    <span className="ap-team-name">{t.nome}</span>
                    <a href={`tel:${t.telefone.replace(/\D/g, '')}`} className="ap-team-phone">
                      {t.telefone}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ap-contacts-footer reveal">
            <a
              href="https://floripa.bikepolo.site"
              target="_blank"
              rel="noopener noreferrer"
              className="ap-footer-club-link"
            >
              <img src="/imgs/logos/bikeplofloripa.png" alt="Bike Polo Floripa"
                className="ap-footer-logo" onError={imgFallback} />
            </a>
            <p className="ap-footer-copy">
              © 2026 Bike Polo Floripa · 10º Campeonato Brasileiro de Bike Polo
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
