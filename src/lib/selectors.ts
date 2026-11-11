import type { AppData, Assignment, ChurchEvent, Member, Ministry, Notice } from '../data/types'
import { todayISO } from './dates'
import { sortEvents } from './schedule'

export interface Joined {
  a: Assignment
  ev: ChurchEvent
  ministry: Ministry
}

export function join(data: AppData, list: Assignment[]): Joined[] {
  const evs = new Map(data.events.map((e) => [e.id, e]))
  const mins = new Map(data.ministries.map((m) => [m.id, m]))
  return list
    .map((a) => ({ a, ev: evs.get(a.eventId)!, ministry: mins.get(a.ministryId)! }))
    .filter((x) => x.ev && x.ministry)
    .sort((x, y) => sortEvents(x.ev, y.ev))
}

export function myUpcoming(data: AppData, memberId: string): Joined[] {
  const t = todayISO()
  return join(data, data.assignments.filter((a) => a.memberId === memberId && a.status !== 'declined' && !a.draft)).filter((x) => x.ev.date >= t)
}

export function myPast(data: AppData, memberId: string): Joined[] {
  const t = todayISO()
  return join(data, data.assignments.filter((a) => a.memberId === memberId && a.status !== 'declined' && !a.draft))
    .filter((x) => x.ev.date < t)
    .reverse()
}

export function memberById(data: AppData, id: string): Member | undefined {
  return data.members.find((m) => m.id === id)
}

export function managedMinistries(data: AppData, me: Member): Ministry[] {
  if (me.access === 'admin') return data.ministries
  return data.ministries.filter((m) => m.leaderIds.includes(me.id))
}

export function myMinistries(data: AppData, me: Member): Ministry[] {
  const ids = new Set([...me.ministries.map((m) => m.ministryId), ...managedMinistries(data, me).map((m) => m.id)])
  return data.ministries.filter((m) => ids.has(m.id))
}

/** Pedidos de troca que eu posso cobrir (mesmo ministério e função, e eu estou livre) */
export function swapsICanCover(data: AppData, me: Member) {
  return data.swaps
    .filter((s) => s.status === 'open' && s.fromMemberId !== me.id)
    .map((s) => {
      const a = data.assignments.find((x) => x.id === s.assignmentId)
      const ev = a && data.events.find((e) => e.id === a.eventId)
      const ministry = a && data.ministries.find((m) => m.id === a.ministryId)
      return a && ev && ministry ? { s, a, ev, ministry } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.ev.date >= todayISO())
    .filter(({ a }) => me.ministries.some((mm) => mm.ministryId === a.ministryId && mm.roles.includes(a.role)))
}

export function ministryMembers(data: AppData, ministryId: string): Member[] {
  return data.members
    .filter((m) => m.ministries.some((mm) => mm.ministryId === ministryId))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function firstName(name: string) {
  return name.split(' ')[0]
}

/** Ministérios em que a pessoa está marcada como líder (para a aba do líder) */
export function ledMinistries(data: AppData, me: Member): Ministry[] {
  return data.ministries.filter((m) => m.leaderIds.includes(me.id))
}

/** Aviso que aparece para a equipe: não foi retirado e a data de término (se houver) ainda não passou */
export function noticeActive(n: Notice, today: string): boolean {
  return !n.archivedAt && (!n.until || n.until >= today)
}
