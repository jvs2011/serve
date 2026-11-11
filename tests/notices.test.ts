import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/data/seed'
import { applyAction } from '../src/data/actions'
import { addDays, toISO, todayISO } from '../src/lib/dates'
import { noticeActive } from '../src/lib/selectors'
import { noticeStatus } from '../src/components/NoticeBits'

const today = todayISO()
const inDays = (n: number) => toISO(addDays(new Date(), n))

describe('avisos: até quando fica ativo, retirar e excluir', () => {
  it('aviso com data fica ativo até o último dia e depois sai sozinho', () => {
    const d = createSeed()
    applyAction(d, { type: 'addNotice', ministryId: 'follow', title: 'Reunião', body: 'Sábado à tarde', until: inDays(3) }, 'm-rafaela')
    const n = d.notices[0]
    expect(n.until).toBe(inDays(3))
    expect(noticeActive(n, today)).toBe(true)
    expect(noticeActive(n, inDays(3))).toBe(true)
    expect(noticeActive(n, inDays(4))).toBe(false)
    expect(noticeStatus(n, inDays(4)).text).toMatch(/Encerrado/)
  })

  it('data no passado ou inválida vira aviso sem data de término', () => {
    const d = createSeed()
    applyAction(d, { type: 'addNotice', ministryId: 'follow', title: 'A', body: 'B', until: inDays(-2) }, 'm-rafaela')
    expect(d.notices[0].until).toBeUndefined()
    applyAction(d, { type: 'addNotice', ministryId: 'follow', title: 'A', body: 'B', until: 'amanhã' }, 'm-rafaela')
    expect(d.notices[0].until).toBeUndefined()
  })

  it('retirar some para a equipe; mostrar de novo e mudar a data', () => {
    const d = createSeed()
    applyAction(d, { type: 'addNotice', ministryId: 'follow', title: 'A', body: 'B', until: inDays(7) }, 'm-rafaela')
    const id = d.notices[0].id
    applyAction(d, { type: 'archiveNotice', noticeId: id, archived: true }, 'm-rafaela')
    expect(noticeActive(d.notices[0], today)).toBe(false)
    expect(noticeStatus(d.notices[0]).text).toMatch(/Retirado/)
    applyAction(d, { type: 'archiveNotice', noticeId: id, archived: false, until: inDays(20) }, 'm-rafaela')
    expect(noticeActive(d.notices[0], today)).toBe(true)
    expect(d.notices[0].until).toBe(inDays(20))
    // sem data: fica até alguém retirar
    applyAction(d, { type: 'archiveNotice', noticeId: id, archived: false, until: '' }, 'm-rafaela')
    expect(d.notices[0].until).toBeUndefined()
  })

  it('excluir apaga de vez; só quem lidera o ministério (ou a coordenação) mexe', () => {
    const d = createSeed()
    applyAction(d, { type: 'addNotice', ministryId: 'follow', title: 'A', body: 'B' }, 'm-rafaela')
    const id = d.notices[0].id
    expect(() => applyAction(d, { type: 'removeNotice', noticeId: id }, 'm-bruno')).toThrow(/permissão/)
    expect(() => applyAction(d, { type: 'archiveNotice', noticeId: id, archived: true }, 'm-mariana')).toThrow(/permissão/)
    applyAction(d, { type: 'removeNotice', noticeId: id }, 'm-rafaela')
    expect(d.notices.some((n) => n.id === id)).toBe(false)
    // aviso da igreja: só a coordenação
    applyAction(d, { type: 'addNotice', ministryId: null, title: 'Igreja', body: 'Geral' }, 'm-lucas')
    expect(() => applyAction(d, { type: 'archiveNotice', noticeId: d.notices[0].id, archived: true }, 'm-rafaela')).toThrow(/permissão/)
    applyAction(d, { type: 'archiveNotice', noticeId: d.notices[0].id, archived: true }, 'm-lucas')
    expect(d.notices[0].archivedAt).toBeTruthy()
  })
})
