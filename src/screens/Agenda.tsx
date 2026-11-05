import { useMemo, useState } from 'react'
import { CalendarX2, Plus } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { longDate, relativeDay, timeRange, todayISO } from '../lib/dates'
import { myUpcoming } from '../lib/selectors'
import { sortEvents } from '../lib/schedule'
import { DateBlock, Empty, MinistryBadge, Sheet, StatusPill, TopBar } from '../components/ui'
import type { AppData, ChurchEvent } from '../data/types'

export function fillOf(data: AppData, ev: ChurchEvent, ministryIds?: string[]) {
  let total = 0
  let filled = 0
  for (const mid of ev.ministryIds) {
    if (ministryIds && !ministryIds.includes(mid)) continue
    const m = data.ministries.find((x) => x.id === mid)
    if (!m) continue
    for (const r of m.roles) {
      total += r.count
      filled += Math.min(r.count, data.assignments.filter((a) => a.eventId === ev.id && a.ministryId === mid && a.role === r.name && a.status !== 'declined').length)
    }
  }
  return { total, filled }
}

export function Agenda() {
  const { data } = useStore()
  const me = useMe()
  const { push } = useNav()
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [newOpen, setNewOpen] = useState(false)
  const mine = myUpcoming(data, me.id)

  const grouped = useMemo(() => {
    const evs = data.events.filter((e) => e.date >= todayISO()).sort(sortEvents)
    const g = new Map<string, ChurchEvent[]>()
    for (const e of evs) g.set(e.date, [...(g.get(e.date) ?? []), e])
    return [...g.entries()]
  }, [data.events])

  return (
    <div className="screen">
      <TopBar
        title="Escalas"
        right={me.access === 'admin' && (
          <button className="icon-btn filled" onClick={() => setNewOpen(true)} aria-label="Novo evento"><Plus size={20} /></button>
        )}
      />
      <div className="segmented">
        <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>Minhas escalas</button>
        <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>Agenda da igreja</button>
      </div>

      {view === 'mine' ? (
        mine.length === 0 ? (
          <Empty icon={<CalendarX2 />} title="Você ainda não foi escalado" text="Mantenha sua disponibilidade atualizada no Perfil." />
        ) : (
          <div className="list">
            {mine.map((x) => (
              <button key={x.a.id} className="card assign-row" onClick={() => push({ name: 'event', id: x.ev.id })}>
                <DateBlock iso={x.ev.date} />
                <div className="grow">
                  <span className="kicker">{relativeDay(x.ev.date)} · {timeRange(x.ev)}</span>
                  <strong>{x.ev.title}</strong>
                  <span className="muted">{x.ministry.name} · {x.a.role}</span>
                </div>
                <StatusPill status={x.a.status} />
              </button>
            ))}
          </div>
        )
      ) : (
        grouped.map(([date, evs]) => (
          <div key={date} className="day-group">
            <h4 className="day-title">{relativeDay(date) === 'Hoje' || relativeDay(date) === 'Amanhã' ? `${relativeDay(date)} · ` : ''}{longDate(date)}</h4>
            <div className="list">
              {evs.map((ev) => {
                const { total, filled } = fillOf(data, ev)
                const myA = data.assignments.find((a) => a.eventId === ev.id && a.memberId === me.id && a.status !== 'declined')
                return (
                  <button key={ev.id} className="card event-card" onClick={() => push({ name: 'event', id: ev.id })}>
                    <div className="event-card-top">
                      <div>
                        <strong>{ev.title}</strong>
                        <span className="muted">{timeRange(ev)}{ev.place && ` · ${ev.place}`}</span>
                        {ev.responsible && <span className="muted small">Responsável: {ev.responsible}</span>}
                      </div>
                      {myA && <span className="pill pill-me">Você · {myA.role}</span>}
                    </div>
                    {total > 0 ? (
                      <>
                        <div className="mini-badges">
                          {ev.ministryIds.map((id) => {
                            const m = data.ministries.find((x) => x.id === id)
                            return m ? <MinistryBadge key={id} ministry={m} size={26} /> : null
                          })}
                        </div>
                        <div className="progress-row">
                          <div className="progress"><div style={{ width: `${(filled / total) * 100}%` }} /></div>
                          <span className="small muted">{filled}/{total} vagas</span>
                        </div>
                      </>
                    ) : (
                      <span className="small muted">{ev.activity ? `${ev.activity} · ` : ''}sem escala de voluntários</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}

      <NewEventSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

function NewEventSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, actions, notify } = useStore()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('19:30')
  const [mins, setMins] = useState<string[]>(data.ministries.map((m) => m.id))
  const toggle = (id: string) => setMins((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const save = () => {
    actions.addEvent(title.trim(), date, time, mins)
    notify('Evento criado! Agora é só montar as escalas.')
    setTitle('')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Novo evento">
      <label className="field"><span>Nome</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Conferência de Jovens" /></label>
      <div className="field-row">
        <label className="field"><span>Data</span><input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Horário</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <span className="field-label">Ministérios que vão servir</span>
      <div className="chips">
        {data.ministries.map((m) => (
          <button key={m.id} className={`chip${mins.includes(m.id) ? ' on' : ''}`} onClick={() => toggle(m.id)}>{m.name}</button>
        ))}
      </div>
      <button className="btn btn-primary btn-block" disabled={!title.trim() || !mins.length} onClick={save}>Criar evento</button>
    </Sheet>
  )
}
