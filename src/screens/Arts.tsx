import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Clapperboard, ExternalLink, MonitorPlay, Palette, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, dueLabel, fromISO, timeRange, toISO, todayISO, weekdayShort } from '../lib/dates'
import { canManage, sortEvents } from '../lib/schedule'
import { memberById, ministryMembers } from '../lib/selectors'
import { Avatar, Empty, Sheet } from '../components/ui'
import { hasProjection } from '../lib/projection'
import type { Ministry, Task } from '../data/types'

/** Ministérios que usam a aba de artes */
export const ARTS_MINISTRIES = ['follow']
const ART_ROLE = 'Edição de artes'
const NEWS_ROLE = 'Lagoinha News'
const isNews = (t: Pick<Task, 'kind'>) => t.kind === 'news'
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
        <button className="btn btn-primary btn-block mb" onClick={() => setEditing('new')}><Plus size={18} /> Novo pedido</button>
      )}
      {open.length === 0 ? (
        <div className="card"><Empty icon={<Palette />} title="Nenhum pedido em aberto" text={manage ? 'Toque em “Novo pedido” para pedir uma arte ou o vídeo do Lagoinha News.' : 'Quando o líder pedir uma arte ou um vídeo para você, aparece aqui.'} /></div>
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
      {task.projection && <span className="task-proj"><MonitorPlay size={14} /> Vai para a projeção: a equipe recebe o link na escala do culto</span>}
      {task.details && <p className="task-details">{task.details}</p>}
      <div className="task-who">
        <Avatar name={who?.name ?? '?'} size={26} />
        <span className="grow small">{mine ? 'Você' : who?.name ?? 'Pessoa removida'}</span>
        {done && task.doneAt && <span className="muted small">entregue em {ddmm(task.doneAt.slice(0, 10))}</span>}
      </div>
      {done && task.link && (
        <a className="btn btn-soft btn-sm task-link" href={task.link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> {isNews(task) ? 'Abrir vídeo' : 'Abrir arte'}</a>
      )}
      <div className="task-actions">
        {!done && (mine || manage) && (
          <button className="btn btn-primary btn-sm" onClick={() => setDeliver(true)}><CheckCircle2 size={15} /> Marcar como entregue</button>
        )}
        {done && (mine || manage) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { actions.setTaskDone(task.id, false); notify(isNews(task) ? 'Vídeo voltou para “em aberto”' : 'Arte voltou para “em aberto”') }}><RotateCcw size={15} /> Reabrir</button>
        )}
        {manage && <button className="icon-btn sm" onClick={onEdit} aria-label="Editar"><Pencil size={16} /></button>}
        {manage && <button className="icon-btn sm" onClick={() => setConfirmDel(true)} aria-label="Excluir"><Trash2 size={16} /></button>}
      </div>
      {confirmDel && (
        <div className="confirm-inline">
          <span className="small">Excluir este pedido?</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Cancelar</button>
          <button className="btn btn-danger btn-sm" onClick={() => { actions.removeTask(task.id); notify('Pedido excluído') }}>Excluir</button>
        </div>
      )}
      <Sheet open={deliver} onClose={() => setDeliver(false)} title={isNews(task) ? 'Entregar vídeo do News' : 'Entregar arte'}>
        <p className="muted">{task.title}</p>
        <label className="field">
          <span>{isNews(task) ? 'Link do vídeo' : 'Link da arte'}{task.projection ? '' : ' (opcional)'}</span>
          <input id={`link-${task.id}`} inputMode="url" placeholder={isNews(task) ? 'YouTube, Drive, WeTransfer…' : 'Drive, Canva, WeTransfer…'} value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        {task.projection && <p className="muted small">A Projeção abre por este link no dia do culto.</p>}
        <button className="btn btn-primary btn-block" disabled={!!task.projection && !link.trim()} onClick={() => {
          actions.setTaskDone(task.id, true, link)
          setDeliver(false)
          notify(task.projection ? 'Entregue! A Projeção e os líderes foram avisados ✅' : 'Arte entregue! Os líderes foram avisados ✅')
        }}>Confirmar entrega</button>
      </Sheet>
    </div>
  )
}

const OTHER = '__outro__'

/** Formulário de nova arte / edição */
function TaskSheet({ ministry, task, onClose }: { ministry: Ministry; task: Task | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={!!task} onClose={onClose} title={task === 'new' ? 'Novo pedido' : isNews(task ?? {}) ? 'Editar vídeo do News' : 'Editar arte'}>
      {task && <TaskForm key={task === 'new' ? 'new' : task.id} ministry={ministry} task={task === 'new' ? null : task} onDone={onClose} />}
    </Sheet>
  )
}

function TaskForm({ ministry, task, onDone }: { ministry: Ministry; task: Task | null; onDone: () => void }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()

  const [kind, setKind] = useState<'art' | 'news'>(task && isNews(task) ? 'news' : 'art')
  const news = kind === 'news'
  // opções prontas: próximos cultos e eventos (fixos e especiais); o vídeo do News só nos cultos com projeção
  const events = useMemo(() => {
    const until = toISO(addDays(new Date(), 35))
    return data.events.filter((e) => e.date >= today && e.date <= until && (!news || hasProjection(data, e))).sort(sortEvents)
  }, [data, today, news])

  const groups: [string, typeof events][] = useMemo(() => {
    const week = toISO(addDays(new Date(), 6))
    const next = toISO(addDays(new Date(), 13))
    return [
      ['Próximos 7 dias', events.filter((e) => e.date <= week)],
      ['Semana seguinte', events.filter((e) => e.date > week && e.date <= next)],
      ['Mais adiante', events.filter((e) => e.date > next)],
    ]
  }, [events])

  // responsáveis: equipe do ministério, com quem é de "Edição de artes" (ou do News) primeiro
  const role = news ? NEWS_ROLE : ART_ROLE
  const people = useMemo(() => {
    const list = ministryMembers(data, ministry.id)
    const has = (id: string) => !!list.find((m) => m.id === id)?.ministries.some((mm) => mm.ministryId === ministry.id && mm.roles.includes(role))
    return [...list].sort((a, b) => Number(has(b.id)) - Number(has(a.id)) || a.name.localeCompare(b.name)).map((m) => ({ m, art: has(m.id) }))
  }, [data, ministry.id, role])

  const [projection, setProjection] = useState(!!task?.projection)
  const [eventId, setEventId] = useState(task ? task.eventId ?? OTHER : '')
  const projEvent = (() => { const ev = data.events.find((e) => e.id === eventId); return !!ev && hasProjection(data, ev) })()
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
    setTitle(`${news ? 'Vídeo do News' : 'Arte'} · ${ev.title} (${ddmm(ev.date)})`)
    // prazo padrão: 2 dias antes do evento para arte, 1 dia para o vídeo (nunca antes de hoje)
    const suggested = toISO(addDays(fromISO(ev.date), news ? -1 : -2))
    setDueDate(suggested < today ? today : suggested)
  }

  const save = async () => {
    if (!title.trim()) return setError(news ? 'Escolha em qual culto o vídeo vai passar.' : eventId === OTHER ? 'Escreva qual é a arte ou o evento.' : 'Escolha para qual culto ou evento é a arte.')
    if (!assigneeId) return setError('Escolha quem vai ficar responsável.')
    if (!dueDate) return setError(news ? 'Escolha até quando precisa do vídeo.' : 'Escolha até quando precisa da arte.')
    setSaving(true)
    const r = await actions.saveTask({
      id: task?.id, ministryId: ministry.id, title, details, assigneeId, dueDate,
      eventId: eventId && eventId !== OTHER ? eventId : undefined,
      kind: news ? 'news' : undefined,
      projection: news || (projection && projEvent),
    })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    const who = memberById(data, assigneeId)?.name.split(' ')[0]
    notify(task ? 'Pedido atualizado' : news ? `Vídeo do News pedido para ${who} 🎬` : `Arte pedida para ${who} 🎨`)
    onDone()
  }

  const switchKind = (k: 'art' | 'news') => {
    if (k === kind) return
    setKind(k)
    setError('')
    // o vídeo do News só passa em culto com projeção
    const ev = data.events.find((e) => e.id === eventId)
    if (k === 'news' && (eventId === OTHER || (ev && !hasProjection(data, ev)))) { setEventId(''); setTitle(''); return }
    // o título acompanha o tipo do pedido
    setTitle((t) => (k === 'news' ? t.replace(/^Arte · /, 'Vídeo do News · ') : t.replace(/^Vídeo do News · /, 'Arte · ')))
  }

  return (
    <>
      {!task && (
        <div className="chips kind-chips">
          <button className={`chip${!news ? ' on' : ''}`} onClick={() => switchKind('art')}><Palette size={15} /> Arte</button>
          <button className={`chip${news ? ' on' : ''}`} onClick={() => switchKind('news')}><Clapperboard size={15} /> Vídeo do Lagoinha News</button>
        </div>
      )}
      {news && <p className="muted small">Quem edita o episódio entrega o link do vídeo, e a Projeção recebe na escala do culto em que ele vai passar.</p>}
      <label className="field">
        <span>{news ? 'Em qual culto vai passar?' : 'Para qual culto ou evento?'}</span>
        <select id="task-event" value={eventId} onChange={(e) => pickEvent(e.target.value)}>
          <option value="" disabled>Escolha…</option>
          {groups.map(([label, list]) => list.length > 0 && (
            <optgroup key={label} label={label}>
              {list.map((e) => (
                <option key={e.id} value={e.id}>{weekdayShort(e.date).toLowerCase()}, {ddmm(e.date)} · {e.title}{e.time ? ` · ${timeRange(e)}` : ''}</option>
              ))}
            </optgroup>
          ))}
          {!news && <option value={OTHER}>+ Outro evento ou arte</option>}
        </select>
      </label>
      {(eventId === OTHER || (eventId && title)) && (
        <label className="field">
          <span>{eventId === OTHER ? 'Qual arte?' : news ? 'Nome do pedido' : 'Nome da arte'}</span>
          <input id="task-title" value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder="Ex.: Arte da Conferência de Jovens" />
        </label>
      )}
      <label className="field">
        <span>Detalhes (opcional)</span>
        <textarea id="task-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={news ? 'Episódio, duração, observações…' : 'Formato (feed, stories, projeção), textos, referências…'} />
      </label>
      {!news && eventId && eventId !== OTHER && projEvent && (
        <label className="switch-row proj-switch">
          <span><MonitorPlay size={18} /> Vai para a projeção <span className="muted small block">A Projeção recebe o link dentro da escala do culto</span></span>
          <input type="checkbox" checked={projection} onChange={(e) => setProjection(e.target.checked)} />
        </label>
      )}
      <label className="field">
        <span>Responsável</span>
        <select id="task-assignee" value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); setError('') }}>
          <option value="" disabled>Escolha…</option>
          {people.map(({ m, art }) => <option key={m.id} value={m.id}>{m.name}{art ? ` · ${role}` : ''}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Entregar até</span>
        <input id="task-due" type="date" min={today} value={dueDate} onChange={(e) => { setDueDate(e.target.value); setError('') }} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? 'Salvando…' : task ? 'Salvar alterações' : news ? 'Pedir vídeo' : 'Pedir arte'}</button>
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
        <span className="arts-home-icon">{mine.every(isNews) ? <Clapperboard size={18} /> : <Palette size={18} />}</span>
        <strong className="grow">{mine.length === 1 ? (isNews(mine[0]) ? 'Vídeo do News para entregar' : 'Arte para entregar') : mine.every((t) => !isNews(t)) ? `${mine.length} artes para entregar` : `${mine.length} entregas pendentes`}</strong>
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
