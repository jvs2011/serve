/**
 * Encontros de equipe agendados pelo líder (fora dos cultos), em que a equipe recebe o convite
 * e cada pessoa aceita ou recusa. Ex.: gravação do Lagoinha News.
 */
export interface TeamSession {
  id: string
  ministryId: string
  /** funções convidadas (cada pessoa recebe um convite, na primeira função que tiver) */
  roles: string[]
  /** nome da equipe nos textos */
  team: string
  title: string
  activity: string
  defaultTime: string
}

/** Quem vai no dia da gravação do Lagoinha News (a Edição do News trabalha depois, por pedido) */
export const NEWS_SESSION_ROLES = ['Filmagem (News)', 'Apresentação (News)']

export const TEAM_SESSIONS: TeamSession[] = [
  { id: 'news', ministryId: 'follow', roles: NEWS_SESSION_ROLES, team: 'do Lagoinha News', title: 'Gravação Lagoinha News', activity: 'Gravação', defaultTime: '19:30' },
]

/** A primeira função do encontro que a pessoa tem no ministério (ou nenhuma) */
export function sessionRole(s: TeamSession, m: { ministries: { ministryId: string; roles: string[] }[] }): string | undefined {
  return s.roles.find((r) => m.ministries.some((mm) => mm.ministryId === s.ministryId && mm.roles.includes(r)))
}
