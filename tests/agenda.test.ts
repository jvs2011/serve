import { describe, expect, it } from 'vitest'
import { applyWeekly, DEFAULT_WEEKLY, frequencyLabel, recurringSlots, weeklyEvents } from '../src/data/agenda'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { addDays, fromISO, toISO, todayISO } from '../src/lib/dates'
import type { AppData } from '../src/data/types'

const titles = (from: string, to: string) => weeklyEvents(DEFAULT_WEEKLY, from, to).map((e) => `${e.date} ${e.time} ${e.title}`)

describe('agenda fixa', () => {
  it('gera os cultos de domingo conforme a semana do mês (Ceia)', () => {
    // 01/11/2026 é o 1º domingo; 08/11 o 2º
    expect(titles('2026-11-01', '2026-11-01')).toEqual(['2026-11-01 09:30 Culto de Celebração', '2026-11-01 18:30 Culto de Ceia'])
    expect(titles('2026-11-08', '2026-11-08')).toEqual(['2026-11-08 09:30 Culto de Ceia', '2026-11-08 18:30 Culto de Celebração'])
  })

  it('quartas temáticas e o Culto Shine só na 5ª quarta de abril, julho e setembro', () => {
    const qua = (iso: string) => weeklyEvents(DEFAULT_WEEKLY, iso, iso).filter((e) => e.time === '20:00').map((e) => e.title)
    expect(qua('2026-11-04')).toEqual(['Culto Fé – Louvor e Clamor'])
    expect(qua('2026-11-18')).toEqual(['Culto Fé – Gerações'])
    expect(qua('2026-04-29')).toEqual(['Culto Shine'])
    expect(qua('2026-12-30')).toEqual(['Culto Fé'])
  })

  it('Sala de Adoração a cada 15 dias', () => {
    const sala = weeklyEvents(DEFAULT_WEEKLY, '2026-01-01', '2026-01-31').filter((e) => e.slotId === 'sex-sala').map((e) => e.date)
    expect(sala).toEqual(['2026-01-02', '2026-01-16', '2026-01-30'])
  })

  it('ids iguais aos da agenda antiga (data + horário + título)', () => {
    const ev = weeklyEvents(DEFAULT_WEEKLY, '2026-11-07', '2026-11-07').find((e) => e.slotId === 'sab-rocket')!
    expect(ev.id).toBe('e-2026-11-07-1930-culto-rocket')
  })

  it('textos de frequência e cultos da semana para a disponibilidade', () => {
    expect(frequencyLabel(DEFAULT_WEEKLY.find((s) => s.id === 'dom-manha')!)).toBe('1º, 3º, 4º e 5º domingos do mês')
    expect(frequencyLabel(DEFAULT_WEEKLY.find((s) => s.id === 'qua-fe')!)).toBe('2ª quarta do mês')
    expect(frequencyLabel(DEFAULT_WEEKLY.find((s) => s.id === 'qua-shine')!)).toBe('5ª quarta do mês · abr, jul, set')
    expect(frequencyLabel(DEFAULT_WEEKLY.find((s) => s.id === 'sex-sala')!)).toBe('a cada 15 dias')
    const slots = recurringSlots(DEFAULT_WEEKLY)
    expect(slots.find((s) => s.key === '0-09:30')?.title).toBe('Culto de Celebração')
    expect(slots.find((s) => s.key === '0-09:30')?.day).toBe('Aos domingos')
    expect(slots.find((s) => s.key === '3-20:00')?.day).toBe('Às quartas')
    expect(slots.find((s) => s.key === '3-20:00')?.title).toBe('Culto Fé')
    expect(slots.find((s) => s.key === '5-20:00')?.title).toBe('Sala de Adoração (quinzenal)')
    expect(slots.some((s) => s.title.includes('Restaurar'))).toBe(false) // sem escala, não aparece
  })
})

describe('editar a agenda fixa', () => {
  const setup = () => {
    const d = createSeed()
    const today = todayISO()
    return { d, today }
  }
  const futureOf = (d: AppData, slotId: string, today: string) => d.events.filter((e) => e.slotId === slotId && e.date >= today)

  it('mudar o horário atualiza os próximos eventos e mantém as escalas', () => {
    const { d, today } = setup()
    const before = futureOf(d, 'sab-rocket', today)
    const ids = before.map((e) => e.id)
    const assigned = d.assignments.filter((a) => ids.includes(a.eventId)).length
    const slot = { ...d.weekly!.find((s) => s.id === 'sab-rocket')!, time: '19:00' }
    const r = applyAction(d, { type: 'saveWeekly', slot }, 'm-lucas')
    expect(r.updated).toBe(before.length)
    const after = futureOf(d, 'sab-rocket', today)
    expect(after.map((e) => e.id)).toEqual(ids)
    expect(after.every((e) => e.time === '19:00')).toBe(true)
    expect(d.assignments.filter((a) => ids.includes(a.eventId)).length).toBe(assigned)
  })

  it('tirar um ministério do culto tira as escalas dele nesse culto', () => {
    const { d, today } = setup()
    const slot = d.weekly!.find((s) => s.id === 'dom-manha')!
    const evs = futureOf(d, 'dom-manha', today).map((e) => e.id)
    expect(d.assignments.some((a) => evs.includes(a.eventId) && a.ministryId === 'kids')).toBe(true)
    applyAction(d, { type: 'saveWeekly', slot: { ...slot, ministryIds: slot.ministryIds.filter((m) => m !== 'kids') } }, 'm-lucas')
    expect(d.assignments.some((a) => evs.includes(a.eventId) && a.ministryId === 'kids')).toBe(false)
  })

  it('remover um culto fixo tira os eventos futuros, mas não os passados', () => {
    const { d, today } = setup()
    const past = d.events.filter((e) => e.slotId === 'ter-link' && e.date < today).length
    const r = applyAction(d, { type: 'removeWeekly', slotId: 'ter-link' }, 'm-lucas')
    expect(r.removed).toBeGreaterThan(0)
    expect(futureOf(d, 'ter-link', today)).toHaveLength(0)
    expect(d.events.filter((e) => e.slotId === 'ter-link').length).toBe(past)
  })

  it('novo culto fixo cria os eventos até onde a agenda foi gerada', () => {
    const { d, today } = setup()
    const r = applyAction(d, { type: 'saveWeekly', slot: { id: '', day: 4, time: '20:00', title: 'Ensaio do Louvor', ministryIds: ['louvor'] } }, 'm-lucas')
    expect(r.created).toBeGreaterThan(5)
    const created = d.events.filter((e) => e.title === 'Ensaio do Louvor')
    expect(created.every((e) => e.date >= today && fromISO(e.date).getDay() === 4)).toBe(true)
  })

  it('dia cancelado não volta e dia editado à mão não é sobrescrito', () => {
    const { d, today } = setup()
    const [first, second] = futureOf(d, 'ter-link', today)
    applyAction(d, { type: 'removeEvent', eventId: first.id }, 'm-lucas')
    applyAction(d, { type: 'editEvent', eventId: second.id, patch: { title: 'Link especial', date: second.date, time: '20:00' } }, 'm-lucas')
    const slot = d.weekly!.find((s) => s.id === 'ter-link')!
    applyAction(d, { type: 'saveWeekly', slot: { ...slot, title: 'Link GC' } }, 'm-lucas')
    expect(d.events.some((e) => e.date === first.date && e.slotId === 'ter-link')).toBe(false)
    const kept = d.events.find((e) => e.id === second.id)!
    expect([kept.title, kept.time, kept.edited]).toEqual(['Link especial', '20:00', true])
  })

  it('aplicar duas vezes não muda nada', () => {
    const { d, today } = setup()
    applyWeekly(d, today)
    const snapshot = JSON.stringify(d.events)
    expect(applyWeekly(d, today)).toEqual({ added: 0, updated: 0, removed: 0, droppedAssignments: 0 })
    expect(JSON.stringify(d.events)).toBe(snapshot)
  })

  it('só a coordenação mexe na agenda fixa', () => {
    const { d } = setup()
    expect(() => applyAction(d, { type: 'removeWeekly', slotId: 'ter-link' }, 'm-mariana')).toThrow(/permissão/)
  })

  it('quem marcou que não pode no horário antigo continua marcado no novo', () => {
    const { d } = setup()
    const ana = d.members.find((m) => m.id === 'm-ana')!
    ana.recurringOff = ['6-19:30']
    // só muda a chave se nenhum outro culto usa o horário antigo: tira o Legacy das 19h30 antes
    applyAction(d, { type: 'removeWeekly', slotId: 'sab-legacy' }, 'm-lucas')
    applyAction(d, { type: 'saveWeekly', slot: { ...d.weekly!.find((s) => s.id === 'sab-rocket')!, time: '19:00' } }, 'm-lucas')
    expect(ana.recurringOff).toEqual(['6-19:00'])
  })

  it('valida a data de referência do "a cada 15 dias"', () => {
    const { d } = setup()
    const slot = { id: '', day: 5, time: '20:00', title: 'X', ministryIds: [], biweekly: toISO(addDays(fromISO('2026-01-02'), 1)) }
    expect(() => applyAction(d, { type: 'saveWeekly', slot }, 'm-lucas')).toThrow(/mesmo dia da semana/)
  })
})
