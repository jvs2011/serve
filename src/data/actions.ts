/*
 * Todas as alterações de dados do Serve passam por aqui.
 * O mesmo código roda no celular (demonstração) e no servidor (dados reais),
 * e o servidor confere as permissões de quem está pedindo a alteração.
 */
import type { AppData, AssignmentStatus, Member, Song } from './types.js'
import { autoFill, canManage, uid } from '../lib/schedule.js'
import { isValidPhone, normalizePhone, tidyName } from '../lib/people.js'

export interface MemberInput {
  id?: string
  name: string
  phone: string
  admin?: boolean
  ministries: { ministryId: string; roles: string[]; leader: boolean }[]
}

export type Action =
  | { type: 'respond'; assignmentId: string; status: AssignmentStatus }
  | { type: 'checkIn'; assignmentId: string }
  | { type: 'feedback'; assignmentId: string; rating: number; comment: string }
  | { type: 'toggleUnavailable'; date: string }
  | { type: 'setMaxPerMonth'; n: number }
  | { type: 'requestSwap'; assignmentId: string; reason: string }
  | { type: 'cancelSwap'; swapId: string }
  | { type: 'acceptSwap'; swapId: string }
  | { type: 'assign'; eventId: string; ministryId: string; role: string; memberId: string }
  | { type: 'unassign'; assignmentId: string }
  | { type: 'autoSchedule'; eventIds: string[]; ministryId: string }
  | { type: 'addNotice'; ministryId: string | null; title: string; body: string }
  | { type: 'addSong'; eventId: string; song: Omit<Song, 'id'> }
  | { type: 'removeSong'; eventId: string; songId: string }
  | { type: 'addEvent'; title: string; date: string; time: string; ministryIds: string[] }
  | { type: 'saveMember'; member: MemberInput }
  | { type: 'removeMember'; memberId: string }
  | { type: 'setOpen'; open: boolean }

export interface ActionResult {
  created?: number
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
      d.assignments.push({ id: uid(), eventId: action.eventId, ministryId: action.ministryId, role: action.role, memberId: action.memberId, status: 'pending' })
      return {}
    }
    case 'unassign': {
      const a = findA(action.assignmentId)
      manage(a.ministryId)
      d.assignments = d.assignments.filter((x) => x.id !== a.id)
      d.swaps = d.swaps.filter((s) => s.assignmentId !== a.id)
      return {}
    }
    case 'autoSchedule': {
      manage(action.ministryId)
      let created = 0
      for (const id of action.eventIds) {
        const ev = d.events.find((e) => e.id === id)
        if (!ev || !ev.ministryIds.includes(action.ministryId)) continue
        const add = autoFill(d, id, action.ministryId)
        d.assignments.push(...add)
        created += add.length
      }
      return { created }
    }
    case 'addNotice': {
      if (action.ministryId === null ? !isAdmin : !canManage(me, action.ministryId, d)) throw deny()
      d.notices.unshift({ id: uid(), ministryId: action.ministryId, authorId: me.id, title: action.title.slice(0, 120), body: action.body.slice(0, 2000), createdAt: new Date().toISOString() })
      return {}
    }
    case 'addSong': {
      manage('louvor')
      findEv(action.eventId).setlist.push({ ...action.song, id: uid() })
      return {}
    }
    case 'removeSong': {
      manage('louvor')
      const ev = findEv(action.eventId)
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
    return { ministryId: mm.ministryId, roles: mm.roles.filter((r) => ministry.roles.some((x) => x.name === r)) }
  })
  if (!existing) d.members.push(member)

  // liderança: atualiza a lista de líderes de cada ministério
  for (const m of d.ministries) {
    const leads = valid.some((mm) => mm.ministryId === m.id && mm.leader)
    const has = m.leaderIds.includes(member.id)
    if (leads && !has) m.leaderIds.push(member.id)
    if (!leads && has) m.leaderIds = m.leaderIds.filter((x) => x !== member.id)
  }
  return member.id
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
