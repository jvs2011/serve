/*
 * Material enviado depois de servir: fotos (Fotografia), vídeo (Filmmaker), filmagens (Filmmaker do News).
 * Quem edita recebe o aviso (`RoleSlot.deliverTo`, ex.: Fotografia → Edição de fotos).
 * A função diz se tem material (`RoleSlot.delivery`, ex.: "as fotos"); o link fica na própria escala.
 */
import type { AppData, Assignment } from '../data/types.js'

/** O que a função envia depois de servir ("as fotos", "o vídeo"…), ou nada */
export function deliveryLabel(data: AppData, a: Pick<Assignment, 'ministryId' | 'role'>): string | undefined {
  return data.ministries.find((m) => m.id === a.ministryId)?.roles.find((r) => r.name === a.role)?.delivery
}

/** A escala ainda deve o material? (já aconteceu, não recusou, publicada, sem link) */
export function owesDelivery(data: AppData, a: Assignment, eventDate: string, today: string): boolean {
  return !!deliveryLabel(data, a) && !a.delivery && !a.draft && a.status !== 'declined' && eventDate <= today
}

/** Materiais que a pessoa ainda precisa enviar (cultos dos últimos `days` dias, inclusive hoje) */
export function pendingDeliveries(data: AppData, memberId: string, today: string, days = 14): Assignment[] {
  const [y, m, d] = today.split('-').map(Number)
  const from = new Date(y, m - 1, d - days)
  const fromISO = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
  const evs = new Map(data.events.map((e) => [e.id, e]))
  return data.assignments
    .filter((a) => {
      const ev = evs.get(a.eventId)
      return a.memberId === memberId && !!ev && ev.date >= fromISO && owesDelivery(data, a, ev.date, today)
    })
    .sort((a, b) => evs.get(b.eventId)!.date.localeCompare(evs.get(a.eventId)!.date))
}

/** Funções cujo material chega para a pessoa editar (ex.: quem é da Edição de fotos recebe o da Fotografia) */
export function materialToEdit(data: AppData, memberId: string): { ministryId: string; roles: string[] }[] {
  const me = data.members.find((m) => m.id === memberId)
  return (me?.ministries ?? []).map((mm) => ({
    ministryId: mm.ministryId,
    roles: (data.ministries.find((x) => x.id === mm.ministryId)?.roles ?? []).filter((r) => r.deliverTo && mm.roles.includes(r.deliverTo)).map((r) => r.name),
  })).filter((x) => x.roles.length)
}
