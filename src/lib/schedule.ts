import type { AppData, Assignment, ChurchEvent, Member } from '../data/types.js'
import { daysBetween, todayISO } from './dates.js'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Chave do culto fixo de um evento: dia da semana + horário (ex.: "0-09:30") */
export function recurringKey(ev: { date: string; time: string }): string {
  const [y, m, d] = ev.date.split('-').map(Number)
  return `${new Date(y, m - 1, d).getDay()}-${ev.time}`
}

/** A pessoa marcou que não pode nesse dia (data específica ou culto fixo da semana)? */
export function isOff(data: AppData, member: Member, ev: ChurchEvent): boolean {
  return (data.unavailability[member.id] ?? []).includes(ev.date) || (!!ev.time && (member.recurringOff ?? []).includes(recurringKey(ev)))
}

export interface Availability {
  unavailable: boolean
  /** indisponível por ser um culto fixo que a pessoa marcou */
  recurring: boolean
  /** Já está escalado neste mesmo evento (em qualquer ministério) */
  conflict: Assignment | null
  /** Já serve em outro evento no mesmo dia */
  sameDay: boolean
  monthCount: number
  overLimit: boolean
}

export function availabilityFor(data: AppData, member: Member, event: ChurchEvent): Availability {
  const recurring = !!event.time && (member.recurringOff ?? []).includes(recurringKey(event))
  const unavailable = recurring || (data.unavailability[member.id] ?? []).includes(event.date)
  const eventsById = new Map(data.events.map((e) => [e.id, e]))
  const mine = data.assignments.filter((a) => a.memberId === member.id && a.status !== 'declined')
  const conflict = mine.find((a) => a.eventId === event.id) ?? null
  const sameDay = mine.some((a) => a.eventId !== event.id && eventsById.get(a.eventId)?.date === event.date)
  const month = event.date.slice(0, 7)
  const monthCount = mine.filter((a) => eventsById.get(a.eventId)?.date.slice(0, 7) === month).length
  return { unavailable, recurring, conflict, sameDay, monthCount, overLimit: monthCount >= member.maxPerMonth }
}

/**
 * Vagas de um ministério num evento: as vagas próprias do evento, se houver;
 * senão as vagas padrão do ministério (funções com 0 não entram nos cultos).
 */
export function slotsFor(data: AppData, ev: ChurchEvent | undefined, ministryId: string): { name: string; count: number; group?: boolean; hint?: string }[] {
  const ministry = data.ministries.find((m) => m.id === ministryId)
  if (ev?.slots) {
    return ev.slots.filter((s) => s.ministryId === ministryId).map((s) => {
      const r = ministry?.roles.find((x) => x.name === s.role)
      return { name: s.role, count: s.count, ...(r?.group ? { group: true } : {}), ...(r?.hint ? { hint: r.hint } : {}) }
    })
  }
  return (ministry?.roles ?? []).filter((r) => r.count > 0)
}

/** Vagas abertas (função ainda sem gente suficiente) de um ministério num evento */
export function openSlots(data: AppData, eventId: string, ministryId: string): { role: string; missing: number; group: boolean }[] {
  const ev = data.events.find((e) => e.id === eventId)
  return slotsFor(data, ev, ministryId)
    .map((r) => {
      const list = data.assignments.filter(
        (a) => a.eventId === eventId && a.ministryId === ministryId && a.role === r.name && a.status !== 'declined',
      )
      // vaga de grupo: cada grupo (ou pessoa avulsa) ocupa uma vaga
      const filled = r.group ? new Set(list.map((a) => a.groupId ?? a.id)).size : list.length
      return { role: r.name, missing: Math.max(0, r.count - filled), group: !!r.group }
    })
    .filter((s) => s.missing > 0)
}

/** Grupos de um ministério com a situação de cada um para um evento, do mais indicado ao menos indicado */
export function rankGroups(data: AppData, event: ChurchEvent, ministryId: string) {
  const ministry = data.ministries.find((m) => m.id === ministryId)
  return (ministry?.groups ?? [])
    .map((group) => {
      const people = group.memberIds.map((id) => data.members.find((m) => m.id === id)).filter((m): m is Member => !!m)
      const status = people.map((member) => ({ member, av: availabilityFor(data, member, event) }))
      const free = status.filter((s) => !s.av.unavailable && !s.av.conflict)
      // quantas vezes o grupo serviu nos 45 dias anteriores (rodízio entre grupos)
      const used = new Set(data.assignments.filter((a) => a.groupId === group.id && a.status !== 'declined').map((a) => a.eventId))
      const recent = [...used].filter((id) => {
        const ev = data.events.find((e) => e.id === id)
        if (!ev) return false
        const d = daysBetween(ev.date, event.date)
        return d >= 0 && d <= 45
      }).length
      const busy = people.length - free.length
      const score = (free.length === 0 ? 1000 : 0) + busy * 20 + recent * 3
      return { group, people, status, free, recent, score, blocked: free.length === 0 }
    })
    .sort((a, b) => a.score - b.score || a.group.name.localeCompare(b.group.name))
}

/** Escala um grupo inteiro (quem estiver indisponível ou já escalado no evento fica de fora) */
export function groupAssignments(data: AppData, event: ChurchEvent, ministryId: string, role: string, groupId: string, status: Assignment['status'] = 'pending'): Assignment[] {
  const ranked = rankGroups(data, event, ministryId).find((g) => g.group.id === groupId)
  if (!ranked) return []
  return ranked.free.map(({ member }) => ({ id: uid(), eventId: event.id, ministryId, role, memberId: member.id, status, groupId }))
}

/** Candidatos para uma função, do mais indicado para o menos indicado */
export function rankCandidates(data: AppData, event: ChurchEvent, ministryId: string, role: string) {
  const recentFrom = event.date
  return data.members
    .filter((m) => m.ministries.some((mm) => mm.ministryId === ministryId && mm.roles.includes(role)))
    .map((member) => {
      const av = availabilityFor(data, member, event)
      // quantas vezes serviu nos 45 dias anteriores ao evento (rodízio justo)
      const recent = data.assignments.filter((a) => {
        if (a.memberId !== member.id || a.status === 'declined') return false
        const ev = data.events.find((e) => e.id === a.eventId)
        if (!ev) return false
        const d = daysBetween(ev.date, recentFrom)
        return d >= 0 && d <= 45
      }).length
      const blocked = av.unavailable || !!av.conflict
      const score = (blocked ? 1000 : 0) + (av.overLimit ? 100 : 0) + (av.sameDay ? 5 : 0) + recent * 3 + av.monthCount * 2
      return { member, av, score, blocked }
    })
    .sort((a, b) => a.score - b.score || a.member.name.localeCompare(b.member.name))
}

/**
 * Escala automática: preenche as vagas abertas de um ministério num evento
 * respeitando indisponibilidade, conflito com outras escalas, limite mensal e rodízio.
 */
export function autoFill(data: AppData, eventId: string, ministryId: string, status: Assignment['status'] = 'pending'): Assignment[] {
  const event = data.events.find((e) => e.id === eventId)
  if (!event) return []
  const created: Assignment[] = []
  const working: AppData = { ...data, assignments: [...data.assignments] }
  for (const slot of openSlots(working, eventId, ministryId)) {
    if (slot.group) {
      // vaga de grupo: escolhe os grupos mais indicados que ainda não estão neste evento
      const inEvent = new Set(working.assignments.filter((a) => a.eventId === eventId && a.groupId).map((a) => a.groupId))
      for (const g of rankGroups(working, event, ministryId).filter((g) => !g.blocked && !inEvent.has(g.group.id)).slice(0, slot.missing)) {
        const add = groupAssignments(working, event, ministryId, slot.role, g.group.id, status)
        working.assignments.push(...add)
        created.push(...add)
      }
      continue
    }
    for (let i = 0; i < slot.missing; i++) {
      const pick = rankCandidates(working, event, ministryId, slot.role).find((c) => !c.blocked && !c.av.overLimit)
      if (!pick) break
      const a: Assignment = { id: uid(), eventId, ministryId, role: slot.role, memberId: pick.member.id, status }
      working.assignments.push(a)
      created.push(a)
    }
  }
  return created
}

/** Pontos de gamificação: check-in 10, feedback 2, cobrir troca 5, confirmar 1 */
export function pointsFor(data: AppData, memberId: string): number {
  let pts = 0
  for (const a of data.assignments) {
    if (a.memberId !== memberId) continue
    if (a.status === 'confirmed') pts += 1
    if (a.checkedIn) pts += 10
    if (a.feedback) pts += 2
  }
  pts += data.swaps.filter((s) => s.status === 'accepted' && s.acceptedById === memberId).length * 5
  return pts
}

export function levelFor(points: number): { name: string; next: number; base: number } {
  const levels = [
    { name: 'Semente', base: 0 },
    { name: 'Broto', base: 30 },
    { name: 'Árvore', base: 80 },
    { name: 'Frutífera', base: 160 },
    { name: 'Floresta', base: 300 },
  ]
  let i = 0
  while (i + 1 < levels.length && points >= levels[i + 1].base) i++
  return { name: levels[i].name, base: levels[i].base, next: levels[i + 1]?.base ?? levels[i].base }
}

export const isPast = (ev: ChurchEvent) => ev.date < todayISO()
export const isToday = (ev: ChurchEvent) => ev.date === todayISO()

export function canManage(member: Member, ministryId: string, data: AppData): boolean {
  if (member.access === 'admin') return true
  return data.ministries.find((m) => m.id === ministryId)?.leaderIds.includes(member.id) ?? false
}

export function sortEvents(a: ChurchEvent, b: ChurchEvent) {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
}

/** Repertório do culto: líder do Louvor, admin ou quem está escalado no Louvor desse culto (e não recusou) */
export function canEditSetlist(data: AppData, member: Member, ev: ChurchEvent): boolean {
  if (canManage(member, 'louvor', data)) return true
  return data.assignments.some((a) => a.eventId === ev.id && a.ministryId === 'louvor' && a.memberId === member.id && a.status !== 'declined')
}
