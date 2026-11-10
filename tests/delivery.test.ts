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
  it('Fotografia, Filmmaker e Filmmaker do News enviam material; Projeção não', () => {
    const d = createSeed()
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Fotografia' })).toBe('as fotos')
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Filmmaker' })).toBe('o vídeo')
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Filmmaker (News)' })).toBe('as filmagens')
    expect(deliveryLabel(d, { ministryId: 'follow', role: 'Projeção' })).toBeUndefined()
  })

  it('o Vitor deve o vídeo do último culto; enviar avisa os líderes e a Edição de vídeos', () => {
    const d = createSeed()
    const [owed] = pendingDeliveries(d, 'm-vitor', today)
    expect(owed?.role).toBe('Filmmaker')
    expect(pendingDeliveries(d, 'm-carol', today)[0]?.role).toBe('Fotografia')
    expect(pendingDeliveries(d, 'm-davi', today)[0]?.role).toBe('Filmmaker (News)')
    expect(() => applyAction(d, { type: 'deliverMaterial', assignmentId: owed.id, link: 'drive.google.com/x' }, 'm-bruno')).toThrow(/permissão/)
    const b = structuredClone(d)
    applyAction(d, { type: 'deliverMaterial', assignmentId: owed.id, link: 'drive.google.com/x' }, 'm-vitor')
    expect(owed.delivery?.link).toBe('https://drive.google.com/x')
    // sobra no máximo o culto de hoje (o botão aparece a partir do dia do culto)
    expect(pendingDeliveries(d, 'm-vitor', today).filter((a) => d.events.find((e) => e.id === a.eventId)!.date < today)).toHaveLength(0)
    const out = notify.notificationsFor(b, d, 'm-vitor', today).find((o) => o.payload.title.startsWith('Material enviado'))!
    expect(out.to).toContain('m-rafaela')
    expect(out.to).toContain('m-teo') // Edição de vídeos
    expect(out.to).not.toContain('m-lara') // Edição de fotos: só as fotos
    expect(out.payload.body).toMatch(/Vitor enviou o vídeo/)
  })

  it('as fotos vão para a Edição de fotos', () => {
    const d = createSeed()
    const [owed] = pendingDeliveries(d, 'm-carol', today)
    const b = structuredClone(d)
    applyAction(d, { type: 'deliverMaterial', assignmentId: owed.id, link: 'drive.google.com/fotos' }, 'm-carol')
    const out = notify.notificationsFor(b, d, 'm-carol', today).find((o) => o.payload.title.startsWith('Material enviado'))!
    expect(out.to).toContain('m-lara')
    expect(out.to).not.toContain('m-teo')
  })

  it('filmagens do News também vão para quem edita o News', () => {
    const d = createSeed()
    const a = { id: 'f1', eventId: 'e-demo-news', ministryId: 'follow', role: 'Filmmaker (News)', memberId: 'm-bruno', status: 'confirmed' as const }
    d.assignments.push(a)
    const b = structuredClone(d)
    applyAction(d, { type: 'deliverMaterial', assignmentId: 'f1', link: 'https://wetransfer.com/x' }, 'm-rafaela')
    const out = notify.notificationsFor(b, d, 'm-rafaela', today).find((o) => o.payload.title.startsWith('Material enviado'))!
    expect(out.to).toContain('m-nina') // Edição do News
  })

  it('lembrete no dia seguinte para quem não enviou', () => {
    const d = createSeed()
    const [owed] = pendingDeliveries(d, 'm-vitor', today)
    const date = d.events.find((e) => e.id === owed.eventId)!.date
    const rem = notify.deliveryRemindersFor(d, date)
    expect(rem.some((o) => o.to[0] === 'm-vitor' && /Envie o vídeo/.test(o.payload.title))).toBe(true)
  })

  it('função sem material não envia', () => {
    const d = createSeed()
    const proj = d.assignments.find((a) => a.memberId === 'm-bruno' && a.role === 'Projeção')!
    expect(() => applyAction(d, { type: 'deliverMaterial', assignmentId: proj.id, link: 'x.com' }, 'm-bruno')).toThrow(/não envia/)
  })
})

describe('gravação do Lagoinha News', () => {
  it('convida Filmmaker e Apresentação, uma vez por pessoa', () => {
    const d = createSeed()
    const date = toISO(addDays(fromISO(today), 5))
    // alguém com as duas funções recebe um convite só
    d.members.find((m) => m.id === 'm-rafaela')!.ministries[0].roles.push('Filmmaker (News)')
    const r = applyAction(d, { type: 'createTeamSession', sessionId: 'news', date, time: '19:30' }, 'm-rafaela')
    const ev = d.events.find((e) => e.date === date && e.title === 'Gravação Lagoinha News' && e.id !== 'e-demo-news')!
    const inv = d.assignments.filter((a) => a.eventId === ev.id)
    expect(inv.length).toBe(r.created)
    expect(new Set(inv.map((a) => a.memberId)).size).toBe(inv.length)
    expect(new Set(inv.map((a) => a.role))).toEqual(new Set(['Filmmaker (News)', 'Apresentação (News)']))
    expect(ev.slots!.map((s) => s.role)).toEqual(['Filmmaker (News)', 'Apresentação (News)'])
    expect(inv.some((a) => a.memberId === 'm-davi' && a.role === 'Filmmaker (News)')).toBe(true)
  })

  it('dados reais: quem era do Lagoinha News passa para Filmmaker e Apresentação', async () => {
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
    expect(d.members[0].ministries[0].roles).toEqual(['Filmmaker (News)', 'Apresentação (News)', 'Filmmaker'])
    expect(d.members[0].interests![0].roles).toEqual(['Filmmaker (News)', 'Apresentação (News)'])
    expect(d.ministries.find((m) => m.id === 'follow')!.roles.some((r) => r.name === 'Lagoinha News')).toBe(false)
    expect(d.events.find((e) => e.id === 's1')!.slots).toEqual([{ ministryId: 'follow', role: 'Filmmaker (News)', count: 1 }])
    expect(d.assignments.find((a) => a.id === 'x1')!.role).toBe('Filmmaker (News)')
  })

  it('dados reais: Gravação (News) vira Apresentação (News), inclusive nas escalas', async () => {
    const ms = ministryList()
    ms.find((m) => m.id === 'follow')!.roles.push({ name: 'Gravação (News)', count: 0 })
    const date = toISO(addDays(fromISO(today), 3))
    const doc: AppData = {
      version: 1, ministries: ms, codeVersion: 23, unavailability: {}, swaps: [], notices: [],
      members: [{ id: 'n1', name: 'Léo Reis', phone: '16911113333', access: 'volunteer', maxPerMonth: 4, ministries: [{ ministryId: 'follow', roles: ['Gravação (News)'] }] }],
      events: [{ id: 's1', title: 'Gravação Lagoinha News', date, time: '19:30', ministryIds: ['follow'], setlist: [], slots: [{ ministryId: 'follow', role: 'Gravação (News)', count: 2 }] }],
      assignments: [{ id: 'x1', eventId: 's1', ministryId: 'follow', role: 'Gravação (News)', memberId: 'n1', status: 'pending' }],
    }
    const store = getStore()!
    await store.casDoc(await store.getVersion(), JSON.stringify(doc))
    await route('signup-info', 'GET', null, undefined, 'test', { m: 'follow' })
    const d = JSON.parse((await store.getDoc()).doc!) as AppData
    expect(d.members[0].ministries[0].roles).toEqual(['Apresentação (News)'])
    expect(d.ministries.find((m) => m.id === 'follow')!.roles.some((r) => r.name === 'Gravação (News)')).toBe(false)
    expect(d.events.find((e) => e.id === 's1')!.slots).toEqual([{ ministryId: 'follow', role: 'Apresentação (News)', count: 2 }])
    expect(d.assignments.find((a) => a.id === 'x1')!.role).toBe('Apresentação (News)')
  })
})
