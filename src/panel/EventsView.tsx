import { useMemo, useState } from 'react'
import { CalendarPlus, CalendarRange, Clapperboard, Music2, Pencil, Trash2 } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { relativeDay, timeRange, todayISO } from '../lib/dates'
import { slotsFor, sortEvents } from '../lib/schedule'
import { EVENT_KIND_LABEL, canEditEvent, eventKind, plusDays, type EventKind } from '../lib/panel'
import { TEAM_SESSIONS, type TeamSession } from '../data/sessions'
import { fillOf } from '../screens/Agenda'
import { EventEditForm, MinistryEventForm } from '../screens/MinistryEvents'
import { SessionForm } from '../screens/Sessions'
import { Setlist } from '../screens/EventDetail'
import { Fill, Modal, ddmm, evLabel } from './common'
import type { Section } from './Panel'
import type { ChurchEvent, Ministry } from '../data/types'

type Range = 'next30' | 'next90' | 'past'

/** Eventos em que o ministério serve: criar evento do ministério, agendar gravação, editar e cancelar */
export function EventsView({ ministry, go }: { ministry: Ministry; go: (s: Section, eventId?: string) => void }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const today = todayISO()
  const [range, setRange] = useState<Range>('next30')
  const [kind, setKind] = useState<EventKind | ''>('')
  const [creating, setCreating] = useState(false)
  const [session, setSession] = useState<TeamSession | null>(null)
  const [editing, setEditing] = useState<ChurchEvent | null>(null)
  const [setlist, setSetlist] = useState<ChurchEvent | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const sessions = TEAM_SESSIONS.filter((s) => s.ministryId === ministry.id)
  const louvor = ministry.id === 'louvor'

  const events = useMemo(() => {
    const [from, until] = range === 'past' ? [plusDays(today, -60), plusDays(today, -1)] : [today, plusDays(today, range === 'next30' ? 30 : 90)]
    const list = data.events.filter((e) => e.date >= from && e.date <= until && e.ministryIds.includes(ministry.id)).sort(sortEvents)
    return range === 'past' ? list.reverse() : list
  }, [data.events, ministry.id, range, today])
  const shown = events.filter((e) => !kind || eventKind(e) === kind)
  const kinds = [...new Set(events.map(eventKind))]

  const cancel = async (ev: ChurchEvent) => {
    const r = await actions.removeEvent(ev.id)
    setConfirmDel(null)
    notify(r.ok ? `${ev.title} (${ddmm(ev.date)}) foi cancelado. Quem estava escalado é avisado.` : r.error)
  }

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Eventos</h1>
          <p>Cultos e encontros em que o {ministry.name} serve. Os eventos do ministério você cria, edita e cancela aqui.</p>
        </div>
        <div className="pn-head-actions">
          {sessions.map((s) => <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => setSession(s)}><Clapperboard size={15} /> Agendar {s.title}</button>)}
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><CalendarPlus size={16} /> Novo evento do ministério</button>
        </div>
      </header>

      <div className="pn-toolbar">
        <div className="pn-seg">
          <button className={range === 'next30' ? 'on' : ''} onClick={() => setRange('next30')}>Próximos 30 dias</button>
          <button className={range === 'next90' ? 'on' : ''} onClick={() => setRange('next90')}>Próximos 3 meses</button>
          <button className={range === 'past' ? 'on' : ''} onClick={() => setRange('past')}>Já passaram</button>
        </div>
        {kinds.length > 1 && (
          <div className="chips">
            <button className={`chip${kind === '' ? ' on' : ''}`} onClick={() => setKind('')}>Todos ({events.length})</button>
            {kinds.map((k) => <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{EVENT_KIND_LABEL[k]} ({events.filter((e) => eventKind(e) === k).length})</button>)}
          </div>
        )}
      </div>

      <div className="pn-card pn-card-flush">
        <table className="pn-table">
          <thead>
            <tr><th>Quando</th><th>Evento</th><th>Tipo</th><th style={{ width: '22%' }}>Equipe do {ministry.name}</th>{louvor && <th>Repertório</th>}<th /></tr>
          </thead>
          <tbody>
            {shown.map((ev) => {
              const k = eventKind(ev)
              const f = fillOf(data, ev, [ministry.id])
              const editable = canEditEvent(data, me, ev) && ev.date >= today
              const hasSlots = slotsFor(data, ev, ministry.id).length > 0
              return (
                <tr key={ev.id} className={ev.date < today ? 'pn-past' : ''}>
                  <td className="nowrap"><strong>{relativeDay(ev.date)}</strong><span className="muted small block">{ddmm(ev.date)} · {timeRange(ev)}</span></td>
                  <td><strong>{ev.title}</strong><span className="muted small block">{[ev.place, ev.activity, ev.responsible && `Resp.: ${ev.responsible}`].filter(Boolean).join(' · ') || 'Lagoinha Franca'}</span></td>
                  <td className="nowrap"><span className={`tag pn-kind-${k}`}>{EVENT_KIND_LABEL[k]}{ev.edited ? ' · ajustado' : ''}</span></td>
                  <td>{hasSlots ? <div className="pn-fill-row"><Fill total={f.total} confirmed={f.confirmed} pending={f.pending} color={ministry.color} /><span className="small muted">{f.confirmed + f.pending}/{f.total}</span></div> : <span className="muted small">Sem vagas</span>}</td>
                  {louvor && <td className="nowrap">{ev.setlist.length ? <span className="small">{ev.setlist.length} {ev.setlist.length === 1 ? 'música' : 'músicas'}{ev.setlistSentAt ? ' · enviado' : ''}</span> : <span className="muted small">—</span>}</td>}
                  <td className="right nowrap">
                    {confirmDel === ev.id ? (
                      <span className="pn-inline-confirm">
                        <span className="small">Cancelar o evento?</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>Voltar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => cancel(ev)}>Cancelar evento</button>
                      </span>
                    ) : (
                      <>
                        {hasSlots && ev.date >= today && <button className="btn btn-ghost btn-sm" onClick={() => go('schedule', ev.id)}><CalendarRange size={15} /> Escala</button>}
                        {louvor && <button className="btn btn-ghost btn-sm" onClick={() => setSetlist(ev)}><Music2 size={15} /> Repertório</button>}
                        {editable && <button className="icon-btn sm" title="Editar evento" onClick={() => setEditing(ev)}><Pencil size={16} /></button>}
                        {editable && <button className="icon-btn sm" title="Cancelar evento" onClick={() => setConfirmDel(ev.id)}><Trash2 size={16} /></button>}
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && <tr><td colSpan={louvor ? 6 : 5} className="pn-empty">Nenhum evento neste período.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small pn-foot-note">
        {me.access === 'admin'
          ? 'Como coordenação, você edita e cancela qualquer evento. Para mudar um culto de toda semana, use Coordenação › Cultos da semana.'
          : 'Cultos fixos e eventos especiais são da coordenação; você edita e cancela os eventos criados para o ministério e as gravações.'}
      </p>

      {creating && <Modal title={`Novo evento · ${ministry.name}`} subtitle="Encontros, ações internas ou externas. Depois é só escalar a equipe." onClose={() => setCreating(false)} width={520}><MinistryEventForm ministry={ministry} onDone={() => setCreating(false)} /></Modal>}
      {session && <Modal title={`Agendar · ${session.title}`} subtitle={`Quem é de ${session.roles.join(' e ')} recebe o convite para confirmar.`} onClose={() => setSession(null)} width={560}><SessionForm session={session} onDone={() => setSession(null)} /></Modal>}
      {editing && <Modal title="Editar evento" subtitle={evLabel(editing)} onClose={() => setEditing(null)} width={560}><EventEditForm ev={editing} onDone={() => setEditing(null)} /></Modal>}
      {setlist && <SetlistModal ev={setlist} onClose={() => setSetlist(null)} />}
    </div>
  )
}

/** Repertório de um culto (o mesmo do app): adicionar, editar, reordenar e avisar a equipe */
export function SetlistModal({ ev, onClose }: { ev: ChurchEvent; onClose: () => void }) {
  const { data } = useStore()
  const live = data.events.find((e) => e.id === ev.id) ?? ev
  return (
    <Modal title="Repertório" subtitle={evLabel(live)} onClose={onClose} width={620}>
      <div className="pn-setlist"><Setlist ev={live} /></div>
    </Modal>
  )
}
