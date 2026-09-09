import { createContext, useContext, type ReactNode } from 'react'

export type TournamentCategory = 'misto' | 'mtnb'

const TournamentContext = createContext<TournamentCategory>('misto')

export function TournamentProvider({ categoria, children }: { categoria: TournamentCategory; children: ReactNode }) {
  return <TournamentContext.Provider value={categoria}>{children}</TournamentContext.Provider>
}

export function useTournamentCategory(): TournamentCategory {
  return useContext(TournamentContext)
}

export const TOURNAMENT_PRESENTATION = {
  misto: { title: '10º Brasileiro — Misto', short: '10º CBBP', official: '10º Brasileiro Misto' },
  mtnb: { title: '4º Brasileiro MTNB', short: '4º MTNB', official: '4º Brasileiro MTNB' },
} as const
