import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { projectionMaterials, projectionSummary, projectionTeam, seesProjection } from '../src/lib/projection'
import { todayISO } from '../src/lib/dates'

process.env.SERVE_MEMORY_DB = '1'
const notify = await import('../server/notify')

describe('projeção', () => {
  it('o vídeo do News sempre vai para a projeção e precisa do culto', () => {
    const d = createSeed()
    const base = { ministryId: 'follow', details: '', assigneeId: 'm-davi', dueDate: todayISO() }
    expect(() => applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo do News', kind: 'news' } }, 'm-rafaela')).toThrow(/culto/)
    const ev = d.events.find((e) => e.date > todayISO() && e.ministryIds.includes('follow') && e.slotId)!
    applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo do News · X', kind: 'news', eventId: ev.id } }, 'm-rafaela')
    const t = d.tasks!.find((x) => x.title === 'Vídeo do News · X')!
    expect([t.kind, t.projection]).toEqual(['news', true])
    // arte comum não vai para a projeção
    applyAction(d, { type: 'saveTask', task: { ...base, title: 'Arte · Y', assigneeId: 'm-julia', eventId: ev.id } }, 'm-rafaela')
    expect(d.tasks!.find((x) => x.title === 'Arte · Y')!.projection).toBeUndefined()
  })

  it('entregue com link: a Projeção escalada no culto recebe o aviso', () => {
    const d = createSeed()
    const t = d.tasks!.find((x) => x.id === 't-news-2')!
    const ev = d.events.find((e) => e.id === t.eventId)!
    // garante alguém da Projeção escalado e publicado nesse culto
    const proj = d.assignments.find((a) => a.eventId === ev.id && a.role === 'Projeção')
    if (proj) { proj.draft = undefined; proj.status = 'confirmed' } else d.assignments.push({ id: 'p1', eventId: ev.id, ministryId: 'follow', role: 'Projeção', memberId: 'm-bruno', status: 'confirmed' })
    const team = projectionTeam(d, ev.id)
    const b = structuredClone(d)
    applyAction(d, { type: 'setTaskDone', taskId: t.id, done: true, link: 'youtube.com/x' }, 'm-davi')
    const out = notify.notificationsFor(b, d, 'm-davi', todayISO())
    const proj2 = out.find((o) => o.payload.title.startsWith('Para a projeção'))!
    expect(new Set(proj2.to)).toEqual(new Set(team.filter((id) => id !== 'm-rafaela')))
    expect(proj2.payload.body).toMatch(/Lagoinha News/)
    expect(out.find((o) => o.payload.title.startsWith('Vídeo do News entregue'))!.to).toEqual(['m-rafaela'])
  })

  it('demonstração: o Bruno vê arte, vídeo do News e músicas no próximo culto', () => {
    const d = createSeed()
    const bruno = d.members.find((m) => m.id === 'm-bruno')!
    const t = d.tasks!.find((x) => x.id === 't-proj-news')!
    const ev = d.events.find((e) => e.id === t.eventId)!
    expect(seesProjection(d, bruno, ev)).toBe(true)
    expect(seesProjection(d, d.members.find((m) => m.id === 'm-julia')!, ev)).toBe(false)
    const m = projectionMaterials(d, ev)
    expect(m.tasks.map((x) => x.kind ?? 'art')).toEqual(['news', 'art'])
    expect(projectionSummary(m)).toMatch(/1 arte · vídeo do News/)
    expect(m.songs.length).toBeGreaterThan(0)
  })
})
