import { useState } from 'react'
import { CalendarPlus, Minus, Plus } from 'lucide-react'
import { useStore } from '../data/store'
import { todayISO } from '../lib/dates'
import { Sheet } from '../components/ui'
import type { Ministry } from '../data/types'

/** Cartão para o líder criar um evento do próprio ministério (ex.: ação externa do We Care) */
export function MinistryEventCard({ ministry }: { ministry: Ministry }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="card session-card">
        <span className="session-icon" style={{ background: `${ministry.color}22`, color: ministry.color }}><CalendarPlus size={20} /></span>
        <div className="grow">
          <strong>Novo evento do ministério</strong>
          <span className="muted small">Encontros, ações internas ou externas. Depois é só escalar a equipe.</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Criar</button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Novo evento · ${ministry.name}`}>
        {open && <MinistryEventForm ministry={ministry} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  )
}

function MinistryEventForm({ ministry, onDone }: { ministry: Ministry; onDone: () => void }) {
  const { actions, notify } = useStore()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [place, setPlace] = useState('')
  const [kind, setKind] = useState<'Interno' | 'Externo' | ''>('')
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(ministry.roles.map((r) => [r.name, r.count])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const step = (role: string, d: number) => setCounts((c) => ({ ...c, [role]: Math.max(0, Math.min(50, (c[role] ?? 0) + d)) }))

  const save = async () => {
    if (!title.trim()) return setError('Dê um nome para o evento.')
    if (!date) return setError('Escolha o dia.')
    setSaving(true)
    setError('')
    const r = await actions.addMinistryEvent({
      ministryId: ministry.id, title, date, time, endTime, place, kind: kind || undefined,
      slots: Object.entries(counts).map(([role, count]) => ({ role, count })),
    })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    notify('Evento criado! Agora é só escalar a equipe.')
    onDone()
  }

  return (
    <div className="group-form">
      <label className="field"><span>Nome</span><input id="mev-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ação no Lar São Vicente" /></label>
      <div className="chips">
        {(['Interno', 'Externo'] as const).map((k) => (
          <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(kind === k ? '' : k)}>{k}</button>
        ))}
      </div>
      <label className="field"><span>Dia</span><input id="mev-date" type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
      <div className="field-row">
        <label className="field"><span>Início</span><input id="mev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field"><span>Término (opcional)</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
      </div>
      <label className="field"><span>Local</span><input value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder={kind === 'Externo' ? 'Ex.: Praça Barão, Centro' : 'Ex.: Templo'} /></label>
      <span className="field-label">Quantas pessoas precisa ({total})</span>
      <div className="count-list">
        {ministry.roles.map((r) => (
          <div key={r.name} className="count-row">
            <span className="grow">{r.name}{r.hint && <span className="muted small"> · {r.hint}</span>}</span>
            <div className="stepper">
              <button aria-label={`Menos ${r.name}`} disabled={!counts[r.name]} onClick={() => step(r.name, -1)}><Minus size={16} /></button>
              <b>{counts[r.name] ?? 0}</b>
              <button aria-label={`Mais ${r.name}`} onClick={() => step(r.name, 1)}><Plus size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={saving || !title.trim() || !date || !total} onClick={save}>
        {saving ? 'Criando…' : 'Criar evento'}
      </button>
      <p className="muted small">Sem horário definido? Deixe o início em branco e aparece “horário a definir”.</p>
    </div>
  )
}
