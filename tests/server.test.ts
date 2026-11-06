import { beforeAll, describe, expect, it } from 'vitest'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { addDays, fromISO, toISO, todayISO } from '../src/lib/dates'
import type { AppData } from '../src/data/types'

process.env.SERVE_MEMORY_DB = '1'
process.env.ADMIN_PHONE = '16991234567'
process.env.ADMIN_NAME = 'Admin Teste'

const { route } = await import('../server/app')
const { getStore } = await import('../server/storage')
const notify = await import('../server/notify')

const call = (name: string, body: unknown = null, token?: string, method = 'POST', query: Record<string, string> = {}) =>
  route(name, method, body, token ? `Bearer ${token}` : undefined, 'test', query)

describe('servidor', () => {
  let token = ''
  beforeAll(async () => {
    const r = await call('login', { phone: '(16) 99123-4567' })
    expect(r.body).toMatchObject({ mode: 'create' })
    const setup = (r.body as { setupId: string }).setupId
    expect((await call('pin-create', { setupId: setup, pin: '1234' })).status).toBe(400) // fácil demais
    const ok = await call('pin-create', { setupId: setup, pin: '4826' })
    token = (ok.body as { token: string }).token
    expect(token).toBeTruthy()
  })

  it('entra de novo com o PIN; PIN errado não entra', async () => {
    expect((await call('login', { phone: '16991234567' })).body).toEqual({ mode: 'pin' })
    expect((await call('pin', { phone: '16991234567', pin: '0000' })).status).toBe(401)
    expect((await call('pin', { phone: '16991234567', pin: '4826' })).status).toBe(200)
  })

  it('o app só baixa os dados quando algo mudou', async () => {
    const full = (await call('data', null, token, 'GET')).body as { version: number; data: AppData }
    expect(full.data.weekly?.length).toBeGreaterThan(0)
    const same = await call('data', null, token, 'GET', { since: String(full.version) })
    expect(same.body).toEqual({ unchanged: true, version: full.version })
    const act = (await call('action', { action: { type: 'setDemo', show: false } }, token)).body as { version: number }
    expect(act.version).toBe(full.version + 1)
    const changed = (await call('data', null, token, 'GET', { since: String(full.version) })).body as { data?: AppData }
    expect(changed.data?.settings?.demo).toBe(false)
    expect((await call('status', null, undefined, 'GET')).body).toEqual({ configured: true, demo: false })
  })

  it('sem sessão não acessa os dados', async () => {
    expect((await call('data', null, 'invalido', 'GET')).status).toBe(401)
  })

  it('dados antigos (sem agenda fixa) ganham a agenda e os eventos guardam o culto de origem, sem duplicar', async () => {
    const store = getStore()!
    const { doc, version } = await store.getDoc()
    const d = JSON.parse(doc!) as AppData
    delete d.weekly
    for (const e of d.events) delete e.slotId
    expect(await store.casDoc(version, JSON.stringify(d))).toBe(true)
    const r = (await call('data', null, token, 'GET')).body as { data: AppData }
    const sundays = r.data.events.filter((e) => e.slotId?.startsWith('dom-'))
    expect(sundays.length).toBeGreaterThan(10)
    const keys = r.data.events.filter((e) => e.slotId).map((e) => `${e.slotId}|${e.date}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('notificações', () => {
  const today = todayISO()
  const futureLouvor = (d: AppData) => d.events.find((e) => e.date > today && e.ministryIds.includes('louvor') && e.ministryIds.includes('diaconato'))!

  it('rascunho não avisa; publicar avisa cada pessoa', () => {
    const d = createSeed()
    const ev = futureLouvor(d)
    d.assignments = d.assignments.filter((a) => !(a.eventId === ev.id && a.ministryId === 'louvor'))
    const b1 = structuredClone(d)
    applyAction(d, { type: 'autoSchedule', eventIds: [ev.id], ministryId: 'louvor' }, 'm-mariana')
    expect(notify.notificationsFor(b1, d, 'm-mariana', today)).toHaveLength(0)
    const b2 = structuredClone(d)
    applyAction(d, { type: 'publishDrafts', ministryId: 'louvor', eventId: ev.id }, 'm-mariana')
    const out = notify.notificationsFor(b2, d, 'm-mariana', today)
    expect(out.length).toBeGreaterThan(3)
    expect(out[0].payload.title).toMatch(/escalado/)
  })

  it('mudança de horário e cancelamento avisam quem está escalado', () => {
    const d = createSeed()
    const ev = d.events.find((e) => e.date > today && d.assignments.some((a) => a.eventId === e.id && !a.draft && a.status !== 'declined'))!
    const people = new Set(d.assignments.filter((a) => a.eventId === ev.id && !a.draft && a.status !== 'declined').map((a) => a.memberId))
    const b = structuredClone(d)
    applyAction(d, { type: 'editEvent', eventId: ev.id, patch: { title: ev.title, date: ev.date, time: '07:00', place: ev.place } }, 'm-lucas')
    const out = notify.notificationsFor(b, d, 'm-lucas', today)
    expect(new Set(out.flatMap((o) => o.to))).toEqual(new Set([...people].filter((id) => id !== 'm-lucas')))
    expect(out[0].payload.body).toMatch(/07:00/)
    const b2 = structuredClone(d)
    applyAction(d, { type: 'removeEvent', eventId: ev.id }, 'm-lucas')
    expect(notify.notificationsFor(b2, d, 'm-lucas', today)[0].payload.body).toMatch(/cancelado/)
  })

  it('repertório enviado avisa a equipe do Louvor do culto', () => {
    const d = createSeed()
    const ev = d.events.find((e) => e.setlist.length > 0 && d.assignments.some((a) => a.eventId === e.id && a.ministryId === 'louvor'))!
    const b = structuredClone(d)
    applyAction(d, { type: 'sendSetlist', eventId: ev.id }, 'm-mariana')
    const out = notify.notificationsFor(b, d, 'm-mariana', today)
    expect(out).toHaveLength(1)
    expect(out[0].payload.title).toMatch(/Repertório/)
    const louvor = new Set(d.assignments.filter((a) => a.eventId === ev.id && a.ministryId === 'louvor' && a.status !== 'declined' && a.memberId !== 'm-mariana').map((a) => a.memberId))
    expect(new Set(out[0].to)).toEqual(louvor)
  })

  it('líder recebe as vagas abertas dos próximos dias; voluntário, o lembrete de confirmar', () => {
    const d = createSeed()
    const ev = futureLouvor(d)
    d.assignments = d.assignments.filter((a) => !(a.eventId === ev.id && a.ministryId === 'louvor' && a.role === 'Bateria'))
    const alerts = notify.openSlotsAlertsFor(d, ev.date, ev.date)
    const louvor = alerts.find((o) => o.payload.title.startsWith('Louvor'))!
    expect(louvor.to).toEqual(['m-mariana'])
    expect(louvor.payload.body).toMatch(/Bateria/)
    const pending = d.assignments.find((a) => a.status === 'pending' && !a.draft && d.events.find((e) => e.id === a.eventId)!.date > today)!
    const date = d.events.find((e) => e.id === pending.eventId)!.date
    const rem = notify.confirmRemindersFor(d, date)
    expect(rem.some((o) => o.to[0] === pending.memberId)).toBe(true)
    expect(notify.confirmRemindersFor(d, toISO(addDays(fromISO(today), 400)))).toHaveLength(0)
  })
})
