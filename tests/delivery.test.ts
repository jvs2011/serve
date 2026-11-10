import { describe, expect, it } from 'vitest'
import { createSeed, ministryList } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { deliveryLabel, pendingDeliveries } from '../src/lib/delivery'
import { addDays, fromISO, toISO, todayISO } from '../src/lib/dates'
import type { AppData } from '../src/data/types'

for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k]
process.env.SERVE_MEMORY_DB = '1'
const notify = await import('../server/notify')
const { route } = await import('../server/app')
const { getStore } = await import('../server/storage')

const today = todayISO()

describe('material depois de servir', () => {
  it('Fotografia, Vídeo e Filmagem do News enviam material; Projeção não', () => {
    const d = createSeed()
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Fotografia' })).toBe('as fotos')
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Vídeo' })).toBe('o vídeo')
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Filmagem (News)' })).toBe('as filmagens')
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Projeção' })).toBeUndefined()
  })

  it('o Davi deve o vídeo do último culto; enviar avisa os líderes', () => {
    const d = createSeed()
    const [owed] = pendingDeliveries(d, 'm-davi', today)
    expect(owed?.role).toBe('Vídeo')
    expect(() => applyAction(d, { type: 'deliverMaterial', assignmentId: owed.id, link: 'drive.google.com/x' }, 'm-bruno')).toThrow(/permissão/)
    const b = structuredClone(d)
    applyAction(d, { type: 'deliverMaterial', assignmentId: owed.id, link: 'drive.google.com/x' }, 'm-davi')
    expect(owed.delivery?.link).toBe('https://drive.google.com/x')
    expect(pendingDeliveries(d, 'm-davi', today)).toHaveLength(0)
    const out = notify.notificationsFor(b, d, 'm-davi', today).find((o) => o.payload.title.startsWith('Material enviado'))!
    expect(out.to).toEqual(['m-rafaela'])
    expect(out.payload.body).toMatch(/Davi enviou o vídeo/)
  })

  it('filmagens do News também vão para quem edita o News', () => {
    const d = createSeed()
    const a = { id: 'f1', eventId: 'e-demo-news', ministryId: 'follow', role: 'Filmagem (News)', memberId: 'm-bruno', status: 'confirmed' as const }
    d.assignments.push(a)
    const b = structuredClone(d)
    applyAction(d, { type: 'deliverMaterial', assignmentId: 'f1', link: 'https://wetransfer.com/x' }, 'm-rafaela')
    const out = notify.notificationsFor(b, d, 'm-rafaela', today).find((o) => o.payload.title.startsWith('Material enviado'))!
    expect(out.to).toContain('m-davi') // Edição do News
  })

  it('lembrete no dia seguinte para quem não enviou', () => {
    const d = createSeed()
    const [owed] = pendingDeliveries(d, 'm-davi', today)
    const date = d.events.find((e) => e.id === owed.eventId)!.date
    const rem = notify.deliveryRemindersFor(d, date)
    expect(rem.some((o) => o.to[0] === 'm-davi' && /Envie o vídeo/.test(o.payload.title))).toBe(true)
  })

  it('função sem material não envia', () => {
    const d = createSeed()
    const proj = d.assignments.find((a) => a.memberId === 'm-bruno' && a.role === 'Projeção')!
    expect(() => applyAction(d, { type: 'deliverMaterial', assignmentId: proj.id, link: 'x.com' }, 'm-bruno')).toThrow(/não envia/)
  })
})

describe('gravação do Lagoinha News', () => {
  it('convida Filmagem e Gravação, uma vez por pessoa', () => {
    const d = createSeed()
    const date = toISO(addDays(fromISO(today), 5))
    // alguém com as duas funções recebe um convite só
    d.members.find((m) => m.id === 'm-rafaela')!.ministries[0].roles.push('Filmagem (News)')
    const r = applyAction(d, { type: 'createTeamSession', sessionId: 'news', date, time: '19:30' }, 'm-rafaela')
    const ev = d.events.find((e) => e.date === date && e.title === 'Gravação Lagoinha News' && e.id !== 'e-demo-news')!
    const inv = d.assignments.filter((a) => a.eventId === ev.id)
    expect(inv.length).toBe(r.created)
    expect(new Set(inv.map((a) => a.memberId)).size).toBe(inv.length)
    expect(new Set(inv.map((a) => a.role))).toEqual(new Set(['Filmagem (News)', 'Gravação (News)']))
    expect(ev.slots!.map((s) => s.role)).toEqual(['Filmagem (News)', 'Gravação (News)'])
    expect(inv.some((a) => a.memberId === 'm-davi' && a.role === 'Filmagem (News)')).toBe(true)
  })

  it('dados reais: quem era do Lagoinha News passa para Filmagem e Gravação', async () => {
    const ms = ministryList()
    const follow = ms.find((m) => m.id === 'follow')!
    follow.roles.push({ name: 'Lagoinha News', count: 0 })
    const date = toISO(addDays(fromISO(today), 3))
    const doc: AppData = {
      version: 1, ministries: ms, codeVersion: 19, unavailability: {}, swaps: [], notices: [],
      members: [{ id: 'n1', name: 'Nina Reis', phone: '16911112222', access: 'volunteer', maxPerMonth: 4, ministries: [{ ministryId: 'follow', roles: ['Lagoinha News', 'Vídeo'] }], interests: [{ ministryId: 'follow', roles: ['Lagoinha News'] }] }],
      events: [{ id: 's1', title: 'Gravação Lagoinha News', date, time: '19:30', ministryIds: ['follow'], setlist: [], slots: [{ ministryId: 'follow', role: 'Lagoinha News', count: 1 }] }],
      assignments: [{ id: 'x1', eventId: 's1', ministryId: 'follow', role: 'Lagoinha News', memberId: 'n1', status: 'pending' }],
    }
    const store = getStore()!
    await store.casDoc(await store.getVersion(), JSON.stringify(doc))
    await route('signup-info', 'GET', null, undefined, 'test', { m: 'follow' })
    const d = JSON.parse((await store.getDoc()).doc!) as AppData
    expect(d.members[0].ministries[0].roles).toEqual(['Filmagem (News)', 'Gravação (News)', 'Vídeo'])
    expect(d.members[0].interests![0].roles).toEqual(['Filmagem (News)', 'Gravação (News)'])
    expect(d.ministries.find((m) => m.id === 'follow')!.roles.some((r) => r.name === 'Lagoinha News')).toBe(false)
    expect(d.events.find((e) => e.id === 's1')!.slots).toEqual([{ ministryId: 'follow', role: 'Filmagem (News)', count: 1 }])
    expect(d.assignments.find((a) => a.id === 'x1')!.role).toBe('Filmagem (News)')
  })
})
