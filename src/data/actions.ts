/*
 * Todas as alterações de dados do Serve passam por aqui.
 * O mesmo código roda no celular (demonstração) e no servidor (dados reais),
 * e o servidor confere as permissões de quem está pedindo a alteração.
 */
import type { AppData, AssignmentStatus, ChurchEvent, Member, Song, WeeklySlot } from './types.js'
import { applyWeekly } from './agenda.js'
import { deliveryLabel } from '../lib/delivery.js'
import { isRequestKind, REQUEST_KINDS } from '../lib/requests.js'
import { todayISO } from '../lib/dates.js'
import { autoFill, canEditSetlist, canManage, groupAssignments, isOff, uid } from '../lib/schedule.js'
import { sessionRole, TEAM_SESSIONS } from './sessions.js'
import { LEADER_ROLES } from './seed.js'
import { isValidPhone, normalizePhone, tidyName } from '../lib/people.js'

export interface MemberInput {
  id?: string
  name: string
  phone: string
  admin?: boolean
  ministries: { ministryId: string; roles: string[]; leader: boolean }[]
}

export interface TaskInput {
  id?: string
  ministryId: string
  title: string
  eventId?: string
  details: string
  assigneeId: string
  dueDate: string
  /** 'video' = edição de vídeo; 'news' = vídeo do Lagoinha News (só projeção) */
  kind?: 'video' | 'photo' | 'news'
  /** vai para a projeção (o vídeo do News sempre vai) */
  projection?: boolean
  /** vai para as mídias sociais */
  social?: boolean
  /** vídeo do News: domingo em que passa */
  airDate?: string
}

/** Evento criado pelo líder para o próprio ministério (ex.: ação externa do We Care) */
export interface MinistryEventInput {
  ministryId: string
  title: string
  date: string
  time: string
  endTime?: string
  place?: string
  /** 'Interno' ou 'Externo' */
  kind?: string
  slots: { role: string; count: number }[]
}

/** Alterações de um evento (líder: eventos do ministério; coordenação: qualquer evento) */
export interface EventPatch {
  title: string
  date: string
  time: string
  endTime?: string
  place?: string
  activity?: string
  /** só a coordenação muda os ministérios de um evento */
  ministryIds?: string[]
  /** vagas próprias do evento (eventos de ministério) */
  slots?: { ministryId: string; role: string; count: number }[]
}

export type Action =
  | { type: 'respond'; assignmentId: string; status: AssignmentStatus }
  | { type: 'checkIn'; assignmentId: string }
  | { type: 'feedback'; assignmentId: string; rating: number; comment: string }
  | { type: 'toggleUnavailable'; date: string }
  | { type: 'toggleRecurringOff'; key: string }
  | { type: 'setMaxPerMonth'; n: number }
  | { type: 'requestSwap'; assignmentId: string; reason: string }
  | { type: 'cancelSwap'; swapId: string }
  | { type: 'acceptSwap'; swapId: string }
  | { type: 'assign'; eventId: string; ministryId: string; role: string; memberId: string }
  | { type: 'unassign'; assignmentId: string }
  | { type: 'saveGroup'; ministryId: string; group: { id?: string; name: string; memberIds: string[] } }
  | { type: 'removeGroup'; ministryId: string; groupId: string }
  | { type: 'assignGroup'; eventId: string; ministryId: string; role: string; groupId: string }
  | { type: 'unassignGroup'; eventId: string; groupId: string }
  | { type: 'autoSchedule'; eventIds: string[]; ministryId: string }
  | { type: 'publishDrafts'; ministryId: string; eventId?: string }
  | { type: 'discardDrafts'; ministryId: string; eventId?: string }
  | { type: 'addNotice'; ministryId: string | null; title: string; body: string }
  | { type: 'addSong'; eventId: string; song: Omit<Song, 'id'> }
  | { type: 'removeSong'; eventId: string; songId: string }
  | { type: 'editSong'; eventId: string; songId: string; song: Omit<Song, 'id'> }
  | { type: 'moveSong'; eventId: string; songId: string; dir: -1 | 1 }
  | { type: 'addEvent'; title: string; date: string; time: string; ministryIds: string[] }
  | { type: 'saveMember'; member: MemberInput }
  | { type: 'setMemberRoles'; memberId: string; ministryId: string; roles: string[] }
  | { type: 'removeMember'; memberId: string }
  | { type: 'setOpen'; open: boolean }
  | { type: 'setDemo'; show: boolean }
  | { type: 'resetPin'; memberId: string }
  | { type: 'saveTask'; task: TaskInput }
  | { type: 'createTeamSession'; sessionId: string; date: string; time: string; place?: string; note?: string }
  | { type: 'removeEvent'; eventId: string }
  | { type: 'addMinistryEvent'; event: MinistryEventInput }
  | { type: 'editEvent'; eventId: string; patch: EventPatch }
  | { type: 'saveWeekly'; slot: WeeklySlot }
  | { type: 'removeWeekly'; slotId: string }
  | { type: 'sendSetlist'; eventId: string }
  | { type: 'deliverMaterial'; assignmentId: string; link: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setTaskDone'; taskId: string; done: boolean; link?: string }

export interface ActionResult {
  created?: number
  updated?: number
  removed?: number
  memberId?: string
}

/** Erro com mensagem pronta para mostrar ao usuário */
export class ActionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const deny = () => new ActionError('Você não tem permissão para fazer isso.', 403)
const notFound = () => new ActionError('Não encontramos esse item. Atualize a tela e tente de novo.', 404)

export function applyAction(d: AppData, action: Action, actorId: string): ActionResult {
  const me = d.members.find((m) => m.id === actorId)
  if (!me) throw new ActionError('Sua conta não foi encontrada. Entre novamente.', 401)
  const isAdmin = me.access === 'admin'
  const findA = (id: string) => d.assignments.find((a) => a.id === id) ?? (() => { throw notFound() })()
  const findEv = (id: string) => d.events.find((e) => e.id === id) ?? (() => { throw notFound() })()
  const mine = (memberId: string) => { if (memberId !== me.id) throw deny() }
  const manage = (ministryId: string) => { if (!canManage(me, ministryId, d)) throw deny() }

  switch (action.type) {
    case 'respond': {
      const a = findA(action.assignmentId)
      mine(a.memberId)
      a.status = action.status
      return {}
    }
    case 'checkIn': {
      const a = findA(action.assignmentId)
      mine(a.memberId)
      a.checkedIn = true
      a.status = 'confirmed'
      return {}
    }
    case 'feedback': {
      const a = findA(action.assignmentId)
      mine(a.memberId)
      a.feedback = { rating: Math.max(1, Math.min(5, Math.round(action.rating))), comment: action.comment.slice(0, 500) }
      return {}
    }
    case 'toggleUnavailable': {
      const list = d.unavailability[me.id] ?? []
      d.unavailability[me.id] = list.includes(action.date) ? list.filter((x) => x !== action.date) : [...list, action.date].sort()
      return {}
    }
    case 'toggleRecurringOff': {
      if (!/^[0-6]-\d{2}:\d{2}$/.test(action.key)) throw new ActionError('Horário inválido.')
      const list = me.recurringOff ?? []
      me.recurringOff = list.includes(action.key) ? list.filter((k) => k !== action.key) : [...list, action.key].sort()
      return {}
    }
    case 'setMaxPerMonth':
      me.maxPerMonth = Math.max(1, Math.min(12, Math.round(action.n)))
      return {}
    case 'requestSwap': {
      const a = findA(action.assignmentId)
      mine(a.memberId)
      d.swaps = d.swaps.filter((s) => !(s.assignmentId === a.id && s.status === 'open'))
      d.swaps.unshift({ id: uid(), assignmentId: a.id, fromMemberId: me.id, reason: action.reason.slice(0, 300), createdAt: new Date().toISOString(), status: 'open' })
      return {}
    }
    case 'cancelSwap': {
      const s = d.swaps.find((x) => x.id === action.swapId) ?? (() => { throw notFound() })()
      mine(s.fromMemberId)
      s.status = 'cancelled'
      return {}
    }
    case 'acceptSwap': {
      const s = d.swaps.find((x) => x.id === action.swapId) ?? (() => { throw notFound() })()
      if (s.status !== 'open') throw new ActionError('Alguém já assumiu essa escala.', 409)
      const a = findA(s.assignmentId)
      const canDo = me.ministries.some((mm) => mm.ministryId === a.ministryId && mm.roles.includes(a.role))
      if (!canDo) throw deny()
      if (d.assignments.some((x) => x.eventId === a.eventId && x.memberId === me.id && x.status !== 'declined')) {
        throw new ActionError('Você já está escalado nesse culto.', 409)
      }
      a.memberId = me.id
      a.status = 'confirmed'
      s.status = 'accepted'
      s.acceptedById = me.id
      return {}
    }
    case 'assign': {
      manage(action.ministryId)
      findEv(action.eventId)
      if (!d.members.some((m) => m.id === action.memberId)) throw notFound()
      d.assignments.push({ id: uid(), eventId: action.eventId, ministryId: action.ministryId, role: action.role, memberId: action.memberId, status: 'pending', draft: true })
      return {}
    }
    case 'unassign': {
      const a = findA(action.assignmentId)
      manage(a.ministryId)
      d.assignments = d.assignments.filter((x) => x.id !== a.id)
      d.swaps = d.swaps.filter((s) => s.assignmentId !== a.id)
      return {}
    }
    case 'saveGroup': {
      manage(action.ministryId)
      const ministry = d.ministries.find((m) => m.id === action.ministryId) ?? (() => { throw notFound() })()
      const name = action.group.name.trim().replace(/\s+/g, ' ').slice(0, 40)
      if (!name) throw new ActionError('Dê um nome para o grupo.')
      ministry.groups ??= []
      const existing = action.group.id ? ministry.groups.find((g) => g.id === action.group.id) : undefined
      if (action.group.id && !existing) throw notFound()
      if (ministry.groups.some((g) => g.id !== existing?.id && g.name.toLowerCase() === name.toLowerCase())) throw new ActionError('Já existe um grupo com esse nome.')
      const allowed = new Set(groupPeople(d, ministry.id).map((m) => m.id))
      const memberIds = [...new Set(action.group.memberIds)].filter((id) => allowed.has(id))
      if (!memberIds.length) throw new ActionError('Escolha quem faz parte do grupo.')
      if (existing) Object.assign(existing, { name, memberIds })
      else ministry.groups.push({ id: uid(), name, memberIds })
      return {}
    }
    case 'removeGroup': {
      manage(action.ministryId)
      const ministry = d.ministries.find((m) => m.id === action.ministryId) ?? (() => { throw notFound() })()
      ministry.groups = (ministry.groups ?? []).filter((g) => g.id !== action.groupId)
      return {}
    }
    case 'assignGroup': {
      manage(action.ministryId)
      const ev = findEv(action.eventId)
      const ministry = d.ministries.find((m) => m.id === action.ministryId)
      if (!ministry?.groups?.some((g) => g.id === action.groupId)) throw notFound()
      if (d.assignments.some((a) => a.eventId === ev.id && a.groupId === action.groupId)) throw new ActionError('Esse grupo já está nesse culto.', 409)
      const add = groupAssignments(d, ev, action.ministryId, action.role, action.groupId)
      if (!add.length) throw new ActionError('Ninguém desse grupo está disponível nesse dia.')
      for (const a of add) a.draft = true
      d.assignments.push(...add)
      return { created: add.length }
    }
    case 'unassignGroup': {
      const list = d.assignments.filter((a) => a.eventId === action.eventId && a.groupId === action.groupId)
      if (!list.length) return {}
      manage(list[0].ministryId)
      const gone = new Set(list.map((a) => a.id))
      d.assignments = d.assignments.filter((a) => !gone.has(a.id))
      d.swaps = d.swaps.filter((s) => !gone.has(s.assignmentId))
      return {}
    }
    case 'autoSchedule': {
      manage(action.ministryId)
      let created = 0
      for (const id of action.eventIds) {
        const ev = d.events.find((e) => e.id === id)
        if (!ev || !ev.ministryIds.includes(action.ministryId)) continue
        const add = autoFill(d, id, action.ministryId)
        for (const a of add) a.draft = true
        d.assignments.push(...add)
        created += add.length
      }
      return { created }
    }
    case 'publishDrafts': {
      manage(action.ministryId)
      let created = 0
      for (const a of d.assignments) {
        if (!a.draft || a.ministryId !== action.ministryId || (action.eventId && a.eventId !== action.eventId)) continue
        delete a.draft
        created++
      }
      return { created }
    }
    case 'discardDrafts': {
      manage(action.ministryId)
      const before = d.assignments.length
      d.assignments = d.assignments.filter((a) => !(a.draft && a.ministryId === action.ministryId && (!action.eventId || a.eventId === action.eventId)))
      return { created: before - d.assignments.length }
    }
    case 'addNotice': {
      if (action.ministryId === null ? !isAdmin : !canManage(me, action.ministryId, d)) throw deny()
      d.notices.unshift({ id: uid(), ministryId: action.ministryId, authorId: me.id, title: action.title.slice(0, 120), body: action.body.slice(0, 2000), createdAt: new Date().toISOString() })
      return {}
    }
    case 'addSong': {
      const ev = findEv(action.eventId)
      if (!canEditSetlist(d, me, ev)) throw deny()
      ev.setlist.push({ ...cleanSong(action.song), id: uid() })
      return {}
    }
    case 'editSong': {
      const ev = findEv(action.eventId)
      if (!canEditSetlist(d, me, ev)) throw deny()
      const s = ev.setlist.find((x) => x.id === action.songId) ?? (() => { throw notFound() })()
      Object.assign(s, cleanSong(action.song))
      return {}
    }
    case 'moveSong': {
      const ev = findEv(action.eventId)
      if (!canEditSetlist(d, me, ev)) throw deny()
      const i = ev.setlist.findIndex((x) => x.id === action.songId)
      if (i < 0) throw notFound()
      const j = i + (action.dir < 0 ? -1 : 1)
      if (j < 0 || j >= ev.setlist.length) return {}
      ;[ev.setlist[i], ev.setlist[j]] = [ev.setlist[j], ev.setlist[i]]
      return {}
    }
    case 'removeSong': {
      const ev = findEv(action.eventId)
      if (!canEditSetlist(d, me, ev)) throw deny()
      ev.setlist = ev.setlist.filter((s) => s.id !== action.songId)
      return {}
    }
    case 'addEvent': {
      if (!isAdmin) throw deny()
      d.events.push({ id: uid(), title: action.title.slice(0, 120), date: action.date, time: action.time, ministryIds: action.ministryIds, setlist: [], special: true })
      return {}
    }
    case 'saveMember':
      if (!isAdmin) throw deny()
      return { memberId: saveMember(d, action.member, me.id) }
    case 'setMemberRoles': {
      // o líder ajusta as funções de quem já é do ministério dele (a coordenação, de qualquer ministério)
      manage(action.ministryId)
      const ministry = d.ministries.find((x) => x.id === action.ministryId) ?? (() => { throw notFound() })()
      const member = d.members.find((x) => x.id === action.memberId) ?? (() => { throw notFound() })()
      const mm = member.ministries.find((x) => x.ministryId === ministry.id)
      if (!mm) throw new ActionError(`${member.name.split(' ')[0]} não é do ${ministry.name}.`)
      const wanted = new Set(action.roles)
      const roles = ministry.roles.map((r) => r.name).filter((r) => wanted.has(r))
      // no Carisma o líder é o Secretário: a função de liderança não sai por aqui
      const leaderRole = LEADER_ROLES[ministry.id]
      if (leaderRole && ministry.leaderIds.includes(member.id) && !roles.includes(leaderRole)) roles.unshift(leaderRole)
      mm.roles = roles
      pruneGroups(d)
      return {}
    }
    case 'createTeamSession': {
      const cfg = TEAM_SESSIONS.find((s) => s.id === action.sessionId) ?? (() => { throw notFound() })()
      manage(cfg.ministryId)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.date)) throw new ActionError('Escolha o dia.')
      if (!/^\d{2}:\d{2}$/.test(action.time)) throw new ActionError('Escolha o horário.')
      const note = action.note?.trim().slice(0, 200)
      const ev: ChurchEvent = {
        id: uid(), title: cfg.title, date: action.date, time: action.time, ministryIds: [cfg.ministryId], setlist: [],
        activity: note ? `${cfg.activity} · ${note}` : cfg.activity, place: action.place?.trim().slice(0, 80) || undefined,
      }
      // convida a equipe (menos quem marcou indisponibilidade nesse dia/horário); cada pessoa uma vez, na sua função
      const invited = d.members.filter((m) => sessionRole(cfg, m) && !isOff(d, m, ev))
      ev.slots = cfg.roles.map((role) => ({ ministryId: cfg.ministryId, role, count: Math.max(1, invited.filter((m) => sessionRole(cfg, m) === role).length) }))
      d.events.push(ev)
      d.events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      for (const m of invited) d.assignments.push({ id: uid(), eventId: ev.id, ministryId: cfg.ministryId, role: sessionRole(cfg, m)!, memberId: m.id, status: 'pending' })
      return { created: invited.length }
    }
    case 'addMinistryEvent': {
      const e = action.event
      manage(e.ministryId)
      const ministry = d.ministries.find((m) => m.id === e.ministryId) ?? (() => { throw notFound() })()
      const title = e.title.trim().replace(/\s+/g, ' ').slice(0, 120)
      if (!title) throw new ActionError('Dê um nome para o evento.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new ActionError('Escolha o dia.')
      if (e.time && !/^\d{2}:\d{2}$/.test(e.time)) throw new ActionError('Horário inválido.')
      const endTime = e.endTime && /^\d{2}:\d{2}$/.test(e.endTime) && e.endTime > e.time ? e.endTime : undefined
      const slots = e.slots
        .filter((s) => ministry.roles.some((r) => r.name === s.role))
        .map((s) => ({ ministryId: ministry.id, role: s.role, count: Math.max(0, Math.min(50, Math.round(s.count))) }))
        .filter((s) => s.count > 0)
      if (!slots.length) throw new ActionError('Diga quantas pessoas o evento precisa.')
      const kind = e.kind === 'Externo' || e.kind === 'Interno' ? e.kind : undefined
      d.events.push({
        id: uid(), title, date: e.date, time: e.time, ...(endTime ? { endTime } : {}), ministryIds: [ministry.id], setlist: [],
        special: true, place: e.place?.trim().slice(0, 80) || undefined, activity: kind ? `Evento ${kind.toLowerCase()}` : undefined, slots,
      })
      d.events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      return {}
    }
    case 'editEvent': {
      const ev = findEv(action.eventId)
      const p = action.patch
      if (!isAdmin && !(ev.slots && ev.ministryIds.every((id) => canManage(me, id, d)))) throw deny()
      const title = String(p.title ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
      if (!title) throw new ActionError('Dê um nome para o evento.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new ActionError('Escolha o dia.')
      if (p.time && !/^\d{2}:\d{2}$/.test(p.time)) throw new ActionError('Horário inválido.')
      // culto fixo ajustado à mão: a agenda fixa não sobrescreve mais este dia
      if (ev.slotId) {
        if (p.date !== ev.date) {
          d.skipped = [...new Set([...(d.skipped ?? []), `${ev.slotId}|${ev.date}`])]
          delete ev.slotId
        }
        ev.edited = true
      }
      ev.title = title
      ev.date = p.date
      ev.time = p.time ?? ''
      const endTime = p.endTime && /^\d{2}:\d{2}$/.test(p.endTime) && (!ev.time || p.endTime > ev.time) ? p.endTime : undefined
      if (endTime) ev.endTime = endTime; else delete ev.endTime
      const place = p.place?.trim().slice(0, 80)
      if (place) ev.place = place; else delete ev.place
      const activity = p.activity?.trim().slice(0, 80)
      if (activity) ev.activity = activity; else delete ev.activity
      if (p.ministryIds && isAdmin && !ev.slots) {
        const next = [...new Set(p.ministryIds)].filter((id) => d.ministries.some((m) => m.id === id))
        const removed = ev.ministryIds.filter((id) => !next.includes(id))
        if (removed.length) {
          const gone = new Set(d.assignments.filter((a) => a.eventId === ev.id && removed.includes(a.ministryId)).map((a) => a.id))
          d.assignments = d.assignments.filter((a) => !gone.has(a.id))
          d.swaps = d.swaps.filter((s) => !gone.has(s.assignmentId))
        }
        ev.ministryIds = next
      }
      if (p.slots && ev.slots) {
        const slots = p.slots
          .filter((x) => ev.ministryIds.includes(x.ministryId) && d.ministries.find((m) => m.id === x.ministryId)?.roles.some((r) => r.name === x.role))
          .map((x) => ({ ministryId: x.ministryId, role: x.role, count: Math.max(0, Math.min(50, Math.round(x.count))) }))
          .filter((x) => x.count > 0)
        if (!slots.length) throw new ActionError('Diga quantas pessoas o evento precisa.')
        ev.slots = slots
      }
      d.events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      return {}
    }
    case 'saveWeekly': {
      if (!isAdmin) throw deny()
      const slot = cleanSlot(d, action.slot)
      d.weekly ??= []
      const i = d.weekly.findIndex((x) => x.id === slot.id)
      const old = i >= 0 ? d.weekly[i] : undefined
      if (i >= 0) d.weekly[i] = slot
      else d.weekly.push(slot)
      // mudou de dia/horário: quem marcou que não pode nesse culto continua marcado
      const oldKey = old && `${old.day}-${old.time}`
      const newKey = `${slot.day}-${slot.time}`
      if (oldKey && oldKey !== newKey && !d.weekly.some((x) => `${x.day}-${x.time}` === oldKey)) {
        for (const m of d.members) if (m.recurringOff?.includes(oldKey)) m.recurringOff = [...new Set(m.recurringOff.map((k) => (k === oldKey ? newKey : k)))].sort()
      }
      const c = applyWeekly(d, todayISO())
      return { created: c.added, updated: c.updated, removed: c.removed }
    }
    case 'removeWeekly': {
      if (!isAdmin) throw deny()
      if (!d.weekly?.some((x) => x.id === action.slotId)) throw notFound()
      d.weekly = d.weekly.filter((x) => x.id !== action.slotId)
      d.skipped = (d.skipped ?? []).filter((k) => !k.startsWith(`${action.slotId}|`))
      const c = applyWeekly(d, todayISO())
      return { created: c.added, updated: c.updated, removed: c.removed }
    }
    case 'deliverMaterial': {
      const a = findA(action.assignmentId)
      if (a.memberId !== me.id && !canManage(me, a.ministryId, d)) throw deny()
      if (!deliveryLabel(d, a)) throw new ActionError('Essa função não envia material.')
      const link = action.link.trim()
      if (!link) { delete a.delivery; return {} }
      a.delivery = { link: (/^https?:\/\//.test(link) ? link : `https://${link}`).slice(0, 500), at: new Date().toISOString() }
      return {}
    }
    case 'sendSetlist': {
      const ev = findEv(action.eventId)
      if (!canEditSetlist(d, me, ev)) throw deny()
      if (!ev.setlist.length) throw new ActionError('Adicione as músicas antes de avisar a equipe.')
      ev.setlistSentAt = new Date().toISOString()
      return {}
    }
    case 'removeEvent': {
      const ev = findEv(action.eventId)
      // líder só cancela encontros de equipe dos ministérios que lidera; admin cancela qualquer evento
      if (!isAdmin && !(ev.slots && ev.ministryIds.every((id) => canManage(me, id, d)))) throw deny()
      // culto fixo cancelado neste dia: não volta quando a agenda for gerada de novo
      if (ev.slotId) d.skipped = [...new Set([...(d.skipped ?? []), `${ev.slotId}|${ev.date}`])]
      const gone = new Set(d.assignments.filter((a) => a.eventId === ev.id).map((a) => a.id))
      d.assignments = d.assignments.filter((a) => !gone.has(a.id))
      d.swaps = d.swaps.filter((s) => !gone.has(s.assignmentId))
      d.events = d.events.filter((e) => e.id !== ev.id)
      for (const t of d.tasks ?? []) if (t.eventId === ev.id) t.eventId = undefined
      return {}
    }
    case 'saveTask': {
      const t = action.task
      manage(t.ministryId)
      const kind = isRequestKind(t.kind) ? t.kind : undefined
      const news = kind === 'news'
      const what = REQUEST_KINDS[kind ?? 'art'].the
      const title = t.title.trim().slice(0, 120)
      if (!title) throw new ActionError(news ? 'Escolha em qual domingo o vídeo do News vai passar.' : 'Dê um nome ao pedido.')
      // o News passa no domingo (manhã e noite): guarda o dia, não um culto
      const airDate = news && /^\d{4}-\d{2}-\d{2}$/.test(t.airDate ?? '') ? t.airDate : undefined
      if (news && !airDate) throw new ActionError('Escolha em qual domingo o vídeo do News vai passar.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)) throw new ActionError(`Escolha até quando precisa d${what}.`)
      const eventId = !news && t.eventId && d.events.some((e) => e.id === t.eventId) ? t.eventId : undefined
      // o News passa só na projeção; arte, vídeo e fotos vão para a projeção e/ou mídias sociais
      const projection = news || !!t.projection
      const social = !news && !!t.social
      // o que vai para a projeção aparece na escala do culto: precisa saber qual é
      if (projection && !news && !eventId) throw new ActionError('Escolha o culto em que vai para a projeção.')
      const assignee = d.members.find((m) => m.id === t.assigneeId)
      if (!assignee) throw new ActionError('Escolha quem vai ficar responsável.')
      d.tasks ??= []
      const existing = t.id ? d.tasks.find((x) => x.id === t.id) : undefined
      if (t.id && !existing) throw notFound()
      if (existing && existing.ministryId !== t.ministryId) throw deny()
      const data = {
        title, eventId, details: t.details.trim().slice(0, 1500), assigneeId: assignee.id, dueDate: t.dueDate,
        kind, projection: projection || undefined, social: social || undefined, airDate,
      }
      if (existing) {
        Object.assign(existing, data)
        for (const k of ['kind', 'projection', 'social', 'eventId', 'airDate'] as const) if (existing[k] === undefined) delete existing[k]
      } else {
        d.tasks.unshift({ id: uid(), ministryId: t.ministryId, status: 'open', createdBy: me.id, createdAt: new Date().toISOString(), ...data })
      }
      return {}
    }
    case 'removeTask': {
      const task = d.tasks?.find((x) => x.id === action.taskId) ?? (() => { throw notFound() })()
      manage(task.ministryId)
      d.tasks = d.tasks!.filter((x) => x.id !== task.id)
      return {}
    }
    case 'setTaskDone': {
      const task = d.tasks?.find((x) => x.id === action.taskId) ?? (() => { throw notFound() })()
      if (task.assigneeId !== me.id && !canManage(me, task.ministryId, d)) throw deny()
      task.status = action.done ? 'done' : 'open'
      task.doneAt = action.done ? new Date().toISOString() : undefined
      const link = action.link?.trim()
      task.link = action.done && link ? (/^https?:\/\//.test(link) ? link : `https://${link}`).slice(0, 500) : action.done ? task.link : undefined
      return {}
    }
    case 'resetPin': {
      if (!isAdmin) throw deny()
      const m = d.members.find((x) => x.id === action.memberId) ?? (() => { throw notFound() })()
      delete m.pinHash
      m.hasPin = false
      return {}
    }
    case 'setDemo':
      if (!isAdmin) throw deny()
      d.settings = { ...d.settings, demo: action.show }
      return {}
    case 'setOpen':
      if (!isAdmin) throw deny()
      d.settings = { ...d.settings, open: action.open }
      return {}
    case 'removeMember': {
      if (!isAdmin) throw deny()
      if (action.memberId === me.id) throw new ActionError('Você não pode remover a sua própria conta.')
      if (!d.members.some((m) => m.id === action.memberId)) throw notFound()
      removeMember(d, action.memberId)
      return {}
    }
  }
}

function saveMember(d: AppData, input: MemberInput, actorId: string): string {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.split(' ').length < 2) throw new ActionError('Informe o nome completo (nome e sobrenome).')
  if (!isValidPhone(input.phone)) throw new ActionError('Informe um celular válido com DDD.')
  const phone = normalizePhone(input.phone)
  const clash = d.members.find((m) => normalizePhone(m.phone) === phone && m.id !== input.id)
  if (clash) throw new ActionError(`Esse celular já está cadastrado para ${clash.name}.`, 409)

  const valid = input.ministries.filter((mm) => d.ministries.some((m) => m.id === mm.ministryId))
  const existing = input.id ? d.members.find((m) => m.id === input.id) : undefined
  if (input.id && !existing) throw notFound()

  const isLeader = valid.some((mm) => mm.leader)
  const keepAdmin = existing?.access === 'admin' && (input.admin ?? true)
  if (existing?.id === actorId && !keepAdmin) throw new ActionError('Você não pode tirar o seu próprio acesso de administrador.')
  const access: Member['access'] = keepAdmin || input.admin ? 'admin' : isLeader ? 'leader' : 'volunteer'

  const member: Member = existing ?? { id: uid(), name, phone, access, ministries: [], maxPerMonth: 4 }
  member.name = name
  member.phone = phone
  member.access = access
  member.ministries = valid.map((mm) => {
    const ministry = d.ministries.find((m) => m.id === mm.ministryId)!
    const roles = mm.roles.filter((r) => ministry.roles.some((x) => x.name === r))
    // no Carisma o líder é o Secretário
    const leaderRole = LEADER_ROLES[mm.ministryId]
    if (mm.leader && leaderRole && !roles.includes(leaderRole)) roles.unshift(leaderRole)
    return { ministryId: mm.ministryId, roles }
  })
  if (!existing) d.members.push(member)

  // liderança: atualiza a lista de líderes de cada ministério
  for (const m of d.ministries) {
    const leads = valid.some((mm) => mm.ministryId === m.id && mm.leader)
    const has = m.leaderIds.includes(member.id)
    if (leads && !has) m.leaderIds.push(member.id)
    if (!leads && has) m.leaderIds = m.leaderIds.filter((x) => x !== member.id)
  }
  pruneGroups(d)
  return member.id
}

/** Quem pode entrar nos grupos de um ministério (tem alguma função de grupo, ex.: Voz) */
export function groupPeople(d: AppData, ministryId: string): Member[] {
  const roles = new Set(d.ministries.find((m) => m.id === ministryId)?.roles.filter((r) => r.group).map((r) => r.name))
  return d.members.filter((m) => m.ministries.some((mm) => mm.ministryId === ministryId && mm.roles.some((r) => roles.has(r))))
}

/** Tira dos grupos quem saiu do ministério ou da função */
function pruneGroups(d: AppData) {
  for (const m of d.ministries) {
    if (!m.groups?.length) continue
    const allowed = new Set(groupPeople(d, m.id).map((x) => x.id))
    for (const g of m.groups) g.memberIds = g.memberIds.filter((id) => allowed.has(id))
  }
}

function removeMember(d: AppData, memberId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const futureEvents = new Set(d.events.filter((e) => e.date >= today).map((e) => e.id))
  const dropped = new Set(d.assignments.filter((a) => a.memberId === memberId && futureEvents.has(a.eventId)).map((a) => a.id))
  d.assignments = d.assignments.filter((a) => !dropped.has(a.id))
  d.swaps = d.swaps.filter((s) => !dropped.has(s.assignmentId) && s.fromMemberId !== memberId)
  d.members = d.members.filter((m) => m.id !== memberId)
  for (const m of d.ministries) m.leaderIds = m.leaderIds.filter((x) => x !== memberId)
  delete d.unavailability[memberId]
  pruneGroups(d)
}

export interface SelfSignup {
  ministryId: string
  name: string
  phone: string
  roles: string[]
  interests?: string[]
}

/**
 * Cadastro pelo formulário público. Nunca altera quem já existe
 * (assim ninguém consegue mudar o nome — e as iniciais — de outra pessoa).
 */
export function selfRegister(d: AppData, input: SelfSignup): { status: 'created' | 'exists'; memberId: string } {
  const ministry = d.ministries.find((m) => m.id === input.ministryId)
  if (!ministry) throw new ActionError('Ministério não encontrado.', 404)
  const name = tidyName(input.name).slice(0, 80)
  if (name.split(' ').length < 2) throw new ActionError('Informe o nome completo (nome e sobrenome).')
  if (!isValidPhone(input.phone)) throw new ActionError('Informe um celular válido com DDD.')
  const roles = [...new Set(input.roles)].filter((r) => ministry.roles.some((x) => x.name === r))
  if (!roles.length) throw new ActionError('Selecione pelo menos uma equipe.')
  const interests = [...new Set(input.interests ?? [])].filter((r) => !roles.includes(r) && ministry.roles.some((x) => x.name === r))
  const phone = normalizePhone(input.phone)
  const existing = d.members.find((m) => normalizePhone(m.phone) === phone)
  if (existing) return { status: 'exists', memberId: existing.id }
  const member: Member = {
    id: uid(), name, phone, access: 'volunteer', maxPerMonth: 4,
    ministries: [{ ministryId: ministry.id, roles }], source: 'form', createdAt: new Date().toISOString(),
    ...(interests.length ? { interests: [{ ministryId: ministry.id, roles: interests }] } : {}),
  }
  d.members.push(member)
  return { status: 'created', memberId: member.id }
}

/** Confere e arruma um culto fixo vindo do app */
function cleanSlot(d: AppData, s: WeeklySlot): WeeklySlot {
  const title = String(s.title ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (!title) throw new ActionError('Dê um nome para o culto.')
  const day = Math.round(Number(s.day))
  if (!(day >= 0 && day <= 6)) throw new ActionError('Escolha o dia da semana.')
  if (!/^\d{2}:\d{2}$/.test(s.time ?? '')) throw new ActionError('Escolha o horário.')
  const endTime = s.endTime && /^\d{2}:\d{2}$/.test(s.endTime) && s.endTime > s.time ? s.endTime : undefined
  const weeks = [...new Set((s.weeks ?? []).map(Number))].filter((w) => w >= 1 && w <= 5).sort()
  const months = [...new Set((s.months ?? []).map(Number))].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b)
  let biweekly: string | undefined
  if (s.biweekly) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.biweekly)) throw new ActionError('Escolha uma data em que o culto acontece.')
    const [y, m, dd] = s.biweekly.split('-').map(Number)
    if (new Date(y, m - 1, dd).getDay() !== day) throw new ActionError('A data de referência precisa cair no mesmo dia da semana.')
    biweekly = s.biweekly
  }
  const opt = (v?: string, max = 80) => v?.trim().slice(0, max) || undefined
  const slot: WeeklySlot = {
    id: s.id && /^[\w-]{1,40}$/.test(s.id) ? s.id : `w-${uid()}`,
    day, time: s.time, title,
    ministryIds: [...new Set(s.ministryIds ?? [])].filter((id) => d.ministries.some((m) => m.id === id)),
  }
  if (endTime) slot.endTime = endTime
  for (const [k, v] of [['place', opt(s.place)], ['activity', opt(s.activity)], ['responsible', opt(s.responsible)]] as const) if (v) slot[k] = v
  if (biweekly) slot.biweekly = biweekly
  else if (weeks.length && weeks.length < 5) slot.weeks = weeks
  if (months.length && months.length < 12) slot.months = months
  return slot
}

function cleanSong(song: Omit<Song, 'id'>): Omit<Song, 'id'> {
  const title = String(song.title ?? '').trim().slice(0, 100)
  if (!title) throw new ActionError('Informe o nome da música.')
  const link = String(song.link ?? '').trim()
  return {
    title,
    artist: String(song.artist ?? '').trim().slice(0, 80),
    key: String(song.key ?? '').trim().slice(0, 8) || '—',
    ...(link ? { link: (/^https?:\/\//.test(link) ? link : `https://${link}`).slice(0, 500) } : {}),
  }
}
