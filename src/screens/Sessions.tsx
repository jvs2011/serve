import { useMemo, useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { useStore } from '../data/store'
import { sessionRole, TEAM_SESSIONS, type TeamSession } from '../data/sessions'
import { addDays, fromISO, toISO, todayISO, weekdayShort } from '../lib/dates'
import { isOff } from '../lib/schedule'
import { shortNames } from '../lib/people'
import { Sheet } from '../components/ui'
import type { Ministry } from '../data/types'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Cartões de "agendar encontro de equipe" (ex.: gravação do News) — só para quem gerencia o ministério */
export function SessionCards({ ministry }: { ministry: Ministry }) {
  const sessions = TEAM_SESSIONS.filter((s) => s.ministryId === ministry.id)
  const [open, setOpen] = useState<TeamSession | null>(null)
  if (!sessions.length) return null
  return (
    <>
      {sessions.map((s) => (
        <div key={s.id} className="card session-card">
          <span className="session-icon" style={{ background: `${ministry.color}22`, color: ministry.color }}><Clapperboard size={20} /></span>
          <div className="grow">
            <strong>{s.title}</strong>
            <span className="muted small">Escolha o melhor dia da semana. Quem é de {s.roles.join(' e ')} recebe o convite para confirmar.</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(s)}>Agendar</button>
        </div>
      ))}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `Agendar · ${open.title}` : ''}>
        {open && <SessionForm key={open.id} session={open} onDone={() => setOpen(null)} />}
      </Sheet>
    </>
  )
}

export function SessionForm({ session, onDone }: { session: TeamSession; onDone: () => void }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()
  const next7 = useMemo(() => Array.from({ length: 7 }, (_, i) => toISO(addDays(fromISO(today), i + 1))), [today])
  const [date, setDate] = useState(next7[0])
  const [time, setTime] = useState(session.defaultTime)
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const team = data.members.filter((m) => sessionRole(session, m))
  const probe = { id: '', title: '', date, time, ministryIds: [], setlist: [] }
  const off = team.filter((m) => isOff(data, m, probe))
  const invited = team.filter((m) => !off.includes(m))
  const allNames = team.map((m) => m.name)

  const send = async () => {
    if (!date) return setError('Escolha o dia.')
    if (!time) return setError('Escolha o horário.')
    setSaving(true)
    const r = await actions.createTeamSession(session.id, date, time, place, note)
    setSaving(false)
    if (!r.ok) return setError(r.error)
    const n = r.result.created ?? 0
    notify(n ? `Convite enviado para ${n} ${n === 1 ? 'pessoa' : 'pessoas'} da equipe 🎬` : 'Gravação agendada. Ninguém da equipe está disponível nesse dia.')
    onDone()
  }

  return (
    <>
      <span className="field-label">Dia</span>
      <div className="day-chips">
        {next7.map((d) => (
          <button key={d} className={`chip day-chip${d === date ? ' on' : ''}`} onClick={() => { setDate(d); setError('') }}>
            <b>{weekdayShort(d).toLowerCase()}</b>
            <span>{ddmm(d)}</span>
          </button>
        ))}
      </div>
      <div className="field-row">
        <label className="field"><span>Outra data</span><input id="ses-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field narrow-wide"><span>Horário</span><input id="ses-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label className="field"><span>Local (opcional)</span><input id="ses-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ex.: Templo, Garagem" /></label>
      <label className="field"><span>Recado para a equipe (opcional)</span><input id="ses-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: pauta da semana: Shine Day" /></label>

      <div className="invite-box">
        <strong>{invited.length ? `Convite para ${invited.length} ${invited.length === 1 ? 'pessoa' : 'pessoas'} da equipe ${session.team}` : `Ninguém da equipe ${session.team} está disponível`}</strong>
        {session.roles.map((r) => {
          const who = invited.filter((m) => sessionRole(session, m) === r)
          return who.length > 0 && <span key={r} className="small"><b>{r}:</b> {shortNames(who.map((m) => m.name), allNames).join(', ')}</span>
        })}
        {off.length > 0 && <span className="small muted">Indisponível nesse dia: {shortNames(off.map((m) => m.name), allNames).join(', ')}</span>}
        {team.length === 0 && <span className="small muted">Cadastre pessoas em {session.roles.join(' ou ')} para poder convidar.</span>}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={saving} onClick={send}>{saving ? 'Enviando…' : 'Enviar convite'}</button>
    </>
  )
}
