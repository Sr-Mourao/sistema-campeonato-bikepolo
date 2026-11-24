import { createContext, useContext, type ReactNode } from 'react'

export type TournamentCategory = 'misto'

const TournamentContext = createContext<TournamentCategory>('misto')

export function TournamentProvider({ categoria, children }: { categoria: TournamentCategory; children: ReactNode }) {
  return <TournamentContext.Provider value={categoria}>{children}</TournamentContext.Provider>
}

export function useTournamentCategory(): TournamentCategory {
  return useContext(TournamentContext)
}

export const TOURNAMENT_PRESENTATION = {
  misto: { title: '2° Pior Campeonato de Bici Polo — Misto', short: '2° PCP', official: '2° Pior Campeonato de Bici Polo Misto' },
} as const
