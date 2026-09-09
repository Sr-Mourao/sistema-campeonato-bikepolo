import { TERMOS } from '../../../content/termosParticipacao'

export default function ConductTerms() {
  return (
    <section id="conduta" className="reg-section" aria-labelledby="conduta-title">
      <div className="reg-section-heading">
        <span aria-hidden="true">05</span>
        <div>
          <p>Convivência e compromisso</p>
          <h3 id="conduta-title">Código de Conduta e Termos de Participação</h3>
        </div>
      </div>
      <div className="reg-bloco reg-bloco--termos">
        <p className="reg-aviso-aceite">
          Todas as pessoas atletas participantes aceitaram os Termos de Participação e o
          Código de Conduta durante o processo de inscrição do campeonato.
        </p>
        {TERMOS.map((bloco, i) => (
          <div key={i} className="reg-termos-bloco">
            {bloco.titulo && <h4>{bloco.titulo}</h4>}
            {bloco.texto && <p>{bloco.texto}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
