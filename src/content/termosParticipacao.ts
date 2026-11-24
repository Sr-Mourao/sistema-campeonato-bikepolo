// Conteúdo canônico dos Termos de Participação / Código de Conduta do 10º Campeonato
// Brasileiro de Bike Polo. Fonte ÚNICA — usado tanto no fluxo de inscrição
// (TermosParticipacao.tsx) quanto na página pública de Regulamento
// (src/pages/torneio/Regulamento.tsx). Nunca duplicar este texto em outro lugar.
export interface BlocoTermos { titulo: string; texto: string }

export const TERMOS: BlocoTermos[] = [
  {
    titulo: '',
    texto: 'Ao participar do evento, você concorda com as condições descritas neste documento.',
  },
  {
    titulo: '1. Código de Conduta',
    texto: '',
  },
  {
    titulo: '',
    texto: 'O Pior Campeonato de Bici Polo é um espaço de convivência, competição e construção comunitária. Ao participar do evento, você concorda em contribuir para um ambiente seguro, respeitoso e acolhedor para todas as pessoas.',
  },
  {
    titulo: '1.1 Respeito',
    texto: 'Esperamos que todas as pessoas participantes tratem umas às outras com respeito, dentro e fora de quadra. Não serão tolerados comportamentos que promovam constrangimento, intimidação, humilhação, discriminação, exclusão ou qualquer forma de assédio, independentemente de gênero, identidade de gênero, orientação sexual, raça, etnia, nacionalidade, deficiência, religião, aparência física, condição econômica ou qualquer outra característica pessoal.',
  },
  {
    titulo: '1.2 Segurança',
    texto: 'A segurança física e emocional das pessoas participantes é uma prioridade. Espera-se que todas as pessoas ajam de forma responsável, evitando comportamentos que coloquem em risco a si mesmas, outras pessoas, equipamentos ou espaços utilizados durante o evento.',
  },
  {
    titulo: '1.3 Inclusão',
    texto: 'O Bike Polo é um esporte construído por pessoas com diferentes trajetórias, identidades e experiências. Buscamos promover um ambiente onde todas as pessoas possam participar, competir e conviver com dignidade, sendo tratadas com respeito e legitimidade.',
  },
  {
    titulo: '1.4 Cuidado com os espaços e materiais',
    texto: 'Os espaços, equipamentos e estruturas utilizados durante o campeonato existem graças ao esforço coletivo de muitas pessoas e instituições. Pedimos cuidado com a quadra, alojamentos, áreas comuns, equipamentos compartilhados e demais recursos disponibilizados para o evento.',
  },
  {
    titulo: '1.5 Jogo Limpo',
    texto: 'Competir faz parte do esporte, mas o resultado nunca deve estar acima do respeito às pessoas. Esperamos que atletas, equipes, arbitragem, organização e público atuem com espírito esportivo, honestidade, responsabilidade e cooperação.',
  },
  {
    titulo: '1.6 Diálogo e Construção Coletiva',
    texto: 'Conflitos, divergências e problemas podem acontecer. Incentivamos que situações sejam tratadas por meio do diálogo e da escuta, buscando soluções que fortaleçam a comunidade e o evento.',
  },
  {
    titulo: '1.7 Consequências',
    texto: 'Situações que violem este Código de Conduta poderão ser analisadas pela organização do campeonato. Dependendo da gravidade, poderão ser aplicadas medidas como orientação, advertência, perda de participação em atividades específicas ou, em casos graves, remoção do evento sem direito a reembolso.',
  },
  {
    titulo: '1.8 Compromisso',
    texto: 'Ao participar do campeonato, declaro ter lido e concordado com este Código de Conduta, comprometendo-me a respeitar as pessoas, os espaços e os valores que sustentam a comunidade do Bike Polo.',
  },
  {
    titulo: '2. Uso de Imagem',
    texto: 'Autorizo o uso da minha imagem, voz e nome em fotografias, vídeos, transmissões e materiais de divulgação relacionados ao Pior Campeonato de Bici Polo e às atividades associadas ao evento, sem ônus para a organização.',
  },
  {
    titulo: '3. Tratamento de Dados Pessoais',
    texto: 'Autorizo o tratamento dos dados pessoais fornecidos nesta inscrição para fins de organização, comunicação, execução e prestação de contas relacionadas ao evento, nos termos da Lei Geral de Proteção de Dados (LGPD).',
  },
  {
    titulo: '4. Aptidão para Participação',
    texto: 'Declaro que estou apto(a/e) a participar das atividades esportivas do evento, assumindo a responsabilidade pela minha participação e comprometendo-me a respeitar as orientações de segurança da organização.',
  },
  {
    titulo: '5. Concordância',
    texto: 'Ao concluir minha inscrição, declaro que li, compreendi e concordo com os Termos de Participação do 2° Pior Campeonato de Bici Polo.',
  },
]
