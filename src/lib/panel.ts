/*
 * Regras do painel do líder (serve.lagoinhafranca.com/painel, computador e tablet):
 * grade de escalas (cultos x funções), o que precisa de atenção, números da equipe e o texto da escala para o WhatsApp.
 */
import type { AppData, Assignment, ChurchEvent, Member, Ministry, SwapRequest as Swap, Task } from '../data/types.js'
import { addDays, daysBetween, fromISO, toISO, weekdayShort } from './dates.js'
import { draftsOf, openSlots, slotsFor, sortEvents } from './schedule.js'
import { pendingDeliveries } from './delivery.js'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const plusDays = (iso: string, n: number) => toISO(addDays(fromISO(iso), n))

/** Cultos e eventos do ministério no período que têm vaga para ele */
export function panelEvents(data: AppData, ministryId: string, from: string, until: string): ChurchEvent[] {
  return data.events
    .filter((e) => e.date >= from && e.date <= until && e.ministryIds.includes(ministryId) && slotsFor(data, e, ministryId).length > 0)
    .sort(sortEvents)
}

/** Colunas da grade: as funções com vaga nos eventos do período, na ordem do ministério (vagas próprias no fim) */
export function gridRoles(data: AppData, ministry: Ministry, events: ChurchEvent[]): { name: string; group: boolean; hint?: string }[] {
  const used = new Set(events.flatMap((e) => slotsFor(data, e, ministry.id).map((s) => s.name)))
  const ordered = ministry.roles.filter((r) => used.has(r.name)).map((r) => ({ name: r.name, group: !!r.group, hint: r.hint }))
  for (const name of used) if (!ordered.some((r) => r.name === name)) ordered.push({ name, group: false, hint: undefined })
  return ordered
}

export interface Cell {
  /** vagas dessa função no evento (0 = a função não entra nesse evento) */
  count: number
  group: boolean
  /** quem está na vaga (sem quem recusou), com o grupo quando é vaga de grupo */
  units: { groupId?: string; list: Assignment[] }[]
  declined: Assignment[]
  missing: number
}

/** Uma célula da grade: quem está escalado numa função de um evento */
export function cellOf(data: AppData, ev: ChurchEvent, ministryId: string, role: string): Cell {
  const slot = slotsFor(data, ev, ministryId).find((s) => s.name === role)
  const all = data.assignments.filter((a) => a.eventId === ev.id && a.ministryId === ministryId && a.role === role)
  const active = all.filter((a) => a.status !== 'declined')
  const group = !!slot?.group
  const units: Cell['units'] = []
  for (const a of active) {
    const u = group && a.groupId ? units.find((x) => x.groupId === a.groupId) : undefined
    if (u) u.list.push(a)
    else units.push({ groupId: group ? a.groupId : undefined, list: [a] })
  }
  const count = slot?.count ?? 0
  return { count, group, units, declined: all.filter((a) => a.status === 'declined'), missing: Math.max(0, count - units.length) }
}

export type Attention =
  | { kind: 'open'; ev: ChurchEvent; role: string; missing: number }
  | { kind: 'pending'; ev: ChurchEvent; a: Assignment; member: Member }
  | { kind: 'swap'; ev: ChurchEvent; a: Assignment; swap: Swap; member: Member }
  | { kind: 'drafts'; count: number }
  | { kind: 'material'; count: number }
  | { kind: 'late'; task: Task }

/**
 * O que precisa da atenção do líder, do mais urgente ao menos:
 * rascunho por publicar, trocas pedidas, vagas abertas (14 dias), quem não respondeu (até 3 dias),
 * material atrasado e pedidos atrasados.
 */
export function attentionFor(data: AppData, ministryId: string, today: string): Attention[] {
  const out: Attention[] = []
  const drafts = draftsOf(data, ministryId).length
  if (drafts) out.push({ kind: 'drafts', count: drafts })
  const evs = new Map(data.events.map((e) => [e.id, e]))
  const member = (id: string) => data.members.find((m) => m.id === id)

  for (const swap of data.swaps.filter((s) => s.status === 'open')) {
    const a = data.assignments.find((x) => x.id === swap.assignmentId)
    const ev = a && evs.get(a.eventId)
    const m = a && member(a.memberId)
    if (a && ev && m && a.ministryId === ministryId && ev.date >= today) out.push({ kind: 'swap', ev, a, swap, member: m })
  }

  const soon = panelEvents(data, ministryId, today, plusDays(today, 13))
  for (const ev of soon) for (const s of openSlots(data, ev.id, ministryId)) out.push({ kind: 'open', ev, role: s.role, missing: s.missing })

  for (const ev of soon.filter((e) => daysBetween(today, e.date) <= 3)) {
    for (const a of data.assignments.filter((x) => x.eventId === ev.id && x.ministryId === ministryId && x.status === 'pending' && !x.draft)) {
      const m = member(a.memberId)
      if (m) out.push({ kind: 'pending', ev, a, member: m })
    }
  }

  // material: quem serviu antes de hoje e ainda não enviou (últimos 14 dias)
  const people = new Set(data.assignments.filter((a) => a.ministryId === ministryId).map((a) => a.memberId))
  const material = [...people].reduce((n, id) => n + pendingDeliveries(data, id, today).filter((a) => a.ministryId === ministryId && (evs.get(a.eventId)?.date ?? '') < today).length, 0)
  if (material) out.push({ kind: 'material', count: material })

  for (const task of (data.tasks ?? []).filter((t) => t.ministryId === ministryId && t.status === 'open' && t.dueDate < today)) out.push({ kind: 'late', task })

  const rank = { drafts: 0, swap: 1, open: 2, pending: 3, material: 4, late: 5 } as const
  const date = (x: Attention) => ('ev' in x ? x.ev.date + x.ev.time : '')
  return out.sort((a, b) => date(a).localeCompare(date(b)) || rank[a.kind] - rank[b.kind])
    .sort((a, b) => Number(b.kind === 'drafts') - Number(a.kind === 'drafts'))
}

export interface TeamRow {
  member: Member
  roles: string[]
  /** escalas no mês corrente (sem recusas) */
  month: number
  next?: { ev: ChurchEvent; a: Assignment }
  /** última vez que serviu (data) */
  last?: string
  /** confirmou / respondeu nos últimos 90 dias e nas próximas escalas (null = ainda não respondeu nada) */
  confirmRate: number | null
  /** dias marcados como indisponível nos próximos 30 dias, mais os horários fixos */
  off: number
  recurringOff: number
}

/** Números de cada pessoa da equipe do ministério */
export function teamRows(data: AppData, ministryId: string, today: string): TeamRow[] {
  const evs = new Map(data.events.map((e) => [e.id, e]))
  const from90 = plusDays(today, -90)
  const until30 = plusDays(today, 30)
  return data.members
    .filter((m) => m.ministries.some((mm) => mm.ministryId === ministryId))
    .map((member) => {
      const mine = data.assignments.filter((a) => a.memberId === member.id && !a.draft)
      const inMinistry = mine.filter((a) => a.ministryId === ministryId)
      const month = mine.filter((a) => a.status !== 'declined' && evs.get(a.eventId)?.date.slice(0, 7) === today.slice(0, 7)).length
      const upcoming = inMinistry
        .filter((a) => a.status !== 'declined' && (evs.get(a.eventId)?.date ?? '') >= today)
        .sort((x, y) => sortEvents(evs.get(x.eventId)!, evs.get(y.eventId)!))
      const next = upcoming[0] && { ev: evs.get(upcoming[0].eventId)!, a: upcoming[0] }
      const past = inMinistry
        .filter((a) => a.status === 'confirmed' && (evs.get(a.eventId)?.date ?? '9') < today)
        .map((a) => evs.get(a.eventId)!.date).sort()
      const answered = inMinistry.filter((a) => a.status !== 'pending' && (evs.get(a.eventId)?.date ?? '') >= from90)
      const confirmRate = answered.length ? Math.round((answered.filter((a) => a.status === 'confirmed').length / answered.length) * 100) : null
      const off = (data.unavailability[member.id] ?? []).filter((d) => d >= today && d <= until30).length
      return {
        member, roles: member.ministries.find((mm) => mm.ministryId === ministryId)?.roles ?? [],
        month, next, last: past[past.length - 1], confirmRate, off, recurringOff: member.recurringOff?.length ?? 0,
      }
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name))
}

/** Quem precisa de cuidado: sem escala futura e não serve há mais de 3 semanas (ou nunca serviu) */
export function careList(rows: TeamRow[], today: string): TeamRow[] {
  return rows.filter((r) => !r.next && (!r.last || daysBetween(r.last, today) > 21))
}

/**
 * Texto da escala para mandar no grupo do WhatsApp (só o que já foi publicado; quem recusou fica de fora):
 *   *Escala Follow* · 15/11 a 13/12
 *
 *   *dom 15/11 · 09:30 · Culto de Celebração*
 *   Fotografia: Carolina
 */
export function scheduleText(data: AppData, ministry: Ministry, events: ChurchEvent[], from: string, until: string): string {
  const name = (id: string) => data.members.find((m) => m.id === id)?.name.split(' ')[0] ?? '?'
  const groupName = (id?: string) => ministry.groups?.find((g) => g.id === id)?.name
  const lines = [`*Escala ${ministry.name}* · ${ddmm(from)} a ${ddmm(until)}`]
  for (const ev of events) {
    const roles = gridRoles(data, ministry, [ev])
    const rows = roles.map((r) => {
      const c = cellOf(data, ev, ministry.id, r.name)
      const who = c.units
        .map((u) => ({ ...u, list: u.list.filter((a) => !a.draft) }))
        .filter((u) => u.list.length)
        .map((u) => (u.groupId && groupName(u.groupId) ? groupName(u.groupId)! : u.list.map((a) => name(a.memberId)).join(', ')))
      return `${r.name}: ${who.length ? who.join(', ') : '—'}`
    })
    lines.push('', `*${weekdayShort(ev.date).toLowerCase()} ${ddmm(ev.date)}${ev.time ? ` · ${ev.time}` : ''} · ${ev.title}*`, ...rows)
  }
  return lines.join('\n')
}
