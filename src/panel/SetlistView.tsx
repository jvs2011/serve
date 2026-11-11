import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Music2, Pencil, Users } from 'lucide-react'
import { useStore } from '../data/store'
import { relativeDay, todayISO } from '../lib/dates'
import { firstName, memberById } from '../lib/selectors'
import { panelEvents, plusDays } from '../lib/panel'
import { SetlistModal } from './EventsView'
import { ddmm } from './common'
import type { ChurchEvent, Ministry } from '../data/types'

/** Louvor: repertório dos próximos cultos, lado a lado, com o que já foi enviado para a equipe */
export function SetlistView({ ministry }: { ministry: Ministry }) {
  const { data } = useStore()
  const today = todayISO()
  const [open, setOpen] = useState<ChurchEvent | null>(null)
  const events = useMemo(() => panelEvents(data, ministry.id, today, plusDays(today, 27)), [data, ministry.id, today])
  const sent = events.filter((e) => e.setlistSentAt).length

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Repertório</h1>
          <p>Próximas 4 semanas · {sent} de {events.length} cultos com o repertório enviado. Ao enviar, o Louvor e a Projeção do culto são avisados.</p>
        </div>
      </header>
      <div className="pn-setlist-grid">
        {events.map((ev) => {
          const team = data.assignments.filter((a) => a.eventId === ev.id && a.ministryId === ministry.id && a.status !== 'declined' && !a.draft)
          const groups = [...new Set(team.map((a) => a.groupId).filter(Boolean))].map((id) => ministry.groups?.find((g) => g.id === id)?.name).filter(Boolean)
          const others = team.filter((a) => !a.groupId).map((a) => `${firstName(memberById(data, a.memberId)?.name ?? '')} (${a.role})`)
          const soon = ev.date <= plusDays(today, 6)
          return (
            <section key={ev.id} className={`pn-card pn-setlist-card${!ev.setlistSentAt && soon ? ' attn' : ''}`}>
              <div className="pn-card-head">
                <div>
                  <h2>{ev.title}</h2>
                  <span className="muted small">{relativeDay(ev.date)} · {ddmm(ev.date)}{ev.time && ` · ${ev.time}`}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(ev)}>{ev.setlist.length ? <><Pencil size={14} /> Editar</> : <><Music2 size={14} /> Montar</>}</button>
              </div>
              {ev.setlist.length ? (
                <ol className="pn-songs">
                  {ev.setlist.map((s) => <li key={s.id}><span className="grow"><strong>{s.title}</strong><span className="muted small"> · {s.artist}</span></span>{s.key && <span className="key">{s.key}</span>}</li>)}
                </ol>
              ) : <p className="muted small pn-songs-empty">Nenhuma música ainda.</p>}
              <div className="pn-setlist-foot">
                {ev.setlistSentAt
                  ? <span className="ok small"><CheckCircle2 size={14} /> Enviado em {new Date(ev.setlistSentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  : <span className={`small ${soon ? 'bad' : 'muted'}`}><Clock size={14} /> Ainda não enviado</span>}
                {(groups.length > 0 || others.length > 0) && <span className="muted small pn-setlist-team"><Users size={13} /> {[...groups, ...others].join(', ')}</span>}
              </div>
            </section>
          )
        })}
        {events.length === 0 && <div className="pn-card"><p className="pn-empty">Nenhum culto com o Louvor nas próximas 4 semanas.</p></div>}
      </div>
      {open && <SetlistModal ev={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
