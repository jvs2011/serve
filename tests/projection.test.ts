import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { newsSundays, projectionEvents, projectionMaterials, projectionSummary, projectionTeam, seesProjection } from '../src/lib/projection'
import { todayISO } from '../src/lib/dates'

process.env.SERVE_MEMORY_DB = '1'
const notify = await import('../server/notify')

describe('projeção', () => {
  it('News só na projeção, num domingo; arte e vídeo vão para a projeção e/ou mídias sociais', () => {
    const d = createSeed()
    const base = { ministryId: 'follow', details: '', assigneeId: 'm-davi', dueDate: todayISO() }
    const [sunday] = newsSundays(d, todayISO())
    // News: precisa do domingo; nunca mídias sociais
    expect(() => applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo do News', kind: 'news', social: true } }, 'm-rafaela')).toThrow(/domingo/)
    applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo do News · X', kind: 'news', airDate: sunday, social: true } }, 'm-rafaela')
    const n = d.tasks!.find((x) => x.title === 'Vídeo do News · X')!
    expect([n.kind, n.projection, n.social, n.airDate, n.eventId]).toEqual(['news', true, undefined, sunday, undefined])
    // aparece nos cultos da manhã e da noite daquele domingo
    const cultos = projectionEvents(d, n)
    expect(cultos.length).toBe(2)
    for (const ev of cultos) expect(projectionMaterials(d, ev).tasks.map((t) => t.id)).toContain(n.id)
    // vídeo geral só para as redes: não precisa de culto e não aparece na projeção
    applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo · Conferência', kind: 'video', social: true } }, 'm-rafaela')
    const v = d.tasks!.find((x) => x.title === 'Vídeo · Conferência')!
    expect([v.kind, v.projection, v.social, v.eventId]).toEqual(['video', undefined, true, undefined])
    // vídeo para a projeção precisa do culto e aparece no quadro
    const ev = d.events.find((e) => e.date > todayISO() && e.ministryIds.includes('follow') && e.slotId)!
    expect(() => applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo · Abertura', kind: 'video', projection: true } }, 'm-rafaela')).toThrow(/culto/)
    applyAction(d, { type: 'saveTask', task: { ...base, title: 'Vídeo · Abertura', kind: 'video', projection: true, social: true, eventId: ev.id } }, 'm-rafaela')
    expect(projectionMaterials(d, ev).tasks.map((t) => t.title)).toContain('Vídeo · Abertura')
    expect(projectionSummary(projectionMaterials(d, ev))).toMatch(/1 vídeo/)
    // arte comum não vai para a projeção
    applyAction(d, { type: 'saveTask', task: { ...base, title: 'Arte · Y', assigneeId: 'm-julia', eventId: ev.id } }, 'm-rafaela')
    expect(d.tasks!.find((x) => x.title === 'Arte · Y')!.projection).toBeUndefined()
  })

  it('News entregue: a Projeção dos dois cultos do domingo recebe o aviso', () => {
    const d = createSeed()
    const t = d.tasks!.find((x) => x.id === 't-news-2')!
    const cultos = projectionEvents(d, t)
    expect(cultos.length).toBe(2)
    // garante alguém da Projeção escalado e publicado em cada culto
    cultos.forEach((ev, i) => {
      const proj = d.assignments.find((a) => a.eventId === ev.id && a.role === 'Projeção')
      if (proj) { proj.draft = undefined; proj.status = 'confirmed' } else d.assignments.push({ id: `p${i}`, eventId: ev.id, ministryId: 'follow', role: 'Projeção', memberId: i ? 'm-36' : 'm-35', status: 'confirmed' })
    })
    const team = [...new Set(cultos.flatMap((ev) => projectionTeam(d, ev.id)))]
    expect(team.length).toBeGreaterThanOrEqual(1)
    const b = structuredClone(d)
    applyAction(d, { type: 'setTaskDone', taskId: t.id, done: true, link: 'youtube.com/x' }, 'm-nina')
    const out = notify.notificationsFor(b, d, 'm-nina', todayISO())
    const proj2 = out.find((o) => o.payload.title.startsWith('Para a projeção'))!
    expect(new Set(proj2.to)).toEqual(new Set(team.filter((id) => id !== 'm-rafaela')))
    expect(proj2.payload.body).toMatch(/Lagoinha News já está nos cultos de dom/)
    expect(out.find((o) => o.payload.title.startsWith('Vídeo do News entregue'))!.to).toEqual(['m-rafaela'])
  })

  it('demonstração: o Bruno vê a arte e as músicas no próximo culto e o News no domingo', () => {
    const d = createSeed()
    const bruno = d.members.find((m) => m.id === 'm-bruno')!
    const art = d.tasks!.find((x) => x.id === 't-proj-arte')!
    const ev = d.events.find((e) => e.id === art.eventId)!
    expect(seesProjection(d, bruno, ev)).toBe(true)
    expect(seesProjection(d, d.members.find((m) => m.id === 'm-julia')!, ev)).toBe(false)
    const m = projectionMaterials(d, ev)
    expect(m.tasks.map((x) => x.id)).toContain('t-proj-arte')
    expect(m.songs.length).toBeGreaterThan(0)
    const news = d.tasks!.find((x) => x.id === 't-proj-news')!
    const sundayCultos = projectionEvents(d, news)
    expect(sundayCultos.length).toBe(2)
    expect(sundayCultos.some((e) => projectionTeam(d, e.id).includes('m-bruno'))).toBe(true)
  })
})
