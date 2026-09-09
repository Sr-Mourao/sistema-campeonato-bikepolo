const DOCUMENTO_ORIGINAL = 'https://docs.google.com/document/d/1Dib9uxF7hrwvcBaMcen7QhMgbQGSW05OeV3ETaY5EnY/edit?tab=t.0'

const oficiais = [
  ['Árbitra Chefe', [
    'Gerenciar a arbitragem do torneio.',
    'Explicar decisões de regulamento para arbitragem e jogadoras.',
    'Inspecionar os equipamentos.',
    'Definir placar para WO.',
    'Não pode alterar as decisões da Árbitra Principal sobre as partidas.',
  ]],
  ['Árbitra Principal', [
    'Poder absoluto sobre as decisões da partida.',
    'Avaliar infrações e aplicar penalidades.',
    'Determinar início, fim e paradas da partida.',
    'Sinalizar claramente suas decisões.',
  ]],
  ['Bandeiras / Árbitras de Meta', [
    'Sinalizar gols e sua validade.',
    'Sinalizar infrações percebidas.',
    'Oferecer perspectiva sobre uma jogada para a Árbitra Principal, quando requisitado.',
    'Restabelecer a posição da goleira quando seguro.',
  ]],
  ['Assistente de Jogo', [
    'Controlar o tempo.',
    'Atualizar súmula.',
    'Atualizar placar.',
    'Anunciar o tempo da partida.',
  ]],
  ['Árbitra Assistente (opcional)', [
    'Sinalizar infrações percebidas.',
    'Oferecer perspectiva sobre uma jogada para a Árbitra Principal, quando requisitado.',
  ]],
] as const

const sinais = [
  ['Principal', [
    ['Início da partida', 'Levanta o braço no ar e baixa junto com o soar do apito.'],
    ['Reinício da partida', 'Estende o braço com a palma para cima em direção ao centro da quadra para indicar que a partida pode começar.'],
    ['Vantagem', 'Levanta o braço reto no ar.'],
    ['Posse', 'Estende o braço na direção da equipe que recebe a posse após uma parada.'],
  ]],
  ['Bandeiras', [
    ['Gol marcado', 'Levanta um braço reto no ar.'],
    ['Gol inválido', 'Estende e cruza os braços em movimento amplo.'],
    ['Infração', 'Levanta um braço no ar e aponta com o outro para a goleira da equipe que cometeu a infração.'],
    ['Tempo técnico', 'Faz um T com os braços.'],
  ]],
  ['Assistente', [
    ['Infração', 'Levanta um braço no ar e aponta com o outro para a goleira da equipe que cometeu a infração.'],
    ['Tempo técnico', 'Faz um T com os braços.'],
  ]],
] as const

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return <div className="reg-definition"><dt>{term}</dt><dd>{children}</dd></div>
}

export default function ArbitrationQuickGuide() {
  return (
    <section id="arbitragem" className="reg-section reg-arbitragem" aria-labelledby="arbitragem-title">
      <div className="reg-section-heading">
        <span aria-hidden="true">03</span>
        <div>
          <p>Resumo técnico</p>
          <h3 id="arbitragem-title">Arbitragem</h3>
        </div>
      </div>

      <div className="reg-arbitragem-intro">
        <p>Resumo técnico para facilitar o entendimento geral e dar bom andamento nas partidas</p>
        <a href={DOCUMENTO_ORIGINAL} target="_blank" rel="noopener noreferrer">Ver documento original ↗</a>
      </div>

      <div className="reg-bloco">
        <h4>Função da arbitragem</h4>
        <p>
          A arbitragem cumpre a função de gerenciar e garantir o bom andamento da partida,
          utilizando-se da aplicação de penalidades em busca de corrigir vantagens indevidas
          obtidas quando infrações são cometidas.
        </p>
      </div>

      <div className="reg-bloco">
        <h4>Oficiais de arbitragem e deveres</h4>
        <ul className="reg-official-list" aria-label="Oficiais de arbitragem">
          <li>Árbitra Chefe</li><li>Árbitra Principal</li><li>Árbitras de Meta / bandeiras</li>
          <li>Assistente de Jogo</li><li>Árbitra Assistente (opcional)</li>
        </ul>
        <div className="reg-duty-list">
          {oficiais.map(([nome, deveres]) => (
            <section key={nome}>
              <h5>{nome}</h5>
              <ul>{deveres.map(dever => <li key={dever}>{dever}</li>)}</ul>
            </section>
          ))}
        </div>
      </div>

      <div className="reg-bloco">
        <h4>Sinais manuais</h4>
        {sinais.map(([oficial, itens]) => (
          <section className="reg-signal-group" key={oficial} aria-labelledby={`sinais-${oficial.toLowerCase()}`}>
            <h5 id={`sinais-${oficial.toLowerCase()}`}>{oficial}</h5>
            <dl>
              {itens.map(([nome, descricao]) => <Definition key={nome} term={nome}>{descricao}</Definition>)}
            </dl>
          </section>
        ))}
      </div>

      <div className="reg-bloco">
        <h4>Conceitos básicos</h4>
        <dl className="reg-definitions">
          <Definition term="Posse">A jogadora que está sob controle da bola por ter feito o último toque deliberado e mantido a bola a uma distância de 3m.</Definition>
          <Definition term="Portadora da bola">Jogadora atualmente em posse da bola.</Definition>
          <Definition term="Chute">Batida com a extremidade redonda da cabeça do taco. É a ação necessária para que um gol seja válido.</Definition>
          <Definition term="Encaixe">Conduzir a bolinha encaixada entre a boca do taco e alguma superfície (chão ou perímetro). Permitido por 2 segundos.</Definition>
          <Definition term="Scoop">Carregar a bola encaixada na boca do taco de forma aérea utilizando-se de força centrípeta para manter a bola presa. Permitido por um total de 3 trocas de direção de movimento do taco.</Definition>
          <Definition term="Tapear">É possível tapear a bola com as mãos quando defendendo de dentro da sua área uma bola que esteja abaixo da altura dos ombros.</Definition>
        </dl>
      </div>

      <div className="reg-bloco">
        <h4>Procedimentos</h4>
        <dl className="reg-definitions">
          <Definition term="Justa">
            <p>Procedimento de início de partida.</p>
            <p>As jogadoras em justa devem se cruzar no meio da quadra do lado correspondente à sua mão dominante.</p>
            <p>As oponentes devem seguir em linha reta até tocar a bola ou cruzar a linha.</p>
            <p>A desistência da justa deve ocorrer a mais de 3 metros da bolinha.</p>
          </Definition>
          <Definition term="Parada de partida">
            <p>O soar do apito durante uma partida em andamento indica parada imediata da partida.</p>
            <p>Ao soar o apito, as pessoas jogadoras devem interromper a partida.</p>
          </Definition>
          <Definition term="Reinício de partida">A arbitragem confirma que a equipe sem posse está pronta e indica que a equipe em posse pode cruzar o meio da quadra para reinício.</Definition>
          <Definition term="Tempo técnico">
            <p>Pode ser pedido em qualquer parada de partida sem alteração da posse.</p>
            <p>Durante a partida, a equipe em posse pode requisitar tempo técnico, porém cede a posse à equipe adversária.</p>
          </Definition>
          <Definition term="Goleira deslocada">Deve ser reposicionada pelas árbitras de meta ou pelas jogadoras em campo.</Definition>
          <Definition term="Banco de reservas">
            <p>As trocas podem ocorrer a qualquer momento pela porta designada.</p>
            <p>Antes da jogadora de fora entrar, a jogadora que está saindo precisa estar dentro da área de transição.</p>
            <p>Jogadoras em processo de troca somente podem interagir com a bolinha ou interferir na partida depois do processo completo.</p>
            <p>A jogadora que entra é considerada ativa e não precisa tocar na área de retorno.</p>
          </Definition>
        </dl>
      </div>

      <div className="reg-bloco">
        <h4>Infrações</h4>
        <dl className="reg-definitions reg-definitions--infractions">
          <Definition term="Atraso de jogo">Ações deliberadas para atrasar o andamento da partida, como jogar a bola propositalmente para fora.</Definition>
          <Definition term="Comportamento antidesportivo"><q>Malvadezas.</q></Definition>
          <Definition term="Cortina">Bloquear deliberadamente a passagem de uma adversária sem posse.</Definition>
          <Definition term="Interferência corporal">Iniciar contato físico com jogadora sem posse.</Definition>
          <Definition term="Interferência de taco">
            Utilizar o taco para interferir no movimento de:
            <ul><li>jogadora sem posse;</li><li>jogadora em posse quando não se está ao alcance da bolinha.</li></ul>
          </Definition>
          <Definition term="Violação da área de meta">
            <p>Com exceção de uma jogadora defensiva, o tempo máximo de permanência na área é de 3 segundos.</p>
            <p>Quando a bola ou a portadora está dentro da área, essa restrição não se aplica.</p>
          </Definition>
          <Definition term="Substituição ilegal">Falha em seguir os procedimentos de troca.</Definition>
          <Definition term="Pisada">
            <p>Ocorre quando a jogadora perde o equilíbrio na bicicleta e “cai”.</p>
            <p>Considera-se pisada quando:</p>
            <ul>
              <li>apoia o pé em superfície que não seja sua própria bicicleta ou a face vertical do perímetro;</li>
              <li>apoia qualquer parte do corpo na goleira para equilíbrio;</li>
              <li>agarra-se nas tabelas, outras jogadoras, goleiras ou qualquer outra coisa que não seja taco ou bicicleta.</li>
            </ul>
            <p>Uma jogadora pisada não pode interagir com o jogo até tocar o taco na área de retorno.</p>
          </Definition>
          <Definition term="Trombada">Causar outras jogadoras a pisarem no processo de cair e pisar, mesmo que evite a própria pisada por ter trombado com alguém.</Definition>
          <Definition term="Contato ilegal de bicicleta">
            <p>Iniciar contato com a bicicleta de forma a atrapalhar a movimentação adversária.</p>
            <p>Inclui:</p>
            <ul>
              <li>batida em T;</li><li>bater com rodas derrapando ou pivoteando;</li>
              <li>bater com rodas no taco de apoio adversário;</li>
              <li>usar pedal para iniciar contato com bicicleta ou equipamento adversário.</li>
            </ul>
          </Definition>
          <Definition term="Extensão">Estender o braço para empurrar uma adversária.</Definition>
          <Definition term="Empurrada">
            <p>Contato iniciado por trás, movendo-se para frente.</p>
            <p>Também não é permitido:</p>
            <ul><li>segurar;</li><li>chutar;</li><li>cabecear;</li><li>bater no guidão;</li><li>bater no braço guia adversário.</li></ul>
            <p>O contato físico em disputa de bola é permitido, mas deve ser aplicado de maneira justa e igualitária, considerando a proporcionalidade das pessoas envolvidas.</p>
            <p>Quando a proporcionalidade não é respeitada, ocorre infração de flagrante.</p>
          </Definition>
          <Definition term="Cortada">Tentar golpear o taco ou corpo adversário de forma desproporcional e/ou violenta.</Definition>
          <Definition term="Taco alto">
            <p>Tentar fazer contato com bola aérea utilizando o taco quando próximo de uma adversária.</p>
            <p>É possível interceptar uma bola aérea com a mão, apontando o taco para baixo e desviando a bola diretamente para o chão.</p>
          </Definition>
          <Definition term="Obstrução">Causar a pisada de uma adversária colocando o taco sob as rodas.</Definition>
          <Definition term="Enganchar">
            <p>Prender continuamente o taco no equipamento alheio, impedindo o movimento livre.</p>
            <p>Permitido em disputa imediata pela posse.</p>
          </Definition>
          <Definition term="Arremessar">
            <p>Jogar deliberadamente qualquer parte do equipamento.</p>
            <p>Consequências descritas no resumo técnico:</p>
            <ul>
              <li>30 segundos se não interferir na partida;</li>
              <li>1 minuto + ponto concedido quando lançado para tentar impedir um gol;</li>
              <li>expulsão se arremessado contra arbitragem, jogadoras ou espectadores.</li>
            </ul>
          </Definition>
          <Definition term="Taco caído">Um taco caído que interfira com a partida constitui infração.</Definition>
        </dl>
      </div>

      <div className="reg-bloco">
        <h4>Penalidades</h4>
        <dl className="reg-definitions">
          <Definition term="Troca de posse">Posse concedida à equipe que sofreu a infração.</Definition>
          <Definition term="Penalidade menor"><p>Falta de 30 segundos.</p><p>Aplicada a infrações que impeçam oportunidade de gol ou comportamento perigoso.</p></Definition>
          <Definition term="Penalidade maior"><p>Falta de 1 minuto.</p><p>Aplicada a atitudes perigosas ou imprudentes.</p></Definition>
          <Definition term="Conduta imprópria"><p>Expulsão.</p><p>No formato quarteto ou esquadra, resulta em vantagem numérica de 1 minuto.</p></Definition>
          <Definition term="Ponto concedido">Consequência de infração que impediu um gol, inclusive nas situações descritas no material técnico.</Definition>
        </dl>
      </div>

      <div className="reg-bloco">
        <h4>Procedimento de penalidade</h4>
        <dl className="reg-definitions">
          <Definition term="Penalidade de ataque">Se a equipe que comete a infração está em posse, a partida é interrompida e a penalidade correspondente é aplicada.</Definition>
          <Definition term="Penalidade adiada / vantagem">
            <p>Quando a equipe infratora não mantém a posse, a equipe com posse entra em situação de vantagem.</p>
            <p>A vantagem é indicada pelo tocar da sineta pela arbitragem.</p>
            <p>A equipe em vantagem não pode tomar gol durante a vantagem.</p>
            <p>A vantagem termina quando:</p>
            <ul>
              <li>a equipe em vantagem marca gol;</li><li>a equipe infratora obtém posse;</li>
              <li>a bola sai da quadra;</li><li>a bola fica presa em algum equipamento;</li>
              <li>a equipe em vantagem comete infração;</li>
              <li>uma bola que estava na metade ofensiva da equipe em vantagem retorna para trás da goleira da própria equipe;</li>
              <li>a bola é desviada para fora da área defensiva por jogadora de dentro da área.</li>
            </ul>
            <p>Quando a vantagem termina, as penalidades correspondentes são aplicadas.</p>
          </Definition>
          <Definition term="Penalidade coincidente">Quando ambas as equipes cometem infrações simultâneas ou uma equipe em vantagem comete infração, o jogo reinicia com uma justa.</Definition>
          <Definition term="Faltas consecutivas">Faltas consecutivas acumulam-se e levam a penalidades consecutivamente mais severas, conforme o regulamento.</Definition>
        </dl>
      </div>
    </section>
  )
}
