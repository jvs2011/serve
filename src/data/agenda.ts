/*
 * Cultos e encontros fixos da semana (agenda fixa).
 * Ficam nos dados (`AppData.weekly`) e a coordenação edita pelo app.
 * Os eventos de cada data são gerados a partir daqui e guardam o `slotId` de origem,
 * então editar um culto fixo atualiza os próximos eventos sem perder as escalas.
 */
import type { AppData, ChurchEvent, WeeklySlot } from './types.js'
import { addDays, fromISO, toISO } from '../lib/dates.js'

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const TEMPLO = ['louvor', 'follow', 'diaconato', 'centurioes', 'intercessao', 'consolidacao']
const DOMINGO = [...TEMPLO, 'kids']
const T = { place: 'Templo' }

/** Agenda fixa da Lagoinha Franca (ponto de partida; depois a coordenação edita no app) */
export const DEFAULT_WEEKLY: WeeklySlot[] = [
  { id: 'dom-manha-ceia', day: 0, time: '09:30', title: 'Culto de Ceia', ministryIds: DOMINGO, weeks: [2], ...T },
  { id: 'dom-manha', day: 0, time: '09:30', title: 'Culto de Celebração', ministryIds: DOMINGO, weeks: [1, 3, 4, 5], ...T },
  { id: 'dom-noite-ceia', day: 0, time: '18:30', title: 'Culto de Ceia', ministryIds: DOMINGO, weeks: [1], ...T },
  { id: 'dom-noite', day: 0, time: '18:30', title: 'Culto de Celebração', ministryIds: DOMINGO, weeks: [2, 3, 4, 5], ...T },
  { id: 'seg-carisma', day: 1, time: '20:00', endTime: '21:30', title: 'Carisma', ministryIds: ['carisma'], place: 'Templo e sala "Carisma"', activity: 'Curso' },
  { id: 'seg-restaurar', day: 1, time: '20:00', endTime: '21:30', title: 'Restaurar Homem', ministryIds: [], place: 'Sala "Na Mesa"', activity: 'Curso' },
  { id: 'ter-link', day: 2, time: '19:30', endTime: '21:00', title: 'Link', ministryIds: ['link'], place: 'Garagem', activity: 'GC' },
  { id: 'qua-restaurar', day: 3, time: '18:30', endTime: '20:00', title: 'Restaurar Mulher', ministryIds: [], place: 'Sala "Na Mesa"', activity: 'Curso' },
  { id: 'qua-clamor', day: 3, time: '20:00', title: 'Culto Fé – Louvor e Clamor', ministryIds: TEMPLO, weeks: [1], ...T },
  { id: 'qua-fe', day: 3, time: '20:00', title: 'Culto Fé', ministryIds: TEMPLO, weeks: [2], ...T },
  { id: 'qua-geracoes', day: 3, time: '20:00', title: 'Culto Fé – Gerações', ministryIds: TEMPLO, weeks: [3], responsible: 'Equipe Bem Casados', ...T },
  { id: 'qua-carisma', day: 3, time: '20:00', title: 'Culto Fé – Carisma', ministryIds: TEMPLO, weeks: [4], responsible: 'Pr. Alexandre', ...T },
  { id: 'qua-shine', day: 3, time: '20:00', title: 'Culto Shine', ministryIds: TEMPLO, weeks: [5], months: [4, 7, 9], responsible: 'Ministério Shine', ...T },
  { id: 'qua-fe-5', day: 3, time: '20:00', title: 'Culto Fé', ministryIds: TEMPLO, weeks: [5], months: [1, 2, 3, 5, 6, 8, 10, 11, 12], ...T },
  { id: 'qui-shine', day: 4, time: '19:30', endTime: '21:30', title: 'Shine', ministryIds: ['shine'], place: 'Sala "Na Mesa"', activity: 'Curso Experiência do Lar' },
  { id: 'sex-sala', day: 5, time: '20:00', endTime: '21:30', title: 'Sala de Adoração', ministryIds: ['louvor'], place: 'Garagem', activity: 'Louvor', biweekly: '2026-01-02' },
  { id: 'sab-dna', day: 6, time: '08:30', endTime: '11:00', title: 'Ensaio DNA', ministryIds: [], place: 'Templo', activity: 'Ensaio' },
  { id: 'sab-rocket', day: 6, time: '19:30', endTime: '21:00', title: 'Culto Rocket', ministryIds: ['rocket'], place: 'Templo', activity: 'Culto' },
  { id: 'sab-legacy', day: 6, time: '19:30', endTime: '21:30', title: 'Culto Legacy', ministryIds: ['legacy'], place: 'Prédio Kids', activity: 'Culto' },
]

export const slug = (s: string) => s.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()
export const eventId = (iso: string, time: string, title: string) => `e-${iso}-${time.replace(':', '')}-${slug(title)}`

/** O culto fixo acontece nesta data? */
export function slotOn(slot: WeeklySlot, d: Date): boolean {
  if (d.getDay() !== slot.day) return false
  if (slot.months?.length && !slot.months.includes(d.getMonth() + 1)) return false
  if (slot.biweekly) {
    const weeks = Math.round((d.getTime() - fromISO(slot.biweekly).getTime()) / 86_400_000 / 7)
    return weeks % 2 === 0
  }
  const nth = Math.ceil(d.getDate() / 7) // 1ª, 2ª… ocorrência do dia da semana no mês
  return !slot.weeks?.length || slot.weeks.includes(nth)
}

/** Eventos gerados pela agenda fixa entre duas datas (inclusivas) */
export function weeklyEvents(weekly: WeeklySlot[], fromDate: string, toDate: string): ChurchEvent[] {
  const out: ChurchEvent[] = []
  for (let d = fromISO(fromDate); toISO(d) <= toDate; d = addDays(d, 1)) {
    for (const s of weekly) {
      if (!slotOn(s, d)) continue
      const iso = toISO(d)
      out.push({
        id: eventId(iso, s.time, s.title), slotId: s.id, title: s.title, date: iso, time: s.time,
        ministryIds: [...s.ministryIds], setlist: [], ...slotFields(s),
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

/** Campos do evento que vêm do culto fixo (o resto é do próprio evento) */
function slotFields(s: WeeklySlot): Partial<ChurchEvent> {
  return {
    ...(s.endTime ? { endTime: s.endTime } : {}),
    ...(s.place ? { place: s.place } : {}),
    ...(s.activity ? { activity: s.activity } : {}),
    ...(s.responsible ? { responsible: s.responsible } : {}),
  }
}

/** Texto curto da frequência: "toda semana", "2ª semana do mês", "a cada 15 dias"… */
export function frequencyLabel(s: WeeklySlot): string {
  let base: string
  if (s.biweekly) base = 'a cada 15 dias'
  else if (!s.weeks?.length || s.weeks.length === 5) base = 'toda semana'
  else {
    // "2º domingo do mês", "1ª e 3ª quartas do mês"
    const male = s.day === 0 || s.day === 6
    const name = WEEKDAYS[s.day].toLowerCase()
    const nums = s.weeks.map((w) => `${w}${male ? 'º' : 'ª'}`).join(', ').replace(/, ([^,]*)$/, ' e $1')
    base = `${nums} ${s.weeks.length === 1 ? name : `${name}s`} do mês`
  }
  if (s.months?.length && s.months.length < 12) base += ` · ${s.months.map((m) => MONTHS[m - 1]).join(', ')}`
  return base
}

export interface WeeklyChange { added: number; updated: number; removed: number; droppedAssignments: number }

/**
 * Aplica a agenda fixa aos eventos de hoje em diante (até onde a agenda já foi gerada):
 * atualiza os eventos de cada culto fixo, cria os que faltam e tira os que deixaram de existir.
 * Eventos ajustados à mão (editados) ou especiais ficam como estão.
 */
export function applyWeekly(d: AppData, today: string): WeeklyChange {
  const change: WeeklyChange = { added: 0, updated: 0, removed: 0, droppedAssignments: 0 }
  const weekly = d.weekly ?? []
  const until = d.generatedUntil ?? toISO(addDays(fromISO(today), 70))
  if (until < today) return change
  const skipped = new Set(d.skipped ?? [])
  const gen = weeklyEvents(weekly, today, until).filter((e) => !skipped.has(`${e.slotId}|${e.date}`))
  const genKeys = new Set(gen.map((e) => `${e.slotId}|${e.date}`))
  const byKey = new Map(d.events.filter((e) => e.slotId && e.date >= today).map((e) => [`${e.slotId}|${e.date}`, e]))
  const ids = new Set(d.events.map((e) => e.id))
  const dropAssignments = (pred: (a: AppData['assignments'][number]) => boolean) => {
    const gone = new Set(d.assignments.filter(pred).map((a) => a.id))
    if (!gone.size) return
    d.assignments = d.assignments.filter((a) => !gone.has(a.id))
    d.swaps = d.swaps.filter((s) => !gone.has(s.assignmentId))
    change.droppedAssignments += gone.size
  }

  for (const g of gen) {
    const cur = byKey.get(`${g.slotId}|${g.date}`)
    if (!cur) {
      if (ids.has(g.id)) continue
      d.events.push(g)
      ids.add(g.id)
      change.added++
      continue
    }
    if (cur.special || cur.edited) continue
    const next = { title: g.title, time: g.time, endTime: g.endTime, place: g.place, activity: g.activity, responsible: g.responsible, ministryIds: g.ministryIds }
    const before = JSON.stringify([cur.title, cur.time, cur.endTime, cur.place, cur.activity, cur.responsible, cur.ministryIds])
    if (before === JSON.stringify([next.title, next.time, next.endTime, next.place, next.activity, next.responsible, next.ministryIds])) continue
    const removedMins = cur.ministryIds.filter((id) => !next.ministryIds.includes(id))
    if (removedMins.length) dropAssignments((a) => a.eventId === cur.id && removedMins.includes(a.ministryId))
    Object.assign(cur, next)
    for (const k of ['endTime', 'place', 'activity', 'responsible'] as const) if (cur[k] === undefined) delete cur[k]
    change.updated++
  }

  // eventos de cultos fixos que não acontecem mais nessa data (culto removido ou frequência mudou)
  const stale = new Set(
    d.events.filter((e) => e.slotId && e.date >= today && e.date <= until && !e.special && !e.edited && !genKeys.has(`${e.slotId}|${e.date}`)).map((e) => e.id),
  )
  if (stale.size) {
    dropAssignments((a) => stale.has(a.eventId))
    d.events = d.events.filter((e) => !stale.has(e.id))
    for (const t of d.tasks ?? []) if (t.eventId && stale.has(t.eventId)) t.eventId = undefined
    change.removed += stale.size
  }
  d.events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return change
}

/** Cultos fixos da semana para a pessoa marcar os que não consegue servir (um por dia + horário) */
export interface RecurringSlot { key: string; day: string; time: string; title: string; ministryIds: string[] }

export function recurringSlots(weekly: WeeklySlot[]): RecurringSlot[] {
  const groups = new Map<string, WeeklySlot[]>()
  for (const s of weekly) {
    if (!s.ministryIds.length) continue
    const key = `${s.day}-${s.time}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  return [...groups].map(([key, list]) => {
    // título que mais se repete no mês (ex.: "Culto de Celebração" em vez de "Culto de Ceia")
    const freq = new Map<string, number>()
    for (const s of list) freq.set(s.title, (freq.get(s.title) ?? 0) + (s.weeks?.length || 5))
    const max = Math.max(...freq.values())
    const titles = [...freq].filter(([, n]) => n === max).map(([t]) => t)
    const [h, m] = list[0].time.split(':')
    return {
      key,
      day: WEEKDAYS[list[0].day],
      time: `${Number(h)}h${m === '00' ? '' : m}`,
      title: titles.join(' e ') + (list.every((s) => s.biweekly) ? ' (quinzenal)' : ''),
      ministryIds: [...new Set(list.flatMap((s) => s.ministryIds))],
    }
  }).sort((a, b) => order(a.key) - order(b.key))
}
// domingo primeiro, depois segunda… sábado; no mesmo dia, pelo horário
const order = (key: string) => Number(key.split('-')[0]) * 10000 + Number(key.split('-')[1].replace(':', ''))
