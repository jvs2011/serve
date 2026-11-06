import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, ExternalLink, Palette, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, dueLabel, fromISO, timeRange, toISO, todayISO, weekdayShort } from '../lib/dates'
import { canManage, sortEvents } from '../lib/schedule'
import { memberById, ministryMembers } from '../lib/selectors'
import { Avatar, Empty, Sheet } from '../components/ui'
import type { Ministry, Task } from '../data/types'

/** Ministérios que usam a aba de artes */
export const ARTS_MINISTRIES = ['follow']
const ART_ROLE = 'Edição de artes'
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function DueBadge({ due, done }: { due: string; done?: boolean }) {
  if (done) return null
  const d = dueLabel(due)
  return <span className={`due due-${d.level}`}>{d.text}</span>
}

/** Aba "Artes" dentro do ministério */
export function ArtsTab({ ministry }: { ministry: Ministry }) {
  const { data } = useStore()
  const me = useMe()
  const manage = canManage(me, ministry.id, data)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [showDone, setShowDone] = useState(false)
  const tasks = (data.tasks ?? []).filter((t) => t.ministryId === ministry.id)
  const open = tasks.filter((t) => t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  return (
    <>
      {manage && (
        <button className="btn btn-primary btn-block mb" onClick={() => setEditing('new')}><Plus size={18} /> Nova arte</button>
      )}
      {open.length === 0 ? (
        <div className="card"><Empty icon={<Palette />} title="Nenhuma arte em aberto" text={manage ? 'Toque em “Nova arte” para pedir uma arte e escolher o responsável.' : 'Quando o líder pedir uma arte para você, ela aparece aqui.'} /></div>
      ) : (
        <div className="list">
          {open.map((t) => <TaskCard key={t.id} task={t} manage={manage} onEdit={() => setEditing(t)} />)}
        </div>
      )}
      {done.length > 0 && (
        <>
          <button className="link done-toggle" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Esconder entregues' : `Ver entregues (${done.length})`}
          </button>
          {showDone && <div className="list">{done.slice(0, 20).map((t) => <TaskCard key={t.id} task={t} manage={manage} onEdit={() => setEditing(t)} />)}</div>}
        </>
      )}
      <TaskSheet ministry={ministry} task={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function TaskCard({ task, manage, onEdit }: { task: Task; manage: boolean; onEdit: () => void }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const [deliver, setDeliver] = useState(false)
  const [link, setLink] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const who = memberById(data, task.assigneeId)
  const mine = task.assigneeId === me.id
  const done = task.status === 'done'

  return (
    <div className={`card task-card${done ? ' done' : ''}${mine && !done ? ' mine' : ''}`}>
      <div className="task-top">
        <strong className="grow">{task.title}</strong>
        {done ? <span className="pill pill-confirmed">Entregue</span> : <DueBadge due={task.dueDate} />}
      </div>
      {task.details && <p className="task-details">{task.details}</p>}
      <div className="task-who">
        <Avatar name={who?.name ?? '?'} size={26} />
        <span className="grow small">{mine ? 'Você' : who?.name ?? 'Pessoa removida'}</span>
        {done && task.doneAt && <span className="muted small">entregue em {ddmm(task.doneAt.slice(0, 10))}</span>}
      </div>
      {done && task.link && (
        <a className="btn btn-soft btn-sm task-link" href={task.link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir arte</a>
      )}
      <div className="task-actions">
        {!done && (mine || manage) && (
          <button className="btn btn-primary btn-sm" onClick={() => setDeliver(true)}><CheckCircle2 size={15} /> Marcar como entregue</button>
        )}
        {done && (mine || manage) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { actions.setTaskDone(task.id, false); notify('Arte voltou para “em aberto”') }}><RotateCcw size={15} /> Reabrir</button>
        )}
        {manage && <button className="icon-btn sm" onClick={onEdit} aria-label="Editar"><Pencil size={16} /></button>}
        {manage && <button className="icon-btn sm" onClick={() => setConfirmDel(true)} aria-label="Excluir"><Trash2 size={16} /></button>}
      </div>
      {confirmDel && (
        <div className="confirm-inline">
          <span className="small">Excluir esta arte?</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Cancelar</button>
          <button className="btn btn-danger btn-sm" onClick={() => { actions.removeTask(task.id); notify('Arte excluída') }}>Excluir</button>
        </div>
      )}
      <Sheet open={deliver} onClose={() => setDeliver(false)} title="Entregar arte">
        <p className="muted">{task.title}</p>
        <label className="field">
          <span>Link da arte (opcional)</span>
          <input id={`link-${task.id}`} inputMode="url" placeholder="Drive, Canva, WeTransfer…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-block" onClick={() => {
          actions.setTaskDone(task.id, true, link)
          setDeliver(false)
          notify('Arte entregue! Os líderes foram avisados ✅')
        }}>Confirmar entrega</button>
      </Sheet>
    </div>
  )
}

const OTHER = '__outro__'

/** Formulário de nova arte / edição */
function TaskSheet({ ministry, task, onClose }: { ministry: Ministry; task: Task | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={!!task} onClose={onClose} title={task === 'new' ? 'Nova arte' : 'Editar arte'}>
      {task && <TaskForm key={task === 'new' ? 'new' : task.id} ministry={ministry} task={task === 'new' ? null : task} onDone={onClose} />}
    </Sheet>
  )
}

function TaskForm({ ministry, task, onDone }: { ministry: Ministry; task: Task | null; onDone: () => void }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()

  // opções prontas: próximos cultos e eventos (fixos e especiais) nos próximos 45 dias
  const events = useMemo(() => {
    const until = toISO(addDays(new Date(), 35))
    return data.events.filter((e) => e.date >= today && e.date <= until).sort(sortEvents)
  }, [data.events, today])

  const groups: [string, typeof events][] = useMemo(() => {
    const week = toISO(addDays(new Date(), 6))
    const next = toISO(addDays(new Date(), 13))
    return [
      ['Próximos 7 dias', events.filter((e) => e.date <= week)],
      ['Semana seguinte', events.filter((e) => e.date > week && e.date <= next)],
      ['Mais adiante', events.filter((e) => e.date > next)],
    ]
  }, [events])

  // responsáveis: equipe do ministério, com quem é de "Edição de artes" primeiro
  const people = useMemo(() => {
    const list = ministryMembers(data, ministry.id)
    const art = (id: string) => list.find((m) => m.id === id)?.ministries.some((mm) => mm.ministryId === ministry.id && mm.roles.includes(ART_ROLE))
    return [...list].sort((a, b) => Number(!!art(b.id)) - Number(!!art(a.id)) || a.name.localeCompare(b.name)).map((m) => ({ m, art: !!art(m.id) }))
  }, [data, ministry.id])

  const [eventId, setEventId] = useState(task ? task.eventId ?? OTHER : '')
  const [title, setTitle] = useState(task?.title ?? '')
  const [details, setDetails] = useState(task?.details ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pickEvent = (id: string) => {
    setEventId(id)
    setError('')
    if (id === OTHER || !id) { if (!task) setTitle(''); return }
    const ev = data.events.find((e) => e.id === id)
    if (!ev) return
    setTitle(`Arte · ${ev.title} (${ddmm(ev.date)})`)
    // prazo padrão: 2 dias antes do evento (nunca antes de hoje)
    const suggested = toISO(addDays(fromISO(ev.date), -2))
    setDueDate(suggested < today ? today : suggested)
  }

  const save = async () => {
    if (!title.trim()) return setError(eventId === OTHER ? 'Escreva qual é a arte ou o evento.' : 'Escolha para qual culto ou evento é a arte.')
    if (!assigneeId) return setError('Escolha quem vai ficar responsável.')
    if (!dueDate) return setError('Escolha até quando precisa da arte.')
    setSaving(true)
    const r = await actions.saveTask({
      id: task?.id, ministryId: ministry.id, title, details, assigneeId, dueDate,
      eventId: eventId && eventId !== OTHER ? eventId : undefined,
    })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    const who = memberById(data, assigneeId)?.name.split(' ')[0]
    notify(task ? 'Arte atualizada' : `Arte pedida para ${who} 🎨`)
    onDone()
  }

  return (
    <>
      <label className="field">
        <span>Para qual culto ou evento?</span>
        <select id="task-event" value={eventId} onChange={(e) => pickEvent(e.target.value)}>
          <option value="" disabled>Escolha…</option>
          {groups.map(([label, list]) => list.length > 0 && (
            <optgroup key={label} label={label}>
              {list.map((e) => (
                <option key={e.id} value={e.id}>{weekdayShort(e.date).toLowerCase()}, {ddmm(e.date)} · {e.title}{e.time ? ` · ${timeRange(e)}` : ''}</option>
              ))}
            </optgroup>
          ))}
          <option value={OTHER}>+ Outro evento ou arte</option>
        </select>
      </label>
      {(eventId === OTHER || (eventId && title)) && (
        <label className="field">
          <span>{eventId === OTHER ? 'Qual arte?' : 'Nome da arte'}</span>
          <input id="task-title" value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder="Ex.: Arte da Conferência de Jovens" />
        </label>
      )}
      <label className="field">
        <span>Detalhes (opcional)</span>
        <textarea id="task-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Formato (feed, stories, telão), textos, referências…" />
      </label>
      <label className="field">
        <span>Responsável</span>
        <select id="task-assignee" value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); setError('') }}>
          <option value="" disabled>Escolha…</option>
          {people.map(({ m, art }) => <option key={m.id} value={m.id}>{m.name}{art ? ' · Edição de artes' : ''}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Entregar até</span>
        <input id="task-due" type="date" min={today} value={dueDate} onChange={(e) => { setDueDate(e.target.value); setError('') }} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? 'Salvando…' : task ? 'Salvar alterações' : 'Pedir arte'}</button>
    </>
  )
}

/** Cartão na tela Início: artes que eu preciso entregar */
export function HomeArtsCard() {
  const { data } = useStore()
  const me = useMe()
  const { push } = useNav()
  const mine = (data.tasks ?? []).filter((t) => t.assigneeId === me.id && t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  if (!mine.length) return null
  return (
    <div className="card arts-home">
      <div className="arts-home-head">
        <span className="arts-home-icon"><Palette size={18} /></span>
        <strong className="grow">{mine.length === 1 ? 'Arte para entregar' : `${mine.length} artes para entregar`}</strong>
      </div>
      {mine.slice(0, 3).map((t) => (
        <button key={t.id} className="arts-home-row" onClick={() => push({ name: 'ministry', id: t.ministryId, tab: 'arts' })}>
          <div className="grow">
            <span className="arts-home-title">{t.title}</span>
            <DueBadge due={t.dueDate} />
          </div>
          <ChevronRight size={18} className="muted" />
        </button>
      ))}
    </div>
  )
}
