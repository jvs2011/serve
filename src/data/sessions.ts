/**
 * Encontros de equipe agendados pelo líder (fora dos cultos), em que toda a equipe recebe o convite
 * e cada pessoa aceita ou recusa. Ex.: gravação do Lagoinha News.
 */
export interface TeamSession {
  id: string
  ministryId: string
  role: string // equipe convidada
  title: string
  activity: string
  defaultTime: string
}

export const TEAM_SESSIONS: TeamSession[] = [
  { id: 'news', ministryId: 'follow', role: 'Lagoinha News', title: 'Gravação Lagoinha News', activity: 'Gravação', defaultTime: '19:30' },
]
