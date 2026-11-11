/*
 * Decide quem recebe notificação comparando os dados antes e depois de uma alteração.
 * Assim qualquer caminho (escalar à mão, escala automática, troca…) avisa as pessoas certas.
 */
import type { AppData, Assignment, ChurchEvent } from '../src/data/types.js'
import type { PushPayload } from './push.js'
import { isOff, openSlots } from '../src/lib/schedule.js'
import { projectionEvents, projectionTeam } from '../src/lib/projection.js'
import { deliveryLabel } from '../src/lib/delivery.js'
import { kindOf, REQUEST_KINDS } from '../src/lib/requests.js'

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
    // escala nova publicada, ou rascunho que acabou de ser publicado
    const p = prevA.get(a.id)
    if (a.draft || (p && !p.draft) || a.memberId === actorId || !future(a)) continue
    // troca assumida também muda o dono, mas é tratada abaixo
    fresh.set(a.memberId, [...(fresh.get(a.memberId) ?? []), a])
  }
  const groupName = (a: Assignment) => {
    const g = a.groupId && min(a.ministryId)?.groups?.find((x) => x.id === a.groupId)
    return g ? ` (${g.name})` : ''
  }
  for (const [memberId, list] of fresh) {
    const lines = list
      .map((a) => ({ a, e: ev(a.eventId)! }))
      .sort((x, y) => x.e.date.localeCompare(y.e.date) || x.e.time.localeCompare(y.e.time))
    const top = lines[0]
    out.push({
      to: [memberId],
      payload: list.length === 1 && top.e.slots
        ? { title: `Convite: ${top.e.title} 🎬`, body: `${when(top.e)}${top.e.place ? ` · ${top.e.place}` : ''}\nVocê consegue participar? Toque para confirmar.`, tag: `escala-${top.a.id}` }
        : list.length === 1
        ? { title: 'Você foi escalado 🙌', body: `${top.e.title} · ${when(top.e)}\n${min(top.a.ministryId)?.name} · ${top.a.role}${groupName(top.a)}. Toque para confirmar.`, tag: `escala-${top.a.id}` }
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

  // 5) novo aviso → membros do ministério (ou todos, se for geral) e também quem publicou
  //    (serve de confirmação de que saiu, mesmo que a pessoa não seja do ministério)
  const prevNotices = new Set(before.notices.map((n) => n.id))
  for (const n of after.notices) {
    if (prevNotices.has(n.id)) continue
    const to = [...new Set([
      ...after.members.filter((m) => n.ministryId === null || m.ministries.some((mm) => mm.ministryId === n.ministryId)).map((m) => m.id),
      n.authorId,
    ])]
    out.push({
      to,
      payload: { title: `${n.ministryId ? min(n.ministryId)?.name : 'Lagoinha Franca'}: ${n.title}`, body: n.body.length > 160 ? n.body.slice(0, 157) + '…' : n.body, tag: `aviso-${n.id}` },
    })
  }

  // 6) demandas (artes): nova ou com outro responsável → responsável; entregue → líderes
  const prevTasks = new Map((before.tasks ?? []).map((t) => [t.id, t]))
  for (const t of after.tasks ?? []) {
    const p = prevTasks.get(t.id)
    const m = min(t.ministryId)
    if ((!p || p.assigneeId !== t.assigneeId) && t.status === 'open' && t.assigneeId !== actorId) {
      out.push({
        to: [t.assigneeId],
        payload: { title: REQUEST_KINDS[kindOf(t)].newTitle, body: `${t.title}\n${dueText(t.dueDate, today)}. Toque para ver os detalhes.`, tag: `arte-${t.id}` },
      })
    }
    if (p && p.status !== 'done' && t.status === 'done') {
      out.push({
        to: (m?.leaderIds ?? []).filter((id) => id !== actorId),
        payload: { title: REQUEST_KINDS[kindOf(t)].doneTitle, body: `${member(t.assigneeId)?.name ?? 'Alguém'} entregou: ${t.title}`, tag: `arte-${t.id}` },
      })
      // vai para a projeção: a equipe escalada no(s) culto(s) recebe o link (o News: manhã e noite do domingo)
      const evs = projectionEvents(after, t).filter((e) => e.date >= today)
      if (evs.length) {
        const e = evs[0]
        const where = t.kind === 'news' && evs.length > 1 ? `nos cultos de ${when(e).split(' ')[0]} ${when(e).split(' ')[1]}` : `na escala do ${e.title} (${when(e)})`
        out.push({
          to: [...new Set(evs.flatMap((x) => projectionTeam(after, x.id)))].filter((id) => id !== actorId && !(m?.leaderIds ?? []).includes(id)),
          payload: { title: 'Para a projeção 🎬', body: `${t.kind === 'news' ? 'O vídeo do Lagoinha News' : t.title} já está ${where}. Toque para abrir.`, tag: `projecao-${t.id}` },
        })
      }
    }
  }

  // 7) evento mudou de dia, horário ou local, ou foi cancelado → quem está escalado (uma notificação por pessoa)
  const changes = new Map<string, string[]>()
  const addChange = (memberId: string, line: string) => changes.set(memberId, [...(changes.get(memberId) ?? []), line])
  const people = (data: AppData, eventId: string) =>
    [...new Set(data.assignments.filter((a) => a.eventId === eventId && !a.draft && a.status !== 'declined' && a.memberId !== actorId).map((a) => a.memberId))]
  const afterEvents = new Map(after.events.map((e) => [e.id, e]))
  for (const old of before.events) {
    if (old.date < today) continue
    const cur = afterEvents.get(old.id)
    if (!cur) {
      for (const id of people(before, old.id)) addChange(id, `${old.title} (${when(old)}) foi cancelado`)
      continue
    }
    if (old.date === cur.date && old.time === cur.time && (old.place ?? '') === (cur.place ?? '')) continue
    const what = old.date !== cur.date || old.time !== cur.time ? `agora ${when(cur)}` : `agora em ${cur.place || 'Lagoinha Franca'}`
    for (const id of people(after, cur.id)) addChange(id, `${cur.title}: ${what}${old.date !== cur.date || old.time !== cur.time ? (cur.place ? ` · ${cur.place}` : '') : ''}`)
  }
  for (const [memberId, lines] of changes) {
    out.push({
      to: [memberId],
      payload: {
        title: lines.length === 1 ? 'Mudança na sua escala' : `${lines.length} mudanças nas suas escalas`,
        body: lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n…' : ''),
        tag: `mudanca-${today}-${memberId}`,
      },
    })
  }

  // 10) o líder mudou as funções da pessoa no ministério → a pessoa (só quando a pessoa já existia e não é quem mudou)
  for (const m of after.members) {
    if (m.id === actorId) continue
    const prev = before.members.find((x) => x.id === m.id)
    if (!prev) continue
    for (const mm of m.ministries) {
      const old = prev.ministries.find((x) => x.ministryId === mm.ministryId)
      if (!old || old.roles.join('|') === mm.roles.join('|')) continue
      const name = min(mm.ministryId)?.name ?? 'ministério'
      out.push({
        to: [m.id],
        payload: {
          title: `Suas funções no ${name}`,
          body: mm.roles.length ? `Agora você serve em: ${mm.roles.join(', ')}. Toque para ver suas escalas.` : `Você está sem função no ${name} por enquanto. Fale com a liderança se for um engano.`,
          tag: `funcoes-${mm.ministryId}-${m.id}`,
        },
      })
    }
  }

  // 9) material enviado (fotos, vídeo, filmagens) → líderes e a edição daquele material
  //    (Fotografia → Edição de fotos, Filmmaker → Edição de vídeos, Filmmaker do News → Edição do News)
  for (const a of after.assignments) {
    const p = prevA.get(a.id)
    if (!a.delivery || (p?.delivery?.link === a.delivery.link)) continue
    const e = ev(a.eventId)
    const label = deliveryLabel(after, a)
    if (!e || !label) continue
    const editRole = min(a.ministryId)?.roles.find((r) => r.name === a.role)?.deliverTo
    const editors = editRole
      ? after.members.filter((m) => m.ministries.some((mm) => mm.ministryId === a.ministryId && mm.roles.includes(editRole))).map((m) => m.id)
      : []
    out.push({
      to: [...new Set([...(min(a.ministryId)?.leaderIds ?? []), ...editors])].filter((id) => id !== actorId && id !== a.memberId),
      payload: { title: 'Material enviado 📸', body: `${first(member(a.memberId)?.name)} enviou ${label} do ${e.title} (${when(e)}). Toque para abrir.`, tag: `material-${a.id}` },
    })
  }

  // 8) repertório enviado → equipe do Louvor escalada no culto
  const beforeEvents = new Map(before.events.map((e) => [e.id, e]))
  for (const e of after.events) {
    if (!e.setlistSentAt || beforeEvents.get(e.id)?.setlistSentAt === e.setlistSentAt) continue
    // Louvor e a Projeção escalados no culto
    const to = [...new Set([
      ...after.assignments.filter((a) => a.eventId === e.id && a.ministryId === 'louvor' && !a.draft && a.status !== 'declined').map((a) => a.memberId),
      ...projectionTeam(after, e.id),
    ])].filter((id) => id !== actorId)
    out.push({
      to,
      payload: {
        title: `Repertório · ${e.title} 🎶`,
        body: `${when(e)}\n` + e.setlist.slice(0, 6).map((x, i) => `${i + 1}. ${x.title} (${x.key})`).join('\n') + (e.setlist.length > 6 ? '\n…' : ''),
        tag: `repertorio-${e.id}`,
      },
    })
  }

  return out.filter((o) => o.to.length > 0)
}

/** Líderes: vagas ainda abertas nos cultos dos próximos dias */
export function openSlotsAlertsFor(data: AppData, from: string, until: string): Outgoing[] {
  const out: Outgoing[] = []
  const events = data.events.filter((e) => e.date >= from && e.date <= until).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  for (const m of data.ministries) {
    const lines: string[] = []
    let total = 0
    for (const e of events) {
      if (!e.ministryIds.includes(m.id)) continue
      const open = openSlots(data, e.id, m.id)
      const n = open.reduce((s, x) => s + x.missing, 0)
      if (!n) continue
      total += n
      lines.push(`${e.title} (${when(e)}): ${open.map((x) => (x.missing > 1 ? `${x.missing} ${x.role}` : x.role)).join(', ')}`)
    }
    if (!total) continue
    out.push({
      to: m.leaderIds,
      payload: {
        title: `${m.name}: ${total} ${total === 1 ? 'vaga aberta' : 'vagas abertas'}`,
        body: lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n…' : '') + '\nToque para escalar.',
        tag: `vagas-${m.id}-${from}`,
      },
    })
  }
  return out.filter((o) => o.to.length > 0)
}

/** Quem ainda não confirmou uma escala que acontece em `date` (alguns dias antes) */
export function confirmRemindersFor(data: AppData, date: string): Outgoing[] {
  const by = new Map<string, { a: Assignment; e: ChurchEvent }[]>()
  for (const a of data.assignments) {
    if (a.status !== 'pending' || a.draft) continue
    const e = data.events.find((x) => x.id === a.eventId)
    if (!e || e.date !== date) continue
    by.set(a.memberId, [...(by.get(a.memberId) ?? []), { a, e }])
  }
  return [...by].map(([memberId, list]) => ({
    to: [memberId],
    payload: {
      title: 'Você ainda não confirmou ⏳',
      body: list.map((x) => `${x.e.title} · ${when(x.e)} · ${x.a.role}`).join('\n') + '\nToque para confirmar ou avisar que não pode.',
      tag: `confirmar-${date}`,
    },
  }))
}

function dueText(due: string, today: string): string {
  const [y, m, d] = due.split('-').map(Number)
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
  const ddmm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return diff <= 0 ? `Entrega hoje (${ddmm})` : diff === 1 ? `Entrega amanhã (${ddmm})` : `Entrega até ${WD[new Date(y, m - 1, d).getDay()]}, ${ddmm}`
}

/** Lembrete na véspera do prazo das demandas em aberto */
export function taskRemindersFor(data: AppData, tomorrow: string): Outgoing[] {
  const by = new Map<string, NonNullable<AppData['tasks']>>()
  for (const t of data.tasks ?? []) {
    if (t.status !== 'open' || t.dueDate !== tomorrow) continue
    by.set(t.assigneeId, [...(by.get(t.assigneeId) ?? []), t])
  }
  return [...by].map(([memberId, tasks]) => ({
    to: [memberId],
    payload: {
      // "Arte para amanhã 🎨", "Fotos para amanhã 📸", "Vídeo do News para amanhã 🎬"
      title: tasks.length === 1 ? `${REQUEST_KINDS[kindOf(tasks[0])].prefix} para amanhã ${REQUEST_KINDS[kindOf(tasks[0])].emoji}` : `${tasks.length} entregas para amanhã`,
      body: tasks.map((t) => t.title).join('\n') + '\nQuando terminar, marque como entregue no app.',
      tag: `arte-lembrete-${tomorrow}`,
    },
  }))
}

/** Lembretes da véspera: uma notificação por pessoa com as escalas de amanhã */
export function remindersFor(data: AppData, tomorrow: string): Outgoing[] {
  const byMember = new Map<string, { a: Assignment; e: ChurchEvent }[]>()
  for (const a of data.assignments) {
    if (a.status === 'declined' || a.draft) continue
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

/** Líderes com escala em rascunho para os próximos dias: lembra de publicar */
export function draftRemindersFor(data: AppData, from: string, until: string): Outgoing[] {
  const out: Outgoing[] = []
  for (const m of data.ministries) {
    const drafts = data.assignments.filter((a) => {
      if (!a.draft || a.ministryId !== m.id) return false
      const e = data.events.find((x) => x.id === a.eventId)
      return !!e && e.date >= from && e.date <= until
    })
    if (!drafts.length) continue
    out.push({
      to: m.leaderIds,
      payload: {
        title: `${m.name}: escala ainda em rascunho`,
        body: `${drafts.length} ${drafts.length === 1 ? 'escala dos próximos dias ainda não foi publicada' : 'escalas dos próximos dias ainda não foram publicadas'}. A equipe só fica sabendo quando você publicar.`,
        tag: `rascunho-${m.id}-${from}`,
      },
    })
  }
  return out.filter((o) => o.to.length > 0)
}

/** Quem serviu ontem numa função com material (fotos, vídeo, filmagens) e ainda não enviou */
export function deliveryRemindersFor(data: AppData, yesterday: string): Outgoing[] {
  const out: Outgoing[] = []
  for (const a of data.assignments) {
    const e = data.events.find((x) => x.id === a.eventId)
    const label = deliveryLabel(data, a)
    if (!e || e.date !== yesterday || !label || a.delivery || a.draft || a.status === 'declined') continue
    out.push({
      to: [a.memberId],
      payload: { title: `Envie ${label} 📸`, body: `${e.title} de ontem: coloque o link (Drive, WeTransfer…) no app. A equipe está esperando.`, tag: `material-${a.id}` },
    })
  }
  return out
}
