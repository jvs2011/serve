import { describe, expect, it } from 'vitest'
import { createSeed, demoProfiles } from '../src/data/seed'
import { myUpcoming, swapsICanCover } from '../src/lib/selectors'
import { draftsOf } from '../src/lib/schedule'

describe('demonstração do Follow', () => {
  const d = createSeed()
  const me = (id: string) => d.members.find((m) => m.id === id)!

  it('a tela de entrada mostra a líder, a Projeção, as artes e o News', () => {
    expect(demoProfiles.map((p) => p.id)).toEqual(['m-rafaela', 'm-bruno', 'm-julia', 'm-davi'])
    for (const p of demoProfiles) expect(me(p.id).ministries.some((m) => m.ministryId === 'follow')).toBe(true)
  })
  it('líder: rascunho do Follow para publicar', () => {
    expect(d.ministries.find((m) => m.id === 'follow')!.leaderIds).toContain('m-rafaela')
    expect(draftsOf(d, 'follow').length).toBeGreaterThan(0)
  })
  it('Projeção: escala esperando resposta e uma troca para assumir', () => {
    const up = myUpcoming(d, 'm-bruno')
    expect(up.filter((x) => x.a.role === 'Projeção').length).toBeGreaterThanOrEqual(3)
    expect(up[0].a.status).toBe('pending')
    expect(swapsICanCover(d, me('m-bruno')).length).toBeGreaterThan(0)
  })
  it('Artes: um pedido em aberto e um entregue', () => {
    const t = (d.tasks ?? []).filter((x) => x.assigneeId === 'm-julia')
    expect(t.map((x) => x.status).sort()).toEqual(['done', 'open'])
  })
  it('News: convite de gravação esperando resposta', () => {
    expect(d.assignments.find((a) => a.eventId === 'e-demo-news' && a.memberId === 'm-davi')?.status).toBe('pending')
  })
})
