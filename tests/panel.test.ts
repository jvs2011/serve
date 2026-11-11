import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { todayISO } from '../src/lib/dates'
import { attentionFor, careList, cellOf, gridRoles, panelEvents, plusDays, scheduleText, teamRows } from '../src/lib/panel'

const today = todayISO()

describe('painel do líder (computador)', () => {
  it('grade: só eventos com vaga para o ministério, funções na ordem do ministério', () => {
    const d = createSeed()
    const follow = d.ministries.find((m) => m.id === 'follow')!
    const evs = panelEvents(d, 'follow', today, plusDays(today, 27))
    expect(evs.length).toBeGreaterThan(4)
    expect(evs.every((e) => e.ministryIds.includes('follow') && e.date >= today)).toBe(true)
    const roles = gridRoles(d, follow, evs).map((r) => r.name)
    expect(roles.slice(0, 5)).toEqual(['Fotografia', 'Filmmaker', 'Stories', 'Projeção', 'Transmissão'])
    // a gravação do News entra com as funções dela
    expect(roles).toContain('Filmmaker (News)')
    expect(roles).not.toContain('Edição de fotos') // sem vaga nos cultos
  })

  it('célula: vagas, quem está e quem recusou; vaga de grupo conta o grupo uma vez', () => {
    const d = createSeed()
    const ev = panelEvents(d, 'louvor', today, plusDays(today, 27)).find((e) => d.assignments.some((a) => a.eventId === e.id && a.groupId))!
    const voz = cellOf(d, ev, 'louvor', 'Voz')
    expect(voz.group).toBe(true)
    expect(voz.units.length).toBe(1)
    expect(voz.units[0].list.length).toBeGreaterThan(1)
    const news = d.events.find((e) => e.id === 'e-demo-news')!
    const film = cellOf(d, news, 'follow', 'Filmmaker (News)')
    expect(film.declined.length + film.units.length).toBe(d.assignments.filter((a) => a.eventId === news.id && a.role === 'Filmmaker (News)').length)
    expect(cellOf(d, news, 'follow', 'Fotografia').count).toBe(0)
  })

  it('atenção: rascunho primeiro, depois trocas, vagas e quem não respondeu', () => {
    const d = createSeed()
    const list = attentionFor(d, 'follow', today)
    expect(list[0].kind).toBe('drafts')
    expect(list.some((x) => x.kind === 'swap')).toBe(true)
    expect(list.some((x) => x.kind === 'material')).toBe(true)
    // publicar o rascunho tira o item
    applyAction(d, { type: 'publishDrafts', ministryId: 'follow' }, 'm-rafaela')
    expect(attentionFor(d, 'follow', today).some((x) => x.kind === 'drafts')).toBe(false)
  })

  it('equipe: escalas no mês, próxima escala e quem precisa de cuidado', () => {
    const d = createSeed()
    const rows = teamRows(d, 'follow', today)
    const bruno = rows.find((r) => r.member.id === 'm-bruno')!
    expect(bruno.roles).toEqual(['Projeção'])
    expect(bruno.next?.a.role).toBe('Projeção')
    expect(bruno.month).toBeGreaterThan(0)
    const care = careList(rows, today)
    expect(care.every((r) => !r.next)).toBe(true)
    expect(care.some((r) => r.member.id === 'm-bruno')).toBe(false)
  })

  it('texto para o WhatsApp: só o publicado, sem quem recusou', () => {
    const d = createSeed()
    const follow = d.ministries.find((m) => m.id === 'follow')!
    const until = plusDays(today, 27)
    const evs = panelEvents(d, 'follow', today, until)
    const txt = scheduleText(d, follow, evs, today, until)
    expect(txt.startsWith('*Escala Follow*')).toBe(true)
    // quem recusou a gravação do News não aparece na linha da função
    const rec = d.events.find((e) => e.id === 'e-demo-news')!
    const name = (id: string) => d.members.find((m) => m.id === id)!.name.split(' ')[0]
    const line = txt.split('\n\n').find((blk) => blk.includes(rec.title))?.split('\n').find((l) => l.startsWith('Filmmaker (News):')) ?? ''
    const shown = d.assignments.filter((a) => a.eventId === rec.id && a.role === 'Filmmaker (News)' && a.status !== 'declined' && !a.draft).map((a) => name(a.memberId))
    for (const a of d.assignments.filter((x) => x.eventId === rec.id && x.role === 'Filmmaker (News)' && x.status === 'declined')) {
      if (!shown.includes(name(a.memberId))) expect(line).not.toContain(name(a.memberId))
    }
    // o rascunho só entra depois de publicado
    applyAction(d, { type: 'publishDrafts', ministryId: 'follow' }, 'm-rafaela')
    const after = scheduleText(d, follow, evs, today, until)
    expect(after.length).toBeGreaterThan(txt.length)
  })
})

describe('painel: eventos e coordenação', () => {
  it('tipo de evento e quem pode editar', async () => {
    const { canEditEvent, eventKind } = await import('../src/lib/panel')
    const d = createSeed()
    const rec = d.events.find((e) => e.id === 'e-demo-news')!
    const care = d.events.find((e) => e.id === 'e-demo-wecare')!
    const fixed = d.events.find((e) => e.slotId && e.date >= today)!
    expect(eventKind(rec)).toBe('session')
    expect(eventKind(care)).toBe('ministry')
    expect(eventKind(fixed)).toBe('fixed')
    const me = (id: string) => d.members.find((m) => m.id === id)!
    expect(canEditEvent(d, me('m-rafaela'), rec)).toBe(true) // gravação do Follow
    expect(canEditEvent(d, me('m-rafaela'), fixed)).toBe(false) // culto fixo é da coordenação
    expect(canEditEvent(d, me('m-rafaela'), care)).toBe(false) // evento de outro ministério
    expect(canEditEvent(d, me('m-lucas'), fixed)).toBe(true)
  })

  it('Louvor: culto da semana sem repertório enviado aparece na atenção', () => {
    const d = createSeed()
    const list = attentionFor(d, 'louvor', today).filter((x) => x.kind === 'setlist')
    expect(list.length).toBeGreaterThan(0)
    const ev = (list[0] as Extract<typeof list[number], { kind: 'setlist' }>).ev
    ev.setlistSentAt = new Date().toISOString()
    expect(attentionFor(d, 'louvor', today).some((x) => x.kind === 'setlist' && x.ev.id === ev.id)).toBe(false)
    expect(attentionFor(d, 'follow', today).some((x) => x.kind === 'setlist')).toBe(false)
  })
})
