import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { autoFill, openSlots, rankCandidates, visibleTo } from '../src/lib/schedule'
import { todayISO } from '../src/lib/dates'
import type { AppData, ChurchEvent } from '../src/data/types'

/** Um culto futuro do templo, com as escalas do Louvor zeradas */
function clearLouvor(d: AppData): ChurchEvent {
  const ev = d.events.find((e) => e.date > todayISO() && e.ministryIds.includes('louvor') && e.ministryIds.includes('diaconato'))!
  d.assignments = d.assignments.filter((a) => !(a.eventId === ev.id && a.ministryId === 'louvor'))
  return ev
}

describe('escala automática', () => {
  it('preenche as vagas do Louvor com um grupo de voz inteiro e os instrumentos', () => {
    const d = createSeed()
    const ev = clearLouvor(d)
    const made = autoFill(d, ev.id, 'louvor')
    const voz = made.filter((a) => a.role === 'Voz')
    expect(new Set(voz.map((a) => a.groupId)).size).toBe(1)
    expect(made.filter((a) => a.role !== 'Voz').every((a) => !a.groupId)).toBe(true)
    d.assignments.push(...made)
    expect(openSlots(d, ev.id, 'louvor').filter((s) => s.role === 'Voz')).toHaveLength(0)
  })

  it('não escala quem marcou indisponível no dia ou no culto fixo', () => {
    const d = createSeed()
    const ev = clearLouvor(d)
    const tecladistas = d.members.filter((m) => m.ministries.some((mm) => mm.ministryId === 'louvor' && mm.roles.includes('Teclado')))
    const [a, b] = tecladistas
    d.unavailability[a.id] = [ev.date]
    const [y, mo, dd] = ev.date.split('-').map(Number)
    b.recurringOff = [`${new Date(y, mo - 1, dd).getDay()}-${ev.time}`]
    const pick = autoFill(d, ev.id, 'louvor').find((x) => x.role === 'Teclado')
    expect(pick && [a.id, b.id].includes(pick.memberId)).toBeFalsy()
    const ranked = rankCandidates(d, ev, 'louvor', 'Teclado')
    expect(ranked.find((r) => r.member.id === a.id)?.blocked).toBe(true)
    expect(ranked.find((r) => r.member.id === b.id)?.av.recurring).toBe(true)
  })
})

describe('rascunho da escala', () => {
  it('a escala do líder fica em rascunho e só os líderes veem', () => {
    const d = createSeed()
    const ev = clearLouvor(d)
    const r = applyAction(d, { type: 'autoSchedule', eventIds: [ev.id], ministryId: 'louvor' }, 'm-mariana')
    expect(r.created).toBeGreaterThan(0)
    const drafts = d.assignments.filter((a) => a.eventId === ev.id && a.ministryId === 'louvor')
    expect(drafts.every((a) => a.draft)).toBe(true)
    const volunteer = drafts.find((a) => a.memberId !== 'm-mariana')!.memberId
    expect(visibleTo(d, volunteer).assignments.some((a) => a.draft)).toBe(false)
    const draftsHere = (who: string) => visibleTo(d, who).assignments.filter((a) => a.draft && a.eventId === ev.id).length
    expect(draftsHere('m-mariana')).toBe(drafts.length)
    expect(draftsHere('m-lucas')).toBe(drafts.length) // coordenação
    expect(draftsHere('m-rafaela')).toBe(0) // líder de outro ministério
  })

  it('publicar e descartar', () => {
    const d = createSeed()
    const ev = clearLouvor(d)
    applyAction(d, { type: 'autoSchedule', eventIds: [ev.id], ministryId: 'louvor' }, 'm-mariana')
    expect(() => applyAction(d, { type: 'publishDrafts', ministryId: 'louvor' }, 'm-ana')).toThrow(/permissão/)
    const n = applyAction(d, { type: 'publishDrafts', ministryId: 'louvor', eventId: ev.id }, 'm-mariana').created
    expect(n).toBeGreaterThan(0)
    expect(d.assignments.filter((a) => a.eventId === ev.id && a.draft)).toHaveLength(0)
    const someone = d.members.find((m) => m.ministries.some((mm) => mm.ministryId === 'louvor' && mm.roles.includes('Bateria')))!
    applyAction(d, { type: 'assign', eventId: ev.id, ministryId: 'louvor', role: 'Bateria', memberId: someone.id }, 'm-mariana')
    expect(applyAction(d, { type: 'discardDrafts', ministryId: 'louvor' }, 'm-mariana').created).toBeGreaterThanOrEqual(1)
    expect(d.assignments.some((a) => a.draft && a.ministryId === 'louvor')).toBe(false)
  })
})

describe('permissões', () => {
  it('voluntário não escala; líder só no próprio ministério', () => {
    const d = createSeed()
    const ev = clearLouvor(d)
    const args = { type: 'assign' as const, eventId: ev.id, role: 'Teclado', memberId: 'm-ana' }
    expect(() => applyAction(d, { ...args, ministryId: 'louvor' }, 'm-ana')).toThrow(/permissão/)
    expect(() => applyAction(d, { ...args, ministryId: 'diaconato' }, 'm-mariana')).toThrow(/permissão/)
    expect(() => applyAction(d, { ...args, ministryId: 'louvor' }, 'm-mariana')).not.toThrow()
  })

  it('líder edita evento do ministério, mas não culto fixo', () => {
    const d = createSeed()
    const culto = d.events.find((e) => e.date > todayISO() && e.ministryIds.includes('louvor') && e.slotId)!
    const patch = { title: 'X', date: culto.date, time: '10:00' }
    expect(() => applyAction(d, { type: 'editEvent', eventId: culto.id, patch }, 'm-mariana')).toThrow(/permissão/)
    applyAction(d, { type: 'addMinistryEvent', event: { ministryId: 'louvor', title: 'Ensaio geral', date: culto.date, time: '15:00', slots: [{ role: 'Teclado', count: 1 }] } }, 'm-mariana')
    const ensaio = d.events.find((e) => e.title === 'Ensaio geral')!
    applyAction(d, { type: 'editEvent', eventId: ensaio.id, patch: { title: 'Ensaio geral', date: ensaio.date, time: '16:00', place: 'Garagem', slots: [{ ministryId: 'louvor', role: 'Bateria', count: 1 }] } }, 'm-mariana')
    expect([ensaio.time, ensaio.place, ensaio.slots]).toEqual(['16:00', 'Garagem', [{ ministryId: 'louvor', role: 'Bateria', count: 1 }]])
    expect(() => applyAction(d, { type: 'editEvent', eventId: ensaio.id, patch: { title: 'Y', date: ensaio.date, time: '' } }, 'm-rafaela')).toThrow(/permissão/)
  })

  it('coordenação muda os ministérios de um culto e as escalas do ministério retirado saem', () => {
    const d = createSeed()
    const culto = d.events.find((e) => e.date > todayISO() && e.ministryIds.includes('kids') && d.assignments.some((a) => a.eventId === e.id && a.ministryId === 'kids'))!
    applyAction(d, { type: 'editEvent', eventId: culto.id, patch: { title: culto.title, date: culto.date, time: culto.time, ministryIds: culto.ministryIds.filter((m) => m !== 'kids') } }, 'm-lucas')
    expect(d.assignments.some((a) => a.eventId === culto.id && a.ministryId === 'kids')).toBe(false)
    expect(culto.edited).toBe(true)
  })

  it('repertório: quem está no Louvor do culto avisa a equipe; precisa ter músicas', () => {
    const d = createSeed()
    const ev = d.events.find((e) => e.setlist.length > 0)!
    applyAction(d, { type: 'sendSetlist', eventId: ev.id }, 'm-mariana')
    expect(ev.setlistSentAt).toBeTruthy()
    const empty = d.events.find((e) => e.date > todayISO() && e.ministryIds.includes('louvor') && !e.setlist.length)!
    expect(() => applyAction(d, { type: 'sendSetlist', eventId: empty.id }, 'm-mariana')).toThrow(/músicas/)
  })

  it('líder do Carisma ganha a função Secretário', () => {
    const d = createSeed()
    applyAction(d, { type: 'saveMember', member: { name: 'Novo Líder', phone: '16911119999', ministries: [{ ministryId: 'carisma', roles: ['Professor'], leader: true }] } }, 'm-lucas')
    expect(d.members.find((m) => m.name === 'Novo Líder')?.ministries[0].roles).toEqual(['Secretário', 'Professor'])
  })
})
