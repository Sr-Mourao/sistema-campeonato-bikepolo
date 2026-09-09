import { describe, expect, it } from 'vitest'
import { TORNEIO_TRANSMISSOES } from './torneioTransmissoes'

describe('transmissões do hub público do torneio', () => {
  it('lista as quatro lives oficiais sem depender de API do YouTube', () => {
    expect(TORNEIO_TRANSMISSOES.map(live => live.videoId)).toEqual(['4cxMIsOT8VE', 'mzZQA8Nb9dc', 'Dkh2EiHnlzI', 'I9LfG7kPIos'])
    expect(TORNEIO_TRANSMISSOES.map(live => live.url)).toEqual([
      'https://youtube.com/live/4cxMIsOT8VE', 'https://youtube.com/live/mzZQA8Nb9dc', 'https://www.youtube.com/live/Dkh2EiHnlzI?is=7chiaSCcTv5o5b41', 'https://youtube.com/live/I9LfG7kPIos',
    ])
  })
})
