import { useState } from 'react'
import { CalendarClock, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { useNav } from '../nav'
import { DEFAULT_WEEKLY, EVERY_WEEKDAY, MONTHS, WEEKDAYS, frequencyLabel, slotOn } from '../data/agenda'
import { addDays, fromISO, toISO, todayISO } from '../lib/dates'
import { Empty, MinistryBadge, Sheet, TopBar } from '../components/ui'
import type { ActionResult } from '../data/actions'
import type { WeeklySlot } from '../data/types'

/** Agenda fixa da semana (só a coordenação edita) */
export function Weekly() {
  const { data } = useStore()
  const { back } = useNav()
  const weekly = data.weekly ?? DEFAULT_WEEKLY
  const [editing, setEditing] = useState<WeeklySlot | 'new' | null>(null)
  const days = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    slots: weekly.filter((s) => s.day === day).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title)),
  }))

  return (
    <div className="screen">
      <TopBar title="Cultos da semana" subtitle="Agenda fixa da igreja" onBack={back}
        right={<button className="icon-btn filled" onClick={() => setEditing('new')} aria-label="Novo culto fixo"><Plus size={20} /></button>} />
      <p className="muted small form-help">
        Os cultos e encontros que se repetem. Ao mudar aqui, os próximos eventos são atualizados e as escalas já feitas continuam.
        Para mudar só um dia, abra o evento na agenda e toque em editar.
      </p>
      {weekly.length === 0 && <Empty icon={<CalendarClock />} title="Nenhum culto fixo" text="Toque em + para cadastrar o primeiro." />}
      {days.filter((d) => d.slots.length).map((d) => (
        <section key={d.day} className="section">
          <div className="section-head"><h3>{EVERY_WEEKDAY[d.day]}</h3></div>
          <div className="card list-card">
            {d.slots.map((s) => (
              <button key={s.id} className="weekly-row" onClick={() => setEditing(s)}>
                <span className="weekly-time">{s.time}</span>
                <div className="grow">
                  <strong>{s.title}</strong>
                  <span className="muted small">{frequencyLabel(s)}{s.place ? ` · ${s.place}` : ''}</span>
                  <span className="weekly-mins">
                    {s.ministryIds.length === 0 ? <span className="muted small">Sem escala</span> : s.ministryIds.map((id) => {
                      const m = data.ministries.find((x) => x.id === id)
                      return m ? <MinistryBadge key={id} ministry={m} size={22} /> : null
                    })}
                  </span>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="btn btn-primary btn-block mt" onClick={() => setEditing('new')}><Plus size={18} /> Novo culto fixo</button>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo culto fixo' : 'Editar culto fixo'}>
        {editing && <WeeklyForm key={editing === 'new' ? 'new' : editing.id} slot={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

type Freq = 'all' | 'weeks' | 'biweekly'

function WeeklyForm({ slot, onDone }: { slot?: WeeklySlot; onDone: () => void }) {
  const { data, actions, notify } = useStore()
  const [title, setTitle] = useState(slot?.title ?? '')
  const [day, setDay] = useState(slot?.day ?? 0)
  const [time, setTime] = useState(slot?.time ?? '19:30')
  const [endTime, setEndTime] = useState(slot?.endTime ?? '')
  const [place, setPlace] = useState(slot?.place ?? '')
  const [activity, setActivity] = useState(slot?.activity ?? '')
  const [responsible, setResponsible] = useState(slot?.responsible ?? '')
  const [mins, setMins] = useState<string[]>(slot?.ministryIds ?? [])
  const [freq, setFreq] = useState<Freq>(slot?.biweekly ? 'biweekly' : slot?.weeks?.length ? 'weeks' : 'all')
  const [weeks, setWeeks] = useState<number[]>(slot?.weeks ?? [])
  const [months, setMonths] = useState<number[]>(slot?.months ?? [])
  const [anchor, setAnchor] = useState(slot?.biweekly ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  // próximas datas deste dia da semana, para escolher a referência do "a cada 15 dias"
  const nextDates = Array.from({ length: 4 }, (_, i) => {
    const d = fromISO(todayISO())
    while (d.getDay() !== day) d.setDate(d.getDate() + 1)
    return toISO(addDays(d, i * 7))
  })
  const anchorOk = anchor && fromISO(anchor).getDay() === day ? anchor : ''

  const draft = (): WeeklySlot => ({
    id: slot?.id ?? '', day, time, endTime: endTime || undefined, title, place, activity, responsible, ministryIds: mins,
    weeks: freq === 'weeks' ? weeks : undefined, months: months.length ? months : undefined,
    biweekly: freq === 'biweekly' ? anchorOk || nextDates[0] : undefined,
  })

  // quantos eventos e escalas dos próximos dias esse culto tem hoje (para avisar antes de apagar)
  const today = todayISO()
  const future = slot ? data.events.filter((e) => e.slotId === slot.id && e.date >= today && !e.edited && !e.special) : []
  const futureAssignments = data.assignments.filter((a) => future.some((e) => e.id === a.eventId)).length
  const preview = (() => {
    const s = draft()
    const out: string[] = []
    for (let d = fromISO(today); out.length < 3 && toISO(d) <= toISO(addDays(fromISO(today), 120)); d = addDays(d, 1)) {
      if (slotOn(s, d)) out.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return out
  })()

  const report = (r: ActionResult, verb: string) => {
    const parts = [r.created && `${r.created} ${r.created === 1 ? 'evento criado' : 'eventos criados'}`,
      r.updated && `${r.updated} ${r.updated === 1 ? 'atualizado' : 'atualizados'}`,
      r.removed && `${r.removed} ${r.removed === 1 ? 'removido' : 'removidos'}`].filter(Boolean)
    notify(`Culto fixo ${verb}${parts.length ? `: ${parts.join(', ')}` : ''}`)
  }

  const save = async () => {
    if (freq === 'weeks' && !weeks.length) return setError('Escolha pelo menos uma semana do mês.')
    setSaving(true)
    setError('')
    const r = await actions.saveWeekly(draft())
    setSaving(false)
    if (!r.ok) return setError(r.error)
    report(r.result, slot ? 'atualizado' : 'criado')
    onDone()
  }
  const remove = async () => {
    if (!slot) return
    setSaving(true)
    const r = await actions.removeWeekly(slot.id)
    setSaving(false)
    if (!r.ok) return setError(r.error)
    report(r.result, 'removido')
    onDone()
  }

  return (
    <div className="group-form">
      <label className="field"><span>Nome</span><input id="wk-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Culto de Celebração" /></label>
      <span className="field-label">Dia da semana</span>
      <div className="chips">
        {WEEKDAYS.map((w, i) => <button key={w} className={`chip${day === i ? ' on' : ''}`} onClick={() => setDay(i)}>{w.slice(0, 3)}</button>)}
      </div>
      <div className="field-row">
        <label className="field"><span>Início</span><input id="wk-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field"><span>Término (opcional)</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
      </div>

      <span className="field-label">Com que frequência</span>
      <div className="chips">
        <button className={`chip${freq === 'all' ? ' on' : ''}`} onClick={() => setFreq('all')}>Toda semana</button>
        <button className={`chip${freq === 'weeks' ? ' on' : ''}`} onClick={() => setFreq('weeks')}>Semanas do mês</button>
        <button className={`chip${freq === 'biweekly' ? ' on' : ''}`} onClick={() => setFreq('biweekly')}>A cada 15 dias</button>
      </div>
      {freq === 'weeks' && (
        <div className="chips">
          {[1, 2, 3, 4, 5].map((w) => <button key={w} className={`chip${weeks.includes(w) ? ' on' : ''}`} onClick={() => setWeeks(toggle(weeks, w).sort())}>{w}ª {WEEKDAYS[day].toLowerCase().slice(0, 3)}</button>)}
        </div>
      )}
      {freq === 'biweekly' && (
        <>
          <span className="muted small">Começa em</span>
          <div className="chips">
            {nextDates.slice(0, 2).map((d) => (
              <button key={d} className={`chip${(anchorOk || nextDates[0]) === d ? ' on' : ''}`} onClick={() => setAnchor(d)}>{d.slice(8)}/{d.slice(5, 7)}</button>
            ))}
            {anchorOk && !nextDates.slice(0, 2).includes(anchorOk) && <span className="chip on">segue o calendário atual</span>}
          </div>
        </>
      )}
      <details className="months-pick" open={months.length > 0}>
        <summary className="muted small">{months.length ? `Só em: ${months.map((m) => MONTHS[m - 1]).join(', ')}` : 'Todos os meses (toque para limitar)'}</summary>
        <div className="chips">
          {MONTHS.map((m, i) => <button key={m} className={`chip${months.includes(i + 1) ? ' on' : ''}`} onClick={() => setMonths(toggle(months, i + 1).sort((a, b) => a - b))}>{m}</button>)}
        </div>
      </details>
      {preview.length > 0
        ? <p className="muted small">Próximas datas: {preview.join(', ')}</p>
        : <p className="warn-box">Nenhuma data nos próximos meses com essa frequência.</p>}

      <label className="field"><span>Local</span><input value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder="Ex.: Templo" /></label>
      <div className="field-row">
        <label className="field"><span>Tipo (opcional)</span><input value={activity} maxLength={80} onChange={(e) => setActivity(e.target.value)} placeholder="Ex.: Curso, GC" /></label>
        <label className="field"><span>Responsável (opcional)</span><input value={responsible} maxLength={80} onChange={(e) => setResponsible(e.target.value)} /></label>
      </div>
      <span className="field-label">Ministérios que servem</span>
      <div className="chips">
        {data.ministries.map((m) => <button key={m.id} className={`chip${mins.includes(m.id) ? ' on' : ''}`} onClick={() => setMins(toggle(mins, m.id))}>{m.name}</button>)}
      </div>
      {mins.length === 0 && <p className="muted small">Sem ministério: aparece na agenda, sem escala.</p>}

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={saving || !title.trim() || !time} onClick={save}>{saving ? 'Salvando…' : slot ? 'Salvar e atualizar a agenda' : 'Criar culto fixo'}</button>
      {slot && (confirmDel ? (
        <div className="card confirm-box">
          <p>Remover <b>{slot.title}</b> da agenda fixa? {future.length
            ? <>Saem os próximos <b>{future.length}</b> eventos{futureAssignments ? <> e <b>{futureAssignments}</b> escalas</> : ''}. Os que já passaram ficam no histórico.</>
            : 'Não há eventos futuros dele.'}</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Cancelar</button>
            <button className="btn btn-danger" disabled={saving} onClick={remove}>Remover</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-block danger-text" onClick={() => setConfirmDel(true)}><Trash2 size={18} /> Remover culto fixo</button>
      ))}
    </div>
  )
}
