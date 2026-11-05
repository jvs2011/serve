const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function weekday(iso: string): string {
  return WEEKDAYS[fromISO(iso).getDay()]
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[fromISO(iso).getDay()]
}

export function dayNum(iso: string): number {
  return fromISO(iso).getDate()
}

export function monthShort(iso: string): string {
  return MONTHS_SHORT[fromISO(iso).getMonth()]
}

export function monthLong(month: number): string {
  return MONTHS[month]
}

/** "domingo, 9 de novembro" */
export function longDate(iso: string): string {
  const d = fromISO(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** "Hoje", "Amanhã", "Em 3 dias" ou "dom, 9 nov" */
export function relativeDay(iso: string): string {
  const diff = daysBetween(todayISO(), iso)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff > 1 && diff < 7) return `Em ${diff} dias`
  const d = fromISO(iso)
  return `${WEEKDAYS_SHORT[d.getDay()].toLowerCase()}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
}

export function timeAgo(isoDateTime: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(isoDateTime).getTime()) / 60000))
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Matriz de semanas (domingo→sábado) do mês, com null nas sobras. */
export function monthMatrix(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= days; d++) cells.push(toISO(new Date(year, month, d)))
  while (cells.length % 7) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

/** "19:30–21:00", "20:00", "Dia todo", "Horário a definir" ou "20/11 a 22/11" */
export function timeRange(ev: { date?: string; time: string; endTime?: string; endDate?: string; allDay?: boolean }): string {
  const ddmm = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
  if (ev.endDate && ev.date) return `${ddmm(ev.date)} a ${ddmm(ev.endDate)}`
  if (ev.allDay) return 'Dia todo'
  if (!ev.time) return 'Horário a definir'
  return ev.endTime ? `${ev.time}–${ev.endTime}` : ev.time
}
