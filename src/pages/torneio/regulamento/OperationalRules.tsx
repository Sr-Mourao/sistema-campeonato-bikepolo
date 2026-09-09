export default function OperationalRules() {
  return (
    <section id="operacao" className="reg-section" aria-labelledby="operacao-title">
      <div className="reg-section-heading">
        <span aria-hidden="true">02</span>
        <div>
          <p>Regras específicas deste campeonato</p>
          <h3 id="operacao-title">Operação dos Jogos</h3>
        </div>
      </div>

      <div className="reg-bloco">
        <h4>Programação diária</h4>
        <div className="reg-schedule">
          <p><time dateTime="08:00">08:00</time><span>Reunião rápida de boas-vindas / orientações gerais</span></p>
          <p><time dateTime="08:30">08:30</time><span>Início da primeira partida</span></p>
        </div>
      </div>

      <div className="reg-bloco">
        <h4>Duração das partidas</h4>
        <div className="reg-duration" aria-label="Duração regulamentar da partida">
          <strong><span>18</span> minutos</strong>
          <p><b>Últimos 2 minutos:</b> cronômetro parado nas interrupções de jogo, conforme controle da arbitragem.</p>
        </div>
      </div>

      <div className="reg-bloco">
        <h4>Intervalo entre partidas</h4>
        <p>
          O intervalo previsto entre o encerramento de uma partida e o início da próxima é
          de 4 minutos. Existe tolerância máxima adicional de 1 minuto.
        </p>
        <p className="reg-inline-rule">
          <span>Intervalo operacional <strong>4 minutos</strong></span>
          <span>Tolerância máxima <strong>+1 minuto</strong></span>
        </p>
      </div>

      <div className="reg-bloco">
        <h4>Responsabilidade pelas bandeiras / árbitras de meta</h4>
        <p>
          Após cada partida, é responsabilidade do time indicar uma pessoa para exercer a
          função de bandeira / árbitra de meta na partida seguinte, conforme a organização
          do torneio.
        </p>
      </div>
    </section>
  )
}
