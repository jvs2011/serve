/*
 * Regras do servidor do Serve: dados reais, login (celular + iniciais) e alterações.
 * As rotas em /api chamam `route()` através de server/http.ts.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { AppData, Member } from '../src/data/types.js'
import { ActionError, applyAction, type Action } from '../src/data/actions.js'
import { buildAgenda, ministryList } from '../src/data/seed.js'
import { addDays, fromISO, toISO } from '../src/lib/dates.js'
import { decoyInitials, initialsOf, isValidPhone, normalizePhone, seededRandom } from '../src/lib/people.js'
import { canManage } from '../src/lib/schedule.js'
import { getStore, storageSecret, type Store } from './storage.js'
import { addSub, isValidSub, removeSub, sendPush, vapidKeys } from './push.js'
import { notificationsFor, remindersFor, type Outgoing } from './notify.js'

const LIVE_VERSION = 1
const SESSION_TTL = 180 * 24 * 3600 // 180 dias
const CHALLENGE_TTL = 5 * 60
const MAX_FAILS = 5
const LOCK_TTL = 15 * 60

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

  // agenda fixa: gera o que falta até 10 semanas à frente (ids estáveis, sem duplicar)
  const today = brToday()
  const until = toISO(addDays(fromISO(today), 70))
  const from = d.generatedUntil ? toISO(addDays(fromISO(d.generatedUntil), 1)) : toISO(addDays(fromISO(today), -7))
  if (from <= until) {
    const ids = new Set(d.events.map((e) => e.id))
    for (const e of buildAgenda(from, until)) if (!ids.has(e.id)) d.events.push(e)
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
  return changed
}

/** Lê os dados, aplica `fn` e grava com controle de versão (tenta de novo se outra pessoa gravou antes) */
async function withData<T>(store: Store, fn?: (d: AppData) => T): Promise<{ data: AppData; result?: T }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { doc, version } = await store.getDoc()
    const data: AppData = doc ? JSON.parse(doc) : emptyData()
    let changed = prepare(data) || !doc
    let result: T | undefined
    if (fn) { result = fn(data); changed = true }
    if (!changed) return { data, result }
    if (await store.casDoc(version, JSON.stringify(data))) return { data, result }
  }
  throw new Error('Muitas alterações ao mesmo tempo. Tente de novo.')
}

/** O que cada pessoa recebe: telefones só para admin, líderes do mesmo ministério e a própria pessoa */
function viewFor(d: AppData, meId: string): AppData {
  const me = d.members.find((m) => m.id === meId)
  if (!me) return d
  const led = new Set(d.ministries.filter((m) => canManage(me, m.id, d)).map((m) => m.id))
  return {
    ...d,
    members: d.members.map((m) =>
      me.access === 'admin' || m.id === me.id || m.ministries.some((mm) => led.has(mm.ministryId)) ? m : { ...m, phone: '' },
    ),
  }
}

/** Envia as notificações sem deixar a resposta esperar mais que alguns segundos */
async function deliver(store: Store, list: Outgoing[]) {
  if (!list.length) return
  const work = Promise.allSettled(list.map((o) => sendPush(store, o.to, o.payload)))
  await Promise.race([work, new Promise((r) => setTimeout(r, 8000))])
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

function optionsFor(phone: string, member: Member | undefined): { correct: string; options: string[] } {
  const seed = createHmac('sha256', storageSecret()).update(phone).digest().readUInt32BE(0)
  const rand = seededRandom(seed)
  // celular sem cadastro recebe opções falsas fixas (não revela quem está cadastrado)
  const correct = member ? initialsOf(member.name) : decoyInitials('', 1, rand)[0]
  const options = [correct, ...decoyInitials(correct, 5, rand)]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return { correct, options }
}

async function sessionMember(store: Store, auth: string | undefined): Promise<string | null> {
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  return store.get(`serve:sess:${sha(token)}`)
}

export async function route(name: string, method: string, body: any, auth: string | undefined): Promise<Reply> {
  const store = getStore()
  if (name === 'status') return ok({ configured: !!store })
  if (!store) return fail(503, 'O servidor do Serve ainda não foi configurado.')

  try {
    switch (name) {
      case 'login': {
        if (method !== 'POST') return fail(405, 'Método não permitido')
        if (!isValidPhone(String(body?.phone ?? ''))) return fail(400, 'Informe um celular válido com DDD.')
        const phone = normalizePhone(body.phone)
        if (Number(await store.get(`serve:fail:${phone}`)) >= MAX_FAILS) {
          return fail(429, 'Muitas tentativas erradas. Tente de novo em 15 minutos.')
        }
        const { data } = await withData(store)
        const member = data.members.find((m) => normalizePhone(m.phone) === phone)
        const { correct, options } = optionsFor(phone, member)
        const challengeId = randomBytes(16).toString('hex')
        await store.set(`serve:ch:${challengeId}`, JSON.stringify({ phone, memberId: member?.id ?? null, answer: correct }), CHALLENGE_TTL)
        return ok({ challengeId, options })
      }

      case 'verify': {
        if (method !== 'POST') return fail(405, 'Método não permitido')
        const key = `serve:ch:${String(body?.challengeId ?? '')}`
        const raw = await store.get(key)
        if (!raw) return fail(400, 'O tempo para escolher acabou. Digite o celular de novo.')
        await store.del(key) // cada desafio vale uma tentativa só
        const ch = JSON.parse(raw) as { phone: string; memberId: string | null; answer: string }
        if (Number(await store.get(`serve:fail:${ch.phone}`)) >= MAX_FAILS) {
          return fail(429, 'Muitas tentativas erradas. Tente de novo em 15 minutos.')
        }
        if (!ch.memberId || String(body?.answer ?? '') !== ch.answer) {
          const n = await store.incr(`serve:fail:${ch.phone}`, LOCK_TTL)
          const left = MAX_FAILS - n
          return fail(401, left > 0
            ? `Essas não são as suas iniciais. Você tem mais ${left} ${left === 1 ? 'tentativa' : 'tentativas'}. Se ainda não tem cadastro, fale com a liderança.`
            : 'Muitas tentativas erradas. Tente de novo em 15 minutos.')
        }
        const token = randomBytes(32).toString('hex')
        await store.set(`serve:sess:${sha(token)}`, ch.memberId, SESSION_TTL)
        await store.del(`serve:fail:${ch.phone}`)
        return ok({ token })
      }

      case 'logout': {
        const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
        if (token) await store.del(`serve:sess:${sha(token)}`)
        return ok({ ok: true })
      }

      case 'data': {
        const meId = await sessionMember(store, auth)
        if (!meId) return fail(401, 'Sua sessão expirou. Entre novamente.')
        const { data } = await withData(store)
        if (!data.members.some((m) => m.id === meId)) return fail(401, 'Sua conta não foi encontrada. Fale com a liderança.')
        return ok({ data: viewFor(data, meId), meId })
      }

      case 'action': {
        if (method !== 'POST') return fail(405, 'Método não permitido')
        const meId = await sessionMember(store, auth)
        if (!meId) return fail(401, 'Sua sessão expirou. Entre novamente.')
        const action = body?.action as Action
        if (!action?.type) return fail(400, 'Pedido inválido.')
        let before: AppData | null = null
        const { data, result } = await withData(store, (d) => {
          before = structuredClone(d)
          return applyAction(d, action, meId)
        })
        if (before) {
          try { await deliver(store, notificationsFor(before, data, meId, brToday())) } catch (e) { console.error('notificações', e) }
        }
        return ok({ data: viewFor(data, meId), meId, result })
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
          const sent = await sendPush(store, [meId], { title: 'Serve 🔔', body: 'Tudo certo! Você vai receber os avisos das suas escalas aqui.', tag: 'teste' })
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
        const tomorrow = toISO(addDays(fromISO(brToday()), 1))
        if (!(await store.setNX(`serve:reminded:${tomorrow}`, '1', 3 * 24 * 3600))) return ok({ skipped: true, tomorrow })
        const { data } = await withData(store)
        const list = remindersFor(data, tomorrow)
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
