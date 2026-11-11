/*
 * Regras do servidor do Serve: dados reais, login (celular + PIN) e alterações.
 * As rotas em /api chamam `route()` através de server/http.ts.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { AppData } from '../src/data/types.js'
import { ActionError, applyAction, selfRegister, type Action } from '../src/data/actions.js'
import { buildAgenda, DATA_VERSION, LEADER_ROLES, ministryList, ROLE_RENAMES } from '../src/data/seed.js'
import { applyWeekly, DEFAULT_WEEKLY, weeklyEvents } from '../src/data/agenda.js'
import { addDays, fromISO, toISO } from '../src/lib/dates.js'
import { isValidPhone, normalizePhone } from '../src/lib/people.js'
import { canManage, visibleTo } from '../src/lib/schedule.js'
import { getStore, type Store } from './storage.js'
import { addSub, isValidSub, removeSub, sendPush, vapidKeys } from './push.js'
import { confirmRemindersFor, deliveryRemindersFor, draftRemindersFor, notificationsFor, openSlotsAlertsFor, remindersFor, taskRemindersFor, type Outgoing } from './notify.js'

const LIVE_VERSION = 1
const SESSION_TTL = 180 * 24 * 3600 // 180 dias

export interface Reply { status: number; body: unknown }
const ok = (body: unknown): Reply => ({ status: 200, body })
const fail = (status: number, error: string): Reply => ({ status, body: { error } })

/** Data de hoje no fuso de Franca/SP */
function brToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function emptyData(): AppData {
  return {
    version: LIVE_VERSION, ministries: ministryList(), members: [], events: [], assignments: [],
    unavailability: {}, swaps: [], notices: [],
  }
}

/**
 * Acompanha mudanças de estrutura feitas no código:
 * - funções renomeadas (ex.: Ministro/Vocal → Voz) nos cadastros, interesses e escalas futuras;
 * - funções que deixaram de existir saem dos cadastros e das escalas futuras;
 * - cultos fixos futuros seguem a agenda fixa.
 */
function syncStructure(d: AppData, today: string) {
  // uma função pode virar outra, várias (ex.: Lagoinha News → Filmmaker e Apresentação) ou nenhuma
  const renameAll = (mid: string, role: string): string[] => {
    const map = ROLE_RENAMES[mid]
    if (!map || !(role in map)) return [role]
    const to = map[role]
    return to === null ? [] : Array.isArray(to) ? to : [to]
  }
  const rename = (mid: string, role: string): string | null => renameAll(mid, role)[0] ?? null
  const fixRoles = (list: { ministryId: string; roles: string[] }[] | undefined) =>
    list?.forEach((mm) => {
      const valid = new Set(d.ministries.find((x) => x.id === mm.ministryId)?.roles.map((r) => r.name) ?? [])
      mm.roles = [...new Set(mm.roles.flatMap((r) => renameAll(mm.ministryId, r)).filter((r) => valid.has(r)))]
    })
  for (const m of d.members) { fixRoles(m.ministries); fixRoles(m.interests) }
  // culto fixo que mudou de horário: a indisponibilidade marcada acompanha (Rocket 19h → 19h30)
  const KEY_MOVES: Record<string, string> = { '6-19:00': '6-19:30' }
  for (const m of d.members) {
    if (m.recurringOff?.some((k) => k in KEY_MOVES)) m.recurringOff = [...new Set(m.recurringOff.map((k) => KEY_MOVES[k] ?? k))].sort()
  }

  // função de liderança: no Carisma o líder é o Secretário
  for (const [mid, role] of Object.entries(LEADER_ROLES)) {
    for (const id of d.ministries.find((x) => x.id === mid)?.leaderIds ?? []) {
      const mm = d.members.find((m) => m.id === id)?.ministries.find((x) => x.ministryId === mid)
      if (mm && !mm.roles.includes(role)) mm.roles.unshift(role)
    }
  }

  // cultos fixos futuros seguem a agenda fixa (editada pela coordenação)
  if (d.weekly) applyWeekly(d, today)
  const events = new Map(d.events.map((e) => [e.id, e]))

  // vagas próprias de eventos futuros (ex.: gravação do News) acompanham a função renomeada
  for (const ev of d.events) {
    if (!ev.slots || ev.date < today) continue
    const merged = new Map<string, { ministryId: string; role: string; count: number }>()
    for (const s of ev.slots) {
      const role = rename(s.ministryId, s.role)
      if (!role) continue
      const k = `${s.ministryId}|${role}`
      merged.set(k, { ministryId: s.ministryId, role, count: Math.max(s.count, merged.get(k)?.count ?? 0) })
    }
    ev.slots = [...merged.values()]
  }

  // escalas futuras: renomeia a função ou tira a escala que não cabe mais.
  // Nas que já passaram, só troca o nome (ex.: Vídeo → Filmmaker), para o material e o histórico continuarem certos
  const gone = new Set<string>()
  const seen = new Set<string>()
  for (const a of d.assignments) {
    const ev = events.get(a.eventId)
    if (!ev) continue
    if (ev.date < today) {
      const to = ROLE_RENAMES[a.ministryId]?.[a.role]
      if (typeof to === 'string') a.role = to
      continue
    }
    const role = rename(a.ministryId, a.role)
    const custom = ev.slots?.some((s) => s.ministryId === a.ministryId && s.role === role)
    const exists = custom || !!d.ministries.find((x) => x.id === a.ministryId)?.roles.some((r) => r.name === role)
    // duas funções que viraram uma só (ex.: Portão e Ronda → Estacionamento) não duplicam a pessoa
    const key = `${a.eventId}|${a.ministryId}|${role}|${a.memberId}`
    if (!role || !exists || !ev.ministryIds.includes(a.ministryId) || seen.has(key)) gone.add(a.id)
    else { a.role = role; seen.add(key) }
  }
  if (gone.size) {
    d.assignments = d.assignments.filter((a) => !gone.has(a.id))
    d.swaps = d.swaps.filter((s) => !gone.has(s.assignmentId))
  }
}

/** Garante administrador, agenda gerada para as próximas semanas e limpeza de dados antigos */
function prepare(d: AppData): boolean {
  let changed = false

  // administrador inicial, definido nas variáveis ADMIN_PHONE e ADMIN_NAME da Vercel
  const adminPhone = normalizePhone(process.env.ADMIN_PHONE ?? '')
  const adminName = (process.env.ADMIN_NAME ?? '').trim()
  if (adminPhone && !d.members.some((m) => m.access === 'admin')) {
    const existing = d.members.find((m) => normalizePhone(m.phone) === adminPhone)
    if (existing) existing.access = 'admin'
    else d.members.push({ id: 'admin', name: adminName || 'Administrador', phone: adminPhone, access: 'admin', ministries: [], maxPerMonth: 4 })
    changed = true
  }

  // ministérios: nome, descrição, cor e ícone seguem o código (funções e líderes ficam como estão)
  for (const base of ministryList()) {
    const m = d.ministries.find((x) => x.id === base.id)
    if (!m) { d.ministries.push(base); changed = true; continue }
    for (const k of ['name', 'description', 'color', 'icon'] as const) {
      if (m[k] !== base[k]) { m[k] = base[k]; changed = true }
    }
    // funções seguem o código: ordem, vagas, grupo e complemento (as removidas do código saem)
    const roles = base.roles.map((r) => ({ ...r }))
    if (JSON.stringify(roles) !== JSON.stringify(m.roles)) { m.roles = roles; changed = true }
  }

  // mudanças de estrutura do código (funções renomeadas, ministérios fora dos cultos): roda uma vez por versão
  if (d.codeVersion !== DATA_VERSION) {
    syncStructure(d, brToday())
    d.codeVersion = DATA_VERSION
    changed = true
  }

  // agenda fixa nos dados: na primeira vez, a do código; os eventos já gerados ganham o culto de origem
  const today = brToday()
  if (!d.weekly) {
    d.weekly = structuredClone(DEFAULT_WEEKLY)
    const first = d.events.reduce((m, e) => (e.date < m ? e.date : m), today)
    const origin = new Map(weeklyEvents(d.weekly, first, d.generatedUntil ?? today).map((e) => [e.id, e.slotId]))
    for (const e of d.events) if (!e.slotId && origin.has(e.id)) e.slotId = origin.get(e.id)
    changed = true
  }

  // agenda fixa: gera o que falta até 10 semanas à frente (sem duplicar nem trazer de volta dias cancelados)
  const until = toISO(addDays(fromISO(today), 70))
  const from = d.generatedUntil ? toISO(addDays(fromISO(d.generatedUntil), 1)) : toISO(addDays(fromISO(today), -7))
  if (from <= until) {
    const ids = new Set(d.events.map((e) => e.id))
    const keys = new Set([...d.events.filter((e) => e.slotId).map((e) => `${e.slotId}|${e.date}`), ...(d.skipped ?? [])])
    for (const e of buildAgenda(from, until, d.weekly)) {
      if (!ids.has(e.id) && !(e.slotId && keys.has(`${e.slotId}|${e.date}`))) d.events.push(e)
    }
    d.events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    d.generatedUntil = until
    changed = true
  }

  // limpeza: eventos com mais de 6 meses
  const cutoff = toISO(addDays(fromISO(today), -180))
  const old = new Set(d.events.filter((e) => (e.endDate ?? e.date) < cutoff).map((e) => e.id))
  if (old.size) {
    d.events = d.events.filter((e) => !old.has(e.id))
    const gone = new Set(d.assignments.filter((a) => old.has(a.eventId)).map((a) => a.id))
    d.assignments = d.assignments.filter((a) => !gone.has(a.id))
    d.swaps = d.swaps.filter((s) => !gone.has(s.assignmentId))
    changed = true
  }
  const oldDone = (d.tasks ?? []).filter((t) => t.status === 'done' && t.dueDate < cutoff)
  if (oldDone.length) { d.tasks = d.tasks!.filter((t) => !oldDone.includes(t)); changed = true }
  return changed
}

/** Lê os dados, aplica `fn` e grava com controle de versão (tenta de novo se outra pessoa gravou antes) */
async function withData<T>(store: Store, fn?: (d: AppData) => T): Promise<{ data: AppData; result?: T; version: number }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { doc, version } = await store.getDoc()
    const data: AppData = doc ? JSON.parse(doc) : emptyData()
    let changed = prepare(data) || !doc
    let result: T | undefined
    if (fn) { result = fn(data); changed = true }
    if (!changed) return { data, result, version }
    if (await store.casDoc(version, JSON.stringify(data))) return { data, result, version: version + 1 }
  }
  throw new Error('Muitas alterações ao mesmo tempo. Tente de novo.')
}

/** O que cada pessoa recebe: telefones só para admin, líderes do mesmo ministério e a própria pessoa */
function viewFor(full: AppData, meId: string): AppData {
  const me = full.members.find((m) => m.id === meId)
  if (!me) return full
  const d = visibleTo(full, meId)
  const led = new Set(d.ministries.filter((m) => canManage(me, m.id, d)).map((m) => m.id))
  const inMinistry = new Set(me.ministries.map((mm) => mm.ministryId))
  return {
    ...d,
    tasks: (d.tasks ?? []).filter((t) => me.access === 'admin' || t.assigneeId === me.id || led.has(t.ministryId) || inMinistry.has(t.ministryId)),
    members: d.members.map(({ pinHash, ...m }) => {
      const view = { ...m, hasPin: !!pinHash }
      return me.access === 'admin' || m.id === me.id || m.ministries.some((mm) => led.has(mm.ministryId)) ? view : { ...view, phone: '' }
    }),
  }
}

/** Envia as notificações sem deixar a resposta esperar mais que alguns segundos */
async function deliver(store: Store, list: Outgoing[]): Promise<number | undefined> {
  if (!list.length) return 0
  const work = Promise.allSettled(list.map((o) => sendPush(store, o.to, o.payload)))
    .then((rs) => rs.reduce((n, r) => n + (r.status === 'fulfilled' ? r.value : 0), 0))
  // devolve quantos celulares receberam (ou nada, se demorou mais que 8 s)
  return Promise.race([work, new Promise<undefined>((r) => setTimeout(() => r(undefined), 8000))])
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')


/* ---------- PIN (4 dígitos) ---------- */
const PIN_MAX = 10 // tentativas de PIN por dia
const DAY = 24 * 3600
const WEAK = new Set(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'])

function pinProblem(pin: unknown): string | null {
  const p = String(pin ?? '')
  if (!/^\d{4}$/.test(p)) return 'O PIN precisa ter 4 números.'
  if (/^(\d)\1{3}$/.test(p) || WEAK.has(p)) return 'Esse PIN é fácil demais de adivinhar. Escolha outro.'
  return null
}
function hashPin(pin: string): string {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${scryptSync(pin, salt, 32).toString('hex')}`
}
function checkPin(pin: string, stored: string | undefined): boolean {
  const [kind, salt, hash] = (stored ?? '').split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const got = scryptSync(String(pin), Buffer.from(salt, 'hex'), 32)
  const want = Buffer.from(hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}
async function newSession(store: Store, memberId: string) {
  const token = randomBytes(32).toString('hex')
  await store.set(`serve:sess:${sha(token)}`, memberId, SESSION_TTL)
  return token
}

const CLOSED_MSG = 'O Serve ainda não foi liberado. Em breve teremos novidades! 😉'
/** Enquanto o app não for liberado (Perfil → Acesso ao app), só administradores entram */
const allowed = (d: AppData, memberId: string) =>
  d.settings?.open === true || d.members.find((m) => m.id === memberId)?.access === 'admin'

async function sessionMember(store: Store, auth: string | undefined): Promise<string | null> {
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  return store.get(`serve:sess:${sha(token)}`)
}

export async function route(name: string, method: string, body: any, auth: string | undefined, ip = 'unknown', query: Record<string, string> = {}): Promise<Reply> {
  const store = getStore()
  if (name === 'status') {
    if (!store) return ok({ configured: false, demo: true })
    // a tela de entrada mostra a demonstração até o administrador esconder
    const { doc } = await store.getDoc()
    const settings = doc ? (JSON.parse(doc) as AppData).settings : undefined
    return ok({ configured: true, demo: settings?.demo !== false })
  }
  if (!store) return fail(503, 'O servidor do Serve ainda não foi configurado.')

  try {
    switch (name) {
      case 'login': {
        // celular → quem já tem PIN digita o PIN; no primeiro acesso, cria o PIN
        if (method !== 'POST') return fail(405, 'Método não permitido')
        if (!isValidPhone(String(body?.phone ?? ''))) return fail(400, 'Informe um celular válido com DDD.')
        const phone = normalizePhone(body.phone)
        const { data } = await withData(store)
        const member = data.members.find((m) => normalizePhone(m.phone) === phone)
        if (!member) return fail(404, 'Não encontramos esse celular. Se você ainda não tem cadastro, fale com a liderança.')
        if (member.pinHash) return ok({ mode: 'pin' })
        if (!allowed(data, member.id)) {
          return { status: 403, body: { error: CLOSED_MSG, closed: true, firstName: '' } }
        }
        const setupId = randomBytes(16).toString('hex')
        await store.set(`serve:setup:${setupId}`, member.id, 15 * 60)
        return ok({ mode: 'create', setupId })
      }

      case 'pin-create': {
        // cria o PIN no primeiro acesso (depois das iniciais) e já entra
        if (method !== 'POST') return fail(405, 'Método não permitido')
        const memberId = await store.get(`serve:setup:${String(body?.setupId ?? '')}`)
        if (!memberId) return fail(400, 'O tempo para criar o PIN acabou. Comece de novo pelo celular.')
        const problem = pinProblem(body?.pin)
        if (problem) return fail(400, problem)
        let already = false
        await withData(store, (d) => {
          const m = d.members.find((x) => x.id === memberId)
          if (!m) throw new ActionError('Sua conta não foi encontrada.', 401)
          if (m.pinHash) { already = true; return }
          m.pinHash = hashPin(String(body.pin))
        })
        await store.del(`serve:setup:${String(body.setupId)}`)
        if (already) return fail(409, 'Você já tem um PIN. Entre com ele.')
        return ok({ token: await newSession(store, memberId) })
      }

      case 'pin': {
        // login com celular + PIN
        if (method !== 'POST') return fail(405, 'Método não permitido')
        if (!isValidPhone(String(body?.phone ?? ''))) return fail(400, 'Informe um celular válido com DDD.')
        const phone = normalizePhone(body.phone)
        if (Number(await store.get(`serve:pinfail:${phone}`)) >= PIN_MAX) {
          return fail(429, 'Muitas tentativas erradas hoje. Tente amanhã ou peça para a liderança redefinir seu PIN.')
        }
        const { data } = await withData(store)
        const member = data.members.find((m) => normalizePhone(m.phone) === phone)
        if (!member || !checkPin(String(body?.pin ?? ''), member.pinHash)) {
          const left = PIN_MAX - (await store.incr(`serve:pinfail:${phone}`, DAY))
          return fail(401, left > 0
            ? `PIN incorreto. Você tem mais ${left} ${left === 1 ? 'tentativa' : 'tentativas'} hoje.`
            : 'Muitas tentativas erradas hoje. Tente amanhã ou peça para a liderança redefinir seu PIN.')
        }
        await store.del(`serve:pinfail:${phone}`)
        if (!allowed(data, member.id)) {
          return { status: 403, body: { error: CLOSED_MSG, closed: true, firstName: member.name.split(' ')[0] } }
        }
        return ok({ token: await newSession(store, member.id) })
      }

      case 'pin-set':
      case 'pin-change': {
        // dentro do app: criar o PIN (quem ainda não tem) ou trocar (precisa do PIN atual)
        if (method !== 'POST') return fail(405, 'Método não permitido')
        const meId = await sessionMember(store, auth)
        if (!meId) return fail(401, 'Sua sessão expirou. Entre novamente.')
        const problem = pinProblem(body?.pin)
        if (problem) return fail(400, problem)
        const { data } = await withData(store)
        const me = data.members.find((m) => m.id === meId)
        if (!me) return fail(401, 'Sua conta não foi encontrada.')
        if (name === 'pin-set' && me.pinHash) return fail(409, 'Você já tem um PIN. Use “Alterar PIN”.')
        if (name === 'pin-change') {
          const phone = normalizePhone(me.phone)
          if (Number(await store.get(`serve:pinfail:${phone}`)) >= PIN_MAX) return fail(429, 'Muitas tentativas erradas hoje. Tente amanhã.')
          if (!checkPin(String(body?.current ?? ''), me.pinHash)) {
            await store.incr(`serve:pinfail:${phone}`, DAY)
            return fail(401, 'O PIN atual está incorreto.')
          }
        }
        await withData(store, (d) => { const m = d.members.find((x) => x.id === meId); if (m) m.pinHash = hashPin(String(body.pin)) })
        return ok({ ok: true })
      }

      case 'logout': {
        const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
        if (token) await store.del(`serve:sess:${sha(token)}`)
        return ok({ ok: true })
      }

      case 'data': {
        const meId = await sessionMember(store, auth)
        if (!meId) return fail(401, 'Sua sessão expirou. Entre novamente.')
        // o app pergunta "mudou algo desde a versão X?": se não mudou, responde só isso (bem mais leve)
        const since = Number(query?.since)
        if (since > 0 && (await store.getVersion()) === since) return ok({ unchanged: true, version: since })
        const { data, version } = await withData(store)
        if (!data.members.some((m) => m.id === meId)) return fail(401, 'Sua conta não foi encontrada. Fale com a liderança.')
        if (!allowed(data, meId)) return fail(403, CLOSED_MSG)
        return ok({ data: viewFor(data, meId), meId, version, needsPin: !data.members.find((m) => m.id === meId)?.pinHash })
      }

      case 'action': {
        if (method !== 'POST') return fail(405, 'Método não permitido')
        const meId = await sessionMember(store, auth)
        if (!meId) return fail(401, 'Sua sessão expirou. Entre novamente.')
        const action = body?.action as Action
        if (!action?.type) return fail(400, 'Pedido inválido.')
        if (!allowed((await withData(store)).data, meId)) return fail(403, CLOSED_MSG)
        let before: AppData | null = null
        const { data, result, version } = await withData(store, (d) => {
          before = structuredClone(d)
          return applyAction(d, action, meId)
        })
        let pushed: number | undefined
        if (before) {
          try { pushed = await deliver(store, notificationsFor(before, data, meId, brToday())) } catch (e) { console.error('notificações', e) }
        }
        return ok({ data: viewFor(data, meId), meId, version, result: { ...result, ...(pushed !== undefined ? { pushed } : {}) } })
      }

      case 'signup-info': {
        // público: só o nome, a descrição e as equipes do ministério (nenhum dado pessoal)
        const { data } = await withData(store)
        const m = data.ministries.find((x) => x.id === String(query.m ?? body?.m ?? ''))
        if (!m) return fail(404, 'Formulário não encontrado.')
        return ok({ id: m.id, name: m.name, description: m.description, color: m.color, teams: m.roles.map((r) => r.name) })
      }

      case 'signup': {
        if (method !== 'POST') return fail(405, 'Método não permitido')
        if (body?.website) return ok({ status: 'created' }) // armadilha para robôs: finge sucesso
        if (body?.consent !== true) return fail(400, 'Para continuar, marque a autorização de uso dos dados.')
        const n = await store.incr(`serve:signup-ip:${sha(ip)}`, 3600)
        if (n > 15) return fail(429, 'Muitos cadastros feitos desta conexão. Tente de novo mais tarde.')
        let status: 'created' | 'exists' = 'created'
        await withData(store, (d) => {
          status = selfRegister(d, { ministryId: String(body?.ministryId ?? ''), name: String(body?.name ?? ''), phone: String(body?.phone ?? ''), roles: Array.isArray(body?.roles) ? body.roles.map(String) : [], interests: Array.isArray(body?.interests) ? body.interests.map(String) : [] }).status
        })
        return ok({ status })
      }

      case 'push-key':
        return ok({ publicKey: (await vapidKeys(store)).publicKey })

      case 'push-subscribe':
      case 'push-unsubscribe':
      case 'push-test': {
        if (method !== 'POST') return fail(405, 'Método não permitido')
        const meId = await sessionMember(store, auth)
        if (!meId) return fail(401, 'Sua sessão expirou. Entre novamente.')
        if (name === 'push-test') {
          const sent = await sendPush(store, [meId], { title: 'Notificações ativadas 🔔', body: 'Tudo certo! Você vai receber aqui os avisos das suas escalas.', tag: 'teste' })
          return sent ? ok({ sent }) : fail(404, 'Nenhum aparelho com notificações ativas foi encontrado. Ative de novo e tente outra vez.')
        }
        if (name === 'push-unsubscribe') {
          if (typeof body?.endpoint === 'string') await removeSub(store, meId, body.endpoint)
          return ok({ ok: true })
        }
        if (!isValidSub(body?.subscription)) return fail(400, 'Inscrição de notificação inválida.')
        await addSub(store, meId, body.subscription)
        return ok({ ok: true })
      }

      case 'cron-reminders': {
        // chamado pela Vercel uma vez por dia (vercel.json → crons); se CRON_SECRET existir, é exigido
        const secret = process.env.CRON_SECRET
        if (secret && auth !== `Bearer ${secret}`) return fail(401, 'Não autorizado')
        // backup diário de todos os dados (guardado por 15 dias): serve:backup:AAAA-MM-DD
        const { doc } = await store.getDoc()
        if (doc) await store.set(`serve:backup:${brToday()}`, doc, 15 * 24 * 3600)
        const tomorrow = toISO(addDays(fromISO(brToday()), 1))
        if (!(await store.setNX(`serve:reminded:${tomorrow}`, '1', 3 * 24 * 3600))) return ok({ skipped: true, tomorrow })
        const { data } = await withData(store)
        const in3 = toISO(addDays(fromISO(brToday()), 3))
        const list = [
          ...remindersFor(data, tomorrow), ...taskRemindersFor(data, tomorrow),
          ...draftRemindersFor(data, brToday(), in3),
          ...openSlotsAlertsFor(data, tomorrow, in3),
          ...confirmRemindersFor(data, in3),
          ...deliveryRemindersFor(data, toISO(addDays(fromISO(brToday()), -1))),
        ]
        await deliver(store, list)
        return ok({ tomorrow, people: list.length })
      }
    }
    return fail(404, 'Rota não encontrada')
  } catch (e) {
    if (e instanceof ActionError) return fail(e.status, e.message)
    console.error(e)
    return fail(500, 'Algo deu errado no servidor. Tente de novo em instantes.')
  }
}
