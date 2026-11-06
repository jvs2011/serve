import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { dayNum, longDate, monthLong, monthMatrix, todayISO } from '../lib/dates'
import { myUpcoming } from '../lib/selectors'
import { TopBar } from '../components/ui'
import { DEFAULT_WEEKLY, recurringSlots } from '../data/agenda'

export function Availability() {
  const { data, actions } = useStore()
  const me = useMe()
  const { back } = useNav()
  const now = new Date()
  const [offset, setOffset] = useState(0)
  const y = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const rows = monthMatrix(y.getFullYear(), y.getMonth())
  const off = new Set(data.unavailability[me.id] ?? [])
  const served = new Set(myUpcoming(data, me.id).map((x) => x.ev.date))
  const eventDays = new Set(data.events.map((e) => e.date))
  const today = todayISO()
  const futureOff = [...off].filter((d) => d >= today).sort()
  // cultos fixos que fazem sentido para a pessoa (pelos ministérios dela)
  const mine = new Set(me.ministries.map((m) => m.ministryId))
  const all = recurringSlots(data.weekly ?? DEFAULT_WEEKLY)
  const slots = all.filter((s) => s.ministryIds.some((id) => mine.has(id)))
  const shownSlots = slots.length ? slots : all.slice(0, 3)
  const recurringOff = new Set(me.recurringOff ?? [])

  return (
    <div className="screen">
      <TopBar title="Disponibilidade" subtitle="Quando você não pode servir" onBack={back} />

      <h3 className="form-title first">Cultos da semana</h3>
      <p className="muted small form-help">Tem algum culto fixo em que você não consegue servir? Toque para marcar e a escala não vai te colocar nesse horário.</p>
      <div className="card list-card slots">
        {shownSlots.map((s) => {
          const no = recurringOff.has(s.key)
          return (
            <button key={s.key} className="slot-row" aria-pressed={no} onClick={() => actions.toggleRecurringOff(s.key)}>
              <div className="grow">
                <strong>{s.day} · {s.time}</strong>
                <span className="muted small">{s.title}</span>
              </div>
              <span className={`pill ${no ? 'pill-declined' : 'pill-confirmed'}`}>{no ? 'Não posso' : 'Posso servir'}</span>
            </button>
          )
        })}
      </div>

      <h3 className="form-title">Datas específicas</h3>
      <p className="muted small form-help">Viagem, compromisso ou outro motivo: toque nos dias em que você não pode servir.</p>
      <div className="card calendar">
        <div className="cal-head">
          <button className="icon-btn" disabled={offset <= 0} onClick={() => setOffset(offset - 1)} aria-label="Mês anterior"><ChevronLeft size={20} /></button>
          <strong>{monthLong(y.getMonth())} {y.getFullYear()}</strong>
          <button className="icon-btn" disabled={offset >= 5} onClick={() => setOffset(offset + 1)} aria-label="Próximo mês"><ChevronRight size={20} /></button>
        </div>
        <div className="cal-grid cal-wd">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
        {rows.map((row, i) => (
          <div key={i} className="cal-grid">
            {row.map((iso, j) =>
              iso ? (
                <button
                  key={j}
                  className={['cal-day', off.has(iso) && 'off', served.has(iso) && 'serving', iso === today && 'today', eventDays.has(iso) && 'has-event'].filter(Boolean).join(' ')}
                  disabled={iso < today}
                  onClick={() => actions.toggleUnavailable(iso)}
                  aria-pressed={off.has(iso)}
                  aria-label={longDate(iso)}
                >
                  {dayNum(iso)}
                </button>
              ) : <span key={j} />,
            )}
          </div>
        ))}
        <div className="legend">
          <span><i className="lg off" /> Indisponível</span>
          <span><i className="lg serving" /> Escalado</span>
          <span><i className="lg event" /> Tem culto</span>
        </div>
      </div>
      <p className="muted small pad">Os líderes não vão conseguir te escalar nos dias marcados. Se você já está escalado num dia que marcou, peça uma troca.</p>
      {futureOff.length > 0 && (
        <div className="card">
          <strong className="block mb">Dias marcados</strong>
          <div className="chips">{futureOff.map((d) => <button key={d} className="chip on" onClick={() => actions.toggleUnavailable(d)}>{longDate(d)} ✕</button>)}</div>
        </div>
      )}
    </div>
  )
}
