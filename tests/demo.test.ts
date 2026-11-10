import { describe, expect, it } from 'vitest'
import { createSeed, demoProfiles } from '../src/data/seed'
import { myUpcoming, swapsICanCover } from '../src/lib/selectors'
import { draftsOf } from '../src/lib/schedule'
import { pendingDeliveries } from '../src/lib/delivery'
import { todayISO } from '../src/lib/dates'

describe('demonstração do Follow: um perfil para cada função', () => {
  const d = createSeed()
  const today = todayISO()
  const me = (id: string) => d.members.find((m) => m.id === id)!
  const roles = (id: string) => me(id).ministries.find((m) => m.ministryId === 'follow')?.roles ?? []
  const openTasks = (id: string) => (d.tasks ?? []).filter((t) => t.assigneeId === id && t.status === 'open')

  it('a tela de entrada mostra os 10 perfis do Follow', () => {
    expect(demoProfiles.map((p) => p.id)).toEqual(['m-rafaela', 'm-bruno', 'm-vitor', 'm-carol', 'm-julia', 'm-gustavo', 'm-bianca', 'm-davi', 'm-nina', 'm-leo'])
    for (const p of demoProfiles) expect(roles(p.id).length).toBeGreaterThan(0)
  })
  it('líder: rascunho do Follow para publicar', () => {
    expect(d.ministries.find((m) => m.id === 'follow')!.leaderIds).toContain('m-rafaela')
    expect(draftsOf(d, 'follow').length).toBeGreaterThan(0)
  })
  it('Projeção e Transmissão: escala esperando resposta e uma troca para assumir', () => {
    for (const [id, role] of [['m-bruno', 'Projeção'], ['m-gustavo', 'Transmissão']]) {
      const up = myUpcoming(d, id).filter((x) => x.a.role === role)
      expect(up.length).toBeGreaterThanOrEqual(2)
      expect(up[0].a.status).toBe('pending')
      expect(swapsICanCover(d, me(id)).length).toBeGreaterThan(0)
    }
  })
  it('Vídeo e Fotografia: escalas e o material do último culto para enviar', () => {
    expect(pendingDeliveries(d, 'm-vitor', today)[0]?.role).toBe('Vídeo')
    expect(pendingDeliveries(d, 'm-carol', today)[0]?.role).toBe('Fotografia')
    expect(myUpcoming(d, 'm-vitor').length).toBeGreaterThan(0)
    expect(myUpcoming(d, 'm-carol').length).toBeGreaterThan(0)
  })
  it('Edição: uma arte e um vídeo em aberto, e entregas feitas', () => {
    expect(openTasks('m-julia').map((t) => t.kind ?? 'art').sort()).toEqual(['art', 'video'])
    expect((d.tasks ?? []).some((t) => t.assigneeId === 'm-julia' && t.status === 'done' && t.link)).toBe(true)
  })
  it('Stories: serviu num culto em que as fotos já chegaram', () => {
    const past = d.assignments.filter((a) => a.memberId === 'm-bianca' && a.role === 'Stories' && (d.events.find((e) => e.id === a.eventId)?.date ?? '') < today)
    expect(past.some((a) => d.assignments.some((b) => b.eventId === a.eventId && b.role === 'Fotografia' && b.delivery))).toBe(true)
  })
  it('News: Filmagem e Apresentação com convite; Filmagem deve as filmagens; Edição com o vídeo para entregar', () => {
    for (const id of ['m-davi', 'm-leo']) expect(d.assignments.find((a) => a.eventId === 'e-demo-news' && a.memberId === id)?.status).toBe('pending')
    expect(pendingDeliveries(d, 'm-davi', today)[0]?.role).toBe('Filmagem (News)')
    expect(openTasks('m-nina').map((t) => t.kind)).toEqual(['news'])
  })
})

describe('formulário de cadastro do Follow', () => {
  it('todas as equipes aparecem, em grupos', async () => {
    const { signupSections } = await import('../src/lib/signupTeams')
    const { ministries } = await import('../src/data/seed')
    const teams = ministries.find((m) => m.id === 'follow')!.roles.map((r) => r.name)
    const s = signupSections('follow', teams)
    expect(s.map((x) => x.title)).toEqual(['Nos cultos', 'Lagoinha News', 'Edição e site'])
    expect(s.flatMap((x) => x.teams.map((t) => t.name)).sort()).toEqual([...teams].sort())
    expect(s[1].teams.map((t) => t.label)).toEqual(['Filmagem', 'Apresentação', 'Edição'])
    // ministério sem layout: lista simples, sem título
    expect(signupSections('louvor', ['Voz', 'Teclado'])).toEqual([{ title: undefined, teams: [{ name: 'Voz', label: 'Voz' }, { name: 'Teclado', label: 'Teclado' }] }])
  })
})
