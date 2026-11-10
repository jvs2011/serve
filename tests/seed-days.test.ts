import { describe, expect, it, vi } from 'vitest'
import { createSeed } from '../src/data/seed'
import { myUpcoming, swapsICanCover } from '../src/lib/selectors'
import { pendingDeliveries } from '../src/lib/delivery'
import { todayISO } from '../src/lib/dates'

describe('demonstração estável em qualquer dia (14 dias seguidos)', () => {
  for (let k = 0; k < 14; k++) it(`dia +${k}`, () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(Date.UTC(2026, 10, 10 + k, 15)))
    const d = createSeed(); const today = todayISO()
    const me = (id: string) => d.members.find((m) => m.id === id)!
    for (const [id, role] of [['m-bruno', 'Projeção'], ['m-gustavo', 'Transmissão']]) {
      const up = myUpcoming(d, id).filter((x) => x.a.role === role)
      expect(up.length, id).toBeGreaterThanOrEqual(2)
      expect(up[0].a.status, id).toBe('pending')
      expect(swapsICanCover(d, me(id)).length, id).toBeGreaterThan(0)
    }
    const owedPast = (id: string) => pendingDeliveries(d, id, today).filter((a) => d.events.find((e) => e.id === a.eventId)!.date < today).map((a) => a.role)
    expect(owedPast('m-vitor')).toEqual(['Vídeo'])
    expect(owedPast('m-carol')).toEqual(['Fotografia'])
    expect(pendingDeliveries(d, 'm-davi', today)[0]?.role).toBe('Filmagem (News)')
    for (const id of ['m-vitor', 'm-carol', 'm-bianca']) expect(myUpcoming(d, id).length, id).toBeGreaterThan(0)
    const past = d.assignments.filter((a) => a.memberId === 'm-bianca' && a.role === 'Stories' && (d.events.find((e) => e.id === a.eventId)?.date ?? '') < today)
    expect(past.some((a) => d.assignments.some((b) => b.eventId === a.eventId && b.role === 'Fotografia' && b.delivery))).toBe(true)
    expect((d.tasks ?? []).some((t) => t.id === 't-proj-arte')).toBe(true)
    vi.useRealTimers()
  })
})
