import type { AppData, Member } from '../data/types'
import type { ActionResult } from '../data/actions'
import { draftsOf } from './schedule'

/** Quem está no rascunho de um ministério (ou de um evento), antes de publicar */
export function draftPeople(data: AppData, ministryId: string, eventId?: string): Member[] {
  const ids = new Set(draftsOf(data, ministryId, eventId).map((a) => a.memberId))
  return data.members.filter((m) => ids.has(m.id))
}

/**
 * Mensagem depois de publicar: quantas escalas, em quantos celulares a notificação chegou
 * e quem foi escalado sem notificação ativa (essa pessoa só vê quando abrir o app).
 */
export function publishMessage(people: Member[], r: { ok: true; result: ActionResult } | { ok: false; error: string }): string {
  if (!r.ok) return r.error
  const n = r.result.created ?? 0
  if (!n) return 'Nada para publicar.'
  const head = `${n} ${n === 1 ? 'escala publicada' : 'escalas publicadas'} ✨`
  const pushed = r.result.pushed
  if (pushed === undefined) return `${head} ${people.length} ${people.length === 1 ? 'pessoa recebe' : 'pessoas recebem'} o aviso para confirmar.`
  const off = people.filter((m) => !m.pushOn)
  const names = off.slice(0, 4).map((m) => m.name.split(' ')[0]).join(', ') + (off.length > 4 ? ` e mais ${off.length - 4}` : '')
  return `${head} A notificação chegou em ${pushed} ${pushed === 1 ? 'celular' : 'celulares'}.`
    + (off.length ? ` Sem notificação ativa: ${names} (${off.length === 1 ? 'vê a escala quando abrir' : 'veem a escala quando abrirem'} o app).` : '')
}
