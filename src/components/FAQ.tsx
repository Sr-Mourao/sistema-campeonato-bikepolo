import { useState } from 'react'
import {
  Calendar,
  MapPin,
  Banknote,
  ClipboardList,
  Building2,
  UtensilsCrossed,
  Leaf,
  Route,
  CloudRain,
  Bell,
  ChevronDown,
  CircleHelp,
  Trophy,
  BookOpen,
  WalletCards,
  Heart,
  FilePenLine,
  UserRound,
  ShoppingBag,
  Users,
  Medal,
  Tv,
} from 'lucide-react'
import './FAQ.css'
import './HomeQuickLinks.css'
import SiteNavbar from './SiteNavbar'
import { SITE, whatsappUrl } from '../site.config'

const Hi = ({ children }: { children: React.ReactNode }) => (
  <span className="faq-hi">{children}</span>
)

const faqItems = [
  {
    icon: <Calendar size={20} strokeWidth={2} />,
    question: 'QUANDO ACONTECEM OS TORNEIOS?',
    answer: (
      <p>
        O Brasileiro Misto acontecerá nos dias <Hi>5 e 6 de Setembro de 2026</Hi>, enquanto o Brasileiro MTNB será realizado no dia <Hi>7 de Setembro de 2026</Hi>.
      </p>
    ),
  },

  {
    icon: <MapPin size={20} strokeWidth={2} />,
    question: 'ONDE SERÁ O EVENTO?',
    answer: (
      <>
        <p>
          <strong>Instituto Estadual de Educação (IEE)</strong>
          <br />
          <Hi>Curitiba/PR</Hi>
        </p>

        <div className="faq-map">
          <iframe
            className="faq-map-embed"
            title="Mapa do Instituto Estadual de Educação (IEE)"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-48.55201468697348%2C-27.604832863173%2C-48.54001468697348%2C-27.592832863173&layer=mapnik&marker=-27.598832863173%2C-48.54601468697348"
          />
          <a
            className="faq-map-link"
            href="https://www.openstreetmap.org/?mlat=-27.598832863173&mlon=-48.54601468697348#map=18/-27.598832863173/-48.54601468697348"
            target="_blank"
            rel="noreferrer"
          >
            Abrir no mapa
          </a>
        </div>

        <p>
          O local fica no coração do Centro-Leste de Florianópolis, com mercado,
          farmácia, bares, restaurantes e muita coisa acessível na volta.
        </p>
      </>
    ),
  },

  {
  icon: <ClipboardList size={20} strokeWidth={2} />,
  question: 'COMO VÃO FUNCIONAR AS EQUIPES E CATEGORIAS?',
  answer: (
    <>
      <p>
        O Brasileiro contará com duas categorias:
        <Hi> Misto </Hi> e <Hi>MTNB</Hi>.
      </p>

      <p>
        No <Hi>Brasileiro Misto</Hi>, as equipes serão formadas por{' '}
        <Hi>4 pessoas</Hi> e deverão ser obrigatoriamente <Hi>mistas</Hi>,
        contando com pelo menos <Hi>1 pessoa de gênero dissidente</Hi>.
      </p>

      <p>
        O <Hi>MTNB</Hi> será o torneio voltado para{' '}
        <Hi>mulheres, pessoas trans e não-bináries</Hi>, com equipes formadas por{' '}
        <Hi>3 pessoas</Hi>.
      </p>

      <p>
        Em ambas as categorias será permitida a participação de{' '}
        <Hi>1 atleta estrangeiro(a) por equipe</Hi>.
      </p>

      <p>
        Brasileiros(as) que moram fora do Brasil <Hi>não serão considerados estrangeiros</Hi>.
        Da mesma forma, atletas estrangeiros(as) com <Hi>moradia fixa no Brasil</Hi> também não
        serão considerados estrangeiros para fins de composição das equipes.
      </p>

      <p>
        Caso a equipe tenha atleta estrangeiro(a), essa pessoa deverá informar
        previamente se irá disputar a vaga para o Latino através do{' '}
        <Hi>Pior Campeonato de Bici Polo</Hi>, já que atletas estrangeiros também podem
        possuir vaga classificatória por seus países de origem.
      </p>
    </>
  ),
},

  {
  icon: <Banknote size={20} strokeWidth={2} />,
  question: 'QUANTO VAI CUSTAR A INSCRIÇÃO?',
answer: (

  <p>
    <Hi>Os valores de inscrição são individuais, por pessoa.</Hi>
    <br />
    <br />
    Ou seja: cada atleta realiza sua própria inscrição e paga apenas o valor referente
    à sua própria participação, e não o valor do time inteiro.
    <br />
    <br />
    <Hi>Misto: R$182,00</Hi>
    <br />
    <Hi>MTNB: R$52,00</Hi>
    <br />
    <br />
    Atletas que se inscreverem nos dois campeonatos recebem
    <Hi> 50% de desconto no Misto</Hi>, totalizando
    <Hi> R$143,00 pelos dois torneios</Hi>.
    <br />
    <br />
    Esse incentivo existe para fortalecer o MTNB e incentivar atletas
    a ocuparem mais espaços dentro do campeonato, ajudando a manter
    a modalidade viva, diversa e em crescimento 💛
    <br />
    <br />
    Também teremos o <Hi>Incentivo Primeiro Torneio</Hi>:
    atletas que estiverem jogando seu primeiro campeonato recebem
    <Hi> 50% de desconto na inscrição</Hi>, válido para
    <Hi> Misto ou MTNB</Hi>.
    <br />
    <br />
    A ideia é ajudar quem está chegando agora a dar o primeiro passo,
    diminuindo barreiras e fortalecendo a renovação da cena ✨
    <br />
    <br />
    O desconto de primeiro torneio não é cumulativo com o incentivo MTNB.
    <br />
    <br />
    Pessoas <Hi>pretas, pardas e indígenas</Hi> terão
    <Hi> isenção total da inscrição</Hi>.
    <br />
    <br />
    Entendemos que construir uma cena mais diversa e acessível também passa
    por criar condições reais de participação. Essa política busca incentivar
    a presença e permanência de pessoas historicamente afastadas desses espaços 🤎
  </p>
),

},

  {
    icon: <Calendar size={20} strokeWidth={2} />,
    question: 'O BRASILEIRO VAI DAR VAGA PRO LATINO?',
    answer: (
      <>
        <p>
          Sim! O Pior Campeonato de Bici Polo dará vagas para o{' '}
          <Hi>Latinoamericano de Bike Polo no Peru</Hi>.
        </p>

        <p>
          A quantidade de vagas ainda será definida e divulgada posteriormente.
        </p>

        <p>
          Após conquistar a vaga, a equipe deverá manter pelo menos{' '}
          <Hi>2 pessoas da formação original</Hi>, podendo substituir até 2 atletas.
        </p>
      </>
    ),
  },

  {
    icon: <ClipboardList size={20} strokeWidth={2} />,
    question: 'QUANDO ABREM AS INSCRIÇÕES?',
    answer: (
      <p>
        A expectativa é abrir as inscrições na <Hi>primeira quinzena de Junho</Hi>.
        Assim que tivermos a data certinha e o formato, divulgaremos nos canais oficiais.
      </p>
    ),
  },

  {
    icon: <CircleHelp size={20} strokeWidth={2} />,
    question: 'TIVE PROBLEMA AO REALIZAR A INSCRIÇÃO, E AGORA?',
    answer: (
      <>
        <p>
          <Hi>Não criemos pânico.</Hi> Está tudo tranquilo e a gente resolve junto.
        </p>
        <p>
          Se a inscrição travou, deu erro no pagamento ou alguma etapa ficou estranha,
          chama o nosso menino da TI no WhatsApp:
          {' '}<a className="faq-inline-link" href={whatsappUrl} target="_blank" rel="noreferrer">{SITE.contato.whatsappLabel}</a>.
        </p>
        <p>
          Manda print, descreve rapidinho o que aconteceu e, se puder, já envia também
          seu nome e email usado na inscrição. A ideia é te ajudar sem correria e sem drama.
        </p>
      </>
    ),
  },

  {
    icon: <Building2 size={20} strokeWidth={2} />,
    question: 'VAI TER ALOJAMENTO?',
    answer: (
      <p>
        Sim! Estamos organizando alojamento dentro do próprio instituto no valor de{' '}
        <Hi>R$26,00 por diária</Hi>.
        <br />
        <br />
        Este ano não centralizaremos a organização de hospedagem solidária, principalmente em razão da disponibilidade de alojamento no evento. Ainda assim, a comunidade costuma se organizar no boca a boca e combinar hospedagens entre participantes.
      </p>
    ),
  },

  {
    icon: <UtensilsCrossed size={20} strokeWidth={2} />,
    question: 'VAI TER ALIMENTAÇÃO NO EVENTO?',
answer: (
<> <p>
Sim! Teremos opção de alimentação no evento 💛 </p>


<p>
  O pacote completo custará <Hi>R$51,00 por dia</Hi> e inclui:
  <br />
  • Café da manhã
  <br />
  • Almoço
  <br />
  • Lanche da tarde
</p>

<p>
  Também será possível contratar <Hi>somente o almoço</Hi>,
  por <Hi>R$21,00 por dia</Hi>.
</p>

<p>
  A alimentação será <strong>opcional</strong> e contratada separadamente da inscrição.
</p>


<p>
  Também haverá opções de comida próximas ao local, incluindo possíveis parceiros
  com descontos especiais (mais infos em breve).
</p>


</>
),

  },

  {
    icon: <Leaf size={20} strokeWidth={2} />,
    question: 'VAI TER OPÇÃO VEGETARIANA/VEGANA?',
    answer: (
      <p>
        Sim! Estamos trabalhando para garantir{' '}
        <Hi>opções vegetarianas e veganas</Hi> na alimentação do evento.
      </p>
    ),
  },

  {
    icon: <Route size={20} strokeWidth={2} />,
    question: 'COMO FUNCIONA A LOGÍSTICA PRA QUEM VEM DE FORA?',
    answer: (
      <>
        <p>
          O IEE fica a cerca de <Hi>7 minutos de bike</Hi> da Rodoviária de Florianópolis.
        </p>

        <p>
          Pra quem vem de avião, dá pra pegar ônibus até o TICEN
          (que fica do lado da rodoviária), além de opções de táxi e Uber.
        </p>

        <p>
          Também temos um <Hi>Uber Bike</Hi> gente boa pra indicar 😄
        </p>
      </>
    ),
  },

  {
    icon: <CloudRain size={20} strokeWidth={2} />,
    question: 'E SE CHOVER?',
    answer: (
      <p>
        Sem crise! Os torneios acontecerão em um ginásio <Hi>COBERTO</Hi>,
        então seguimos mesmo em caso de chuva.
      </p>
    ),
  },

  {
    icon: <Bell size={20} strokeWidth={2} />,
    question: 'ONDE ACOMPANHAR AS NOVIDADES?',
    answer: (
      <p>
        Os grupos oficiais do evento serão montados após as inscrições.
        Por enquanto, qualquer novidade será publicada no grupo do{' '}
        <Hi>Whatsapp Brasil Bike Polo</Hi> — e pedimos que a galera compartilhe
        as informações nos grupos de seus clubes.
      </p>
    ),
  },
]

export function HomeQuickLinks() {
  const principais = [
    {
      href: '/torneio/resultados',
      label: 'Resultados',
      description: 'Classificação final, campanhas, premiações e memória oficial do Brasileiro.',
      className: 'home-link-card--results',
      icon: <Medal size={38} strokeWidth={2.1} />,
    },
    {
      href: '/torneio',
      label: 'Acompanhar o torneio',
      description: 'Partidas, classificação e chaves oficiais das duas categorias.',
      className: 'home-link-card--tournament',
      icon: <Trophy size={34} strokeWidth={2.1} />,
    },
    {
      href: '/equipes',
      label: 'Conheça as equipes',
      description: 'Times e atletas que estão nas quadras de Curitiba.',
      className: 'home-link-card--teams',
      icon: <Users size={34} strokeWidth={2.1} />,
    },
  ]
  const operacionais = [
    {
      href: '/torneio?aba=regulamento',
      label: 'Regulamento',
      description: 'Formato, critérios e regras oficiais da competição.',
      className: 'home-link-card--orange',
      icon: <BookOpen size={25} strokeWidth={2.1} />,
    },
    {
      href: '/minha-inscricao',
      label: 'Área da Pessoa Atleta',
      description: 'Inscrição, time, pagamentos e informações pessoais.',
      className: 'home-link-card--green',
      icon: <UserRound size={25} strokeWidth={2.1} />,
    },
  ]
  const mais = [
    { href: '/overlays', label: 'Overlays & Live', icon: <Tv size={19} /> },
    { href: '/lojinha', label: 'Lojinha', icon: <ShoppingBag size={19} /> },
    { href: '/apoie', label: 'Apoie', icon: <Heart size={19} /> },
    { href: '/faq', label: 'Dúvidas', icon: <CircleHelp size={19} /> },
    { href: '/carteira', label: 'Carteira', icon: <WalletCards size={19} /> },
    {
      href: '/inscricoes',
      label: 'Inscrições',
      icon: <FilePenLine size={19} />,
    },
  ]

  return (
    <section className="home-links">
      <div className="home-links-inner">
        <p className="home-links-eyebrow">Acompanhamento oficial</p>
        <h2 className="home-links-title">Acompanhe o 2° Pior Campeonato de Bici Polo 2026</h2>
        <p className="home-links-intro">Equipes, torneio, regulamento e tudo que acontece nas quadras de Curitiba.</p>
        <div className="home-primary-grid">
          {principais.map(link => (
            <a key={link.href} href={link.href} className={`home-link-card ${link.className}`}>
              <span className="home-link-icon" aria-hidden="true">{link.icon}</span>
              <span className="home-link-label">{link.label}</span>
              <span className="home-link-description">{link.description}</span>
            </a>
          ))}
        </div>
        <div className="home-operational-grid">{operacionais.map(link => <a key={link.href} href={link.href} className={`home-link-card home-link-card--operational ${link.className}`}><span className="home-link-icon" aria-hidden="true">{link.icon}</span><span className="home-link-label">{link.label}</span><span className="home-link-description">{link.description}</span></a>)}</div>
        <div className="home-more"><div><span>Mais do campeonato</span><p>Acessos úteis para quem participa do evento.</p></div><nav>{mais.map(link => <a href={link.href} key={link.href}><span aria-hidden="true">{link.icon}</span>{link.label}</a>)}</nav></div>
      </div>
    </section>
  )
}

interface FAQProps {
  standalone?: boolean
}

export default function FAQ({ standalone = false }: FAQProps) {
  const [open, setOpen] = useState<number | null>(null)

  const toggle = (i: number) => setOpen(prev => (prev === i ? null : i))

  return (
    <section className="faq" id="faq">
      {standalone && <SiteNavbar currentPath="/faq" />}
      <header className="faq-header">
        <p className="faq-eyebrow">Perguntas Frequentes</p>
        <h2 className="faq-title">FAQ — PREPARATIVOS</h2>
        <div className="faq-championships">
          <span>2° Pior Campeonato de Bici Polo</span>
          <span className="faq-champ-dot" aria-hidden="true" />
          <span>4º Campeonato MTNB Brasileiro de Bike Polo</span>
        </div>
        <p className="faq-intro">
          Estamos trabalhando na organização do Brasileiro 2026 e já queremos compartilhar algumas
          informações prévias pra ajudar todo mundo a se planejar. Algumas coisas ainda podem mudar
          até a abertura oficial das inscrições, mas esse é o panorama atual:
        </p>
      </header>

      <ul className="faq-list" role="list">
        {faqItems.map((item, i) => (
          <li
            key={i}
            className={`faq-item${open === i ? ' faq-item--open' : ''}`}
          >
            <button
              className="faq-question"
              onClick={() => toggle(i)}
              aria-expanded={open === i}
            >
              <span className="faq-icon" aria-hidden="true">{item.icon}</span>
              <span className="faq-question-text">{item.question}</span>
              <ChevronDown
                className="faq-chevron"
                size={18}
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </button>

            <div className="faq-answer" aria-hidden={open !== i}>
              <div className="faq-answer-inner">
                <div className="faq-answer-content">{item.answer}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

    </section>
  )
}
