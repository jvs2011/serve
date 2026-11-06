/*
 * Decide quem recebe notificação comparando os dados antes e depois de uma alteração.
 * Assim qualquer caminho (escalar à mão, escala automática, troca…) avisa as pessoas certas.
 */
import type { AppData, Assignment, ChurchEvent } from '../src/data/types.js'
import type { PushPayload } from './push.js'
import { isOff } from '../src/lib/schedule.js'

export interface Outgoing { to: string[]; payload: PushPayload }

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function when(ev: ChurchEvent): string {
  const [y, m, d] = ev.date.split('-').map(Number)
  const wd = WD[new Date(y, m - 1, d).getDay()]
  const time = ev.allDay ? 'dia todo' : ev.time ? `às ${ev.time}` : ''
  return `${wd}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}${time ? ` ${time}` : ''}`
}

const first = (name?: string) => name?.split(' ')[0] ?? 'Alguém'

export function notificationsFor(before: AppData, after: AppData, actorId: string, today: string): Outgoing[] {
  const out: Outgoing[] = []
  const ev = (id: string) => after.events.find((e) => e.id === id)
  const min = (id: string) => after.ministries.find((m) => m.id === id)
  const member = (id: string) => after.members.find((m) => m.id === id)
  const prevA = new Map(before.assignments.map((a) => [a.id, a]))
  const prevSwaps = new Map(before.swaps.map((s) => [s.id, s]))
  const future = (a: Assignment) => (ev(a.eventId)?.date ?? '') >= today

  // 1) novas escalas (à mão ou automática), agrupadas por pessoa
  const fresh = new Map<string, Assignment[]>()
  for (const a of after.assignments) {
    if (prevA.has(a.id) || a.memberId === actorId || !future(a)) continue
    // troca assumida também muda o dono, mas é tratada abaixo
    fresh.set(a.memberId, [...(fresh.get(a.memberId) ?? []), a])
  }
  for (const [memberId, list] of fresh) {
    const lines = list
      .map((a) => ({ a, e: ev(a.eventId)! }))
      .sort((x, y) => x.e.date.localeCompare(y.e.date) || x.e.time.localeCompare(y.e.time))
    const top = lines[0]
    out.push({
      to: [memberId],
      payload: list.length === 1
        ? { title: 'Você foi escalado 🙌', body: `${top.e.title} · ${when(top.e)}\n${min(top.a.ministryId)?.name} · ${top.a.role}. Toque para confirmar.`, tag: `escala-${top.a.id}` }
        : { title: `Você tem ${list.length} novas escalas`, body: lines.slice(0, 3).map((x) => `${x.e.title} · ${when(x.e)} (${x.a.role})`).join('\n') + (list.length > 3 ? '\n…' : ''), tag: 'escalas' },
    })
  }

  // 2) recusa → líderes do ministério
  for (const a of after.assignments) {
    const p = prevA.get(a.id)
    if (!p || p.status === 'declined' || a.status !== 'declined' || !future(a)) continue
    const e = ev(a.eventId)!
    const m = min(a.ministryId)
    out.push({
      to: (m?.leaderIds ?? []).filter((id) => id !== actorId),
      payload: { title: 'Escala recusada', body: `${member(a.memberId)?.name ?? 'Alguém'} não pode servir como ${a.role} no ${e.title} (${when(e)}). Escale outra pessoa.`, tag: `recusa-${a.id}` },
    })
  }

  for (const s of after.swaps) {
    const p = prevSwaps.get(s.id)
    const a = after.assignments.find((x) => x.id === s.assignmentId)
    const e = a && ev(a.eventId)
    if (!a || !e || e.date < today) continue

    // 3) novo pedido de troca → quem tem a mesma função e está livre
    if (!p && s.status === 'open') {
      const busy = new Set(after.assignments.filter((x) => x.eventId === a.eventId && x.status !== 'declined').map((x) => x.memberId))
      const to = after.members
        .filter((m) => m.id !== s.fromMemberId && !busy.has(m.id))
        .filter((m) => m.ministries.some((mm) => mm.ministryId === a.ministryId && mm.roles.includes(a.role)))
        .filter((m) => !isOff(after, m, e))
        .map((m) => m.id)
      out.push({
        to,
        payload: { title: 'Pedido de troca', body: `${first(member(s.fromMemberId)?.name)} precisa de alguém para ${a.role} no ${e.title} (${when(e)}). Você pode assumir?`, tag: `troca-${s.id}` },
      })
    }

    // 4) troca assumida → quem pediu
    if (p?.status === 'open' && s.status === 'accepted') {
      out.push({
        to: [s.fromMemberId],
        payload: { title: 'Troca resolvida 🙌', body: `${first(member(s.acceptedById ?? '')?.name)} assumiu sua escala de ${a.role} no ${e.title} (${when(e)}).`, tag: `troca-${s.id}` },
      })
    }
  }

  // 5) novo aviso → membros do ministério (ou todos, se for geral)
  const prevNotices = new Set(before.notices.map((n) => n.id))
  for (const n of after.notices) {
    if (prevNotices.has(n.id)) continue
    const to = after.members
      .filter((m) => m.id !== n.authorId && (n.ministryId === null || m.ministries.some((mm) => mm.ministryId === n.ministryId)))
      .map((m) => m.id)
    out.push({
      to,
      payload: { title: `${n.ministryId ? min(n.ministryId)?.name : 'Lagoinha Franca'}: ${n.title}`, body: n.body.length > 160 ? n.body.slice(0, 157) + '…' : n.body, tag: `aviso-${n.id}` },
    })
  }

  return out.filter((o) => o.to.length > 0)
}

/** Lembretes da véspera: uma notificação por pessoa com as escalas de amanhã */
export function remindersFor(data: AppData, tomorrow: string): Outgoing[] {
  const byMember = new Map<string, { a: Assignment; e: ChurchEvent }[]>()
  for (const a of data.assignments) {
    if (a.status === 'declined') continue
    const e = data.events.find((x) => x.id === a.eventId)
    if (!e || e.date !== tomorrow) continue
    byMember.set(a.memberId, [...(byMember.get(a.memberId) ?? []), { a, e }])
  }
  return [...byMember].map(([memberId, list]) => {
    list.sort((x, y) => x.e.time.localeCompare(y.e.time))
    const ministry = (id: string) => data.ministries.find((m) => m.id === id)?.name
    const pending = list.some((x) => x.a.status === 'pending')
    return {
      to: [memberId],
      payload: {
        title: 'Amanhã você serve 🙏',
        body: list.map((x) => `${x.e.title}${x.e.time ? ` às ${x.e.time}` : ''} · ${ministry(x.a.ministryId)} · ${x.a.role}`).join('\n') + (pending ? '\nVocê ainda não confirmou: toque para confirmar.' : ''),
        tag: `lembrete-${tomorrow}`,
      },
    }
  })
}
