/**
 * Identidade e contatos da INSTÂNCIA — mude tudo aqui ao usar o sistema em
 * outro campeonato.
 *
 * Isto é só o começo da separação "software × evento": muita coisa do 10º
 * Brasileiro ainda está hardcoded espalhada pelo código (nomes de fase, textos
 * de regulamento, valores em src/inscricoes.config.ts). Veja a seção
 * "Usando em outro campeonato" do README para a lista completa.
 *
 * Os contatos ficam aqui, e não no meio de três componentes, porque são dado
 * PESSOAL de gente de verdade: quem clona o repositório precisa conseguir
 * trocá-los num lugar só, antes de subir a própria instância.
 */
export const SITE = {
  /** Nome curto usado em títulos e overlays. */
  evento: '2° Pior Campeonato de Bici Polo',
  eventoCurto: '2° PCP',
  cidade: 'Florianópolis — SC',

  contato: {
    /** E-mail público da organização. */
    email: 'bikepolofloripa@gmail.com',
    instagram: 'https://instagram.com/bikepolofloripa',
    /** Suporte técnico. Formato internacional, só dígitos (usado em wa.me/…). */
    whatsapp: '5548988618113',
    /** Como o número aparece escrito na tela. */
    whatsappLabel: '+55 48 98861-8113',
  },

  /**
   * Equipe de captação exibida em /apoie.
   *
   * ESVAZIADO NA PUBLICAÇÃO. Aqui havia nome e celular pessoal de seis pessoas
   * da organização do 2° Pior Campeonato de Bici Polo. Num repositório público esses números
   * ficariam indexáveis e seriam copiados para todo fork, para sempre — então
   * saíram daqui.
   *
   * Preencha com a SUA equipe. Com a lista vazia, a seção "Equipe de Contato"
   * simplesmente não é renderizada, e o contato oficial acima continua valendo.
   */
  equipe: [
    // { nome: 'Nome da Pessoa', telefone: '(00) 00000-0000' },
  ] as { nome: string; telefone: string }[],
} as const

export const whatsappUrl = `https://wa.me/${SITE.contato.whatsapp}`
export const emailUrl = `mailto:${SITE.contato.email}`
