import { useMemo, useState } from 'react'
import { Camera, CheckCircle2, ChevronRight, Clapperboard, ExternalLink, Film, MonitorPlay, Palette, Pencil, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, dueLabel, fromISO, timeRange, toISO, todayISO, weekdayShort } from '../lib/dates'
import { canManage, sortEvents } from '../lib/schedule'
import { memberById, ministryMembers } from '../lib/selectors'
import { Avatar, Empty, Sheet } from '../components/ui'
import { bareName, kindOf, REQUEST_KINDS, retitle, type RequestKind } from '../lib/requests'
import { hasProjection, newsSundays } from '../lib/projection'
import type { Ministry, Task } from '../data/types'

/** Ministérios que usam a aba de artes */
export const ARTS_MINISTRIES = ['follow']
const KIND_ICON = { art: Palette, video: Film, photo: Camera, news: Clapperboard }
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
      {(task.projection || task.social) && (
        <div className="task-dest">
          {task.projection && <span><MonitorPlay size={14} /> Projeção</span>}
          {task.social && <span><Share2 size={14} /> Mídias sociais</span>}
        </div>
      )}
      {task.details && <p className="task-details">{task.details}</p>}
      <div className="task-who">
        <Avatar name={who?.name ?? '?'} size={26} />
        <span className="grow small">{mine ? 'Você' : who?.name ?? 'Pessoa removida'}</span>
        {done && task.doneAt && <span className="muted small">entregue em {ddmm(task.doneAt.slice(0, 10))}</span>}
      </div>
      {done && task.link && (
        <a className="btn btn-soft btn-sm task-link" href={task.link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir {bareName(kindOf(task))}</a>
      )}
      <div className="task-actions">
        {!done && (mine || manage) && (
          <button className="btn btn-primary btn-sm" onClick={() => setDeliver(true)}><CheckCircle2 size={15} /> Marcar como entregue</button>
        )}
        {done && (mine || manage) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { actions.setTaskDone(task.id, false); notify('Pedido voltou para “em aberto”') }}><RotateCcw size={15} /> Reabrir</button>
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
      <Sheet open={deliver} onClose={() => setDeliver(false)} title={`Entregar ${bareName(kindOf(task))}`}>
        <p className="muted">{task.title}</p>
        <label className="field">
          <span>Link {REQUEST_KINDS[kindOf(task)].of}{task.projection ? '' : ' (opcional)'}</span>
          <input id={`link-${task.id}`} inputMode="url" placeholder={REQUEST_KINDS[kindOf(task)].linkHint} value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        {task.projection && <p className="muted small">A Projeção abre por este link no dia do culto.</p>}
        <button className="btn btn-primary btn-block" disabled={!!task.projection && !link.trim()} onClick={() => {
          actions.setTaskDone(task.id, true, link)
          setDeliver(false)
          notify(task.projection ? 'Entregue! A Projeção e os líderes foram avisados ✅' : 'Entregue! Os líderes foram avisados ✅')
        }}>Confirmar entrega</button>
      </Sheet>
    </div>
  )
}

const OTHER = '__outro__'

/** Formulário de nova arte / edição */
function TaskSheet({ ministry, task, onClose }: { ministry: Ministry; task: Task | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={!!task} onClose={onClose} title={task === 'new' ? 'Novo pedido' : 'Editar pedido'}>
      {task && <TaskForm key={task === 'new' ? 'new' : task.id} ministry={ministry} task={task === 'new' ? null : task} onDone={onClose} />}
    </Sheet>
  )
}

function TaskForm({ ministry, task, onDone }: { ministry: Ministry; task: Task | null; onDone: () => void }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()

  const [kind, setKind] = useState<RequestKind>(task ? kindOf(task) : 'art')
  const K = REQUEST_KINDS[kind]
  const news = kind === 'news'
  // destino: projeção (aparece na escala do culto) e/ou mídias sociais
  const [projection, setProjectionState] = useState(task ? !!task.projection : false)
  const [social, setSocial] = useState(task ? !!task.social : true)
  const socialOn = social && K.social
  // opções prontas: próximos cultos e eventos (fixos e especiais); o vídeo do News só nos cultos com projeção
  const events = useMemo(() => {
    const until = toISO(addDays(new Date(), 35))
    return data.events.filter((e) => e.date >= today && e.date <= until && (!projection || hasProjection(data, e))).sort(sortEvents)
  }, [data, today, projection])

  const groups: [string, typeof events][] = useMemo(() => {
    const week = toISO(addDays(new Date(), 6))
    const next = toISO(addDays(new Date(), 13))
    return [
      ['Próximos 7 dias', events.filter((e) => e.date <= week)],
      ['Semana seguinte', events.filter((e) => e.date > week && e.date <= next)],
      ['Mais adiante', events.filter((e) => e.date > next)],
    ]
  }, [events])

  // responsáveis: equipe do ministério, com a edição do tipo de pedido primeiro (ex.: Edição de fotos)
  const people = useMemo(() => {
    const list = ministryMembers(data, ministry.id)
    // a função mais indicada que a pessoa tem (posição na lista do tipo de pedido)
    const best = (m: (typeof list)[number]) => {
      const roles = m.ministries.find((mm) => mm.ministryId === ministry.id)?.roles ?? []
      const i = K.roles.findIndex((r) => roles.includes(r))
      return i < 0 ? K.roles.length : i
    }
    return [...list].sort((a, b) => best(a) - best(b) || a.name.localeCompare(b.name)).map((m) => ({ m, role: K.roles[best(m)] as string | undefined }))
  }, [data, ministry.id, K])

  const [eventId, setEventId] = useState(task ? task.eventId ?? OTHER : '')
  // vídeo do News: o domingo em que passa (manhã e noite)
  const [airDate, setAirDate] = useState(task?.airDate ?? '')
  const sundays = useMemo(() => newsSundays(data, today), [data, today])
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
    if (id === OTHER || !id) { if (!task) setTitle(id === OTHER && kind !== 'art' ? `${K.prefix} · ` : ''); return }
    const ev = data.events.find((e) => e.id === id)
    if (!ev) return
    setTitle(`${K.prefix} · ${ev.title} (${ddmm(ev.date)})`)
    // prazo padrão: alguns dias antes do evento (nunca antes de hoje)
    const suggested = toISO(addDays(fromISO(ev.date), -K.leadDays))
    setDueDate(suggested < today ? today : suggested)
  }

  const pickSunday = (d: string) => {
    setAirDate(d)
    setError('')
    if (!d) return
    setTitle(`Vídeo do News · domingo ${ddmm(d)}`)
    // prazo padrão: o sábado antes (nunca antes de hoje)
    const suggested = toISO(addDays(fromISO(d), -K.leadDays))
    setDueDate(suggested < today ? today : suggested)
  }

  const save = async () => {
    if (news && !airDate) return setError('Escolha em qual domingo o vídeo do News vai passar.')
    if (!projection && !socialOn) return setError('Escolha para onde vai: projeção, mídias sociais ou as duas.')
    if (!title.trim()) return setError(projection ? 'Escolha em qual culto vai passar na projeção.' : eventId === OTHER ? 'Escreva o nome do pedido ou do evento.' : 'Escolha o culto ou evento do pedido.')
    if (!assigneeId) return setError('Escolha quem vai ficar responsável.')
    if (!dueDate) return setError(`Escolha até quando precisa d${K.the}.`)
    setSaving(true)
    const r = await actions.saveTask({
      id: task?.id, ministryId: ministry.id, title, details, assigneeId, dueDate,
      eventId: !news && eventId && eventId !== OTHER ? eventId : undefined,
      airDate: news ? airDate : undefined,
      kind: kind === 'art' ? undefined : kind,
      projection: projection && projEvent, social: socialOn,
    })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    const who = memberById(data, assigneeId)?.name.split(' ')[0]
    notify(task ? 'Pedido atualizado' : `Pedido enviado para ${who} ${K.emoji}`)
    onDone()
  }

  // projeção só em culto com Projeção: se o culto escolhido não tem, escolhe de novo
  const setProjection = (on: boolean) => {
    setProjectionState(on)
    setError('')
    const ev = data.events.find((e) => e.id === eventId)
    if (on && (eventId === OTHER || (ev && !hasProjection(data, ev)))) { setEventId(''); if (!task) setTitle('') }
  }

  const switchKind = (k: RequestKind) => {
    if (k === kind) return
    setKind(k)
    setError('')
    // o título acompanha o tipo do pedido (o News usa o domingo, não o culto)
    if (k === 'news') setTitle(airDate ? `Vídeo do News · domingo ${ddmm(airDate)}` : '')
    else if (kind === 'news') { setTitle(''); setEventId('') }
    else setTitle((t) => retitle(t, k))
    // destino: o News passa só na projeção; arte, vídeo e fotos começam nas mídias sociais
    setSocial(REQUEST_KINDS[k].social)
    setProjection(k === 'news')
  }

  return (
    <>
      {!task && (
        <div className="chips kind-chips">
          {(Object.keys(REQUEST_KINDS) as RequestKind[]).map((k) => {
            const Icon = KIND_ICON[k]
            return <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => switchKind(k)}><Icon size={15} /> {REQUEST_KINDS[k].chip}</button>
          })}
        </div>
      )}
      <span className="field-label">Para onde vai?</span>
      <div className="chips dest-chips">
        <button className={`chip${projection ? ' on' : ''}`} aria-pressed={projection} disabled={news} onClick={() => setProjection(!projection)}><MonitorPlay size={15} /> Projeção</button>
        {K.social && <button className={`chip${social ? ' on' : ''}`} aria-pressed={social} onClick={() => { setSocial(!social); setError('') }}><Share2 size={15} /> Mídias sociais</button>}
      </div>
      {projection && <p className="muted small">{news ? 'O vídeo do News passa só na projeção, nos dois cultos do domingo: quem editar entrega o link, e a Projeção recebe na escala da manhã e da noite.' : 'Quem fizer entrega o link, e a Projeção recebe dentro da escala do culto em que vai passar.'}</p>}
      {news ? (
        <label className="field">
          <span>Em qual domingo vai passar?</span>
          <select id="task-sunday" value={airDate} onChange={(e) => pickSunday(e.target.value)}>
            <option value="" disabled>Escolha…</option>
            {sundays.map((d) => <option key={d} value={d}>dom, {ddmm(d)} · cultos da manhã e da noite</option>)}
          </select>
        </label>
      ) : (
      <label className="field">
        <span>{projection ? 'Em qual culto vai passar?' : 'Para qual culto ou evento?'}</span>
        <select id="task-event" value={eventId} onChange={(e) => pickEvent(e.target.value)}>
          <option value="" disabled>Escolha…</option>
          {groups.map(([label, list]) => list.length > 0 && (
            <optgroup key={label} label={label}>
              {list.map((e) => (
                <option key={e.id} value={e.id}>{weekdayShort(e.date).toLowerCase()}, {ddmm(e.date)} · {e.title}{e.time ? ` · ${timeRange(e)}` : ''}</option>
              ))}
            </optgroup>
          ))}
          {!projection && <option value={OTHER}>+ Outro evento ou {bareName(kind)}</option>}
        </select>
      </label>
      )}
      {(news ? !!airDate : eventId === OTHER || (eventId && title)) && (
        <label className="field">
          <span>{eventId === OTHER ? K.which : 'Nome do pedido'}</span>
          <input id="task-title" value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder={K.example} />
        </label>
      )}
      <label className="field">
        <span>Detalhes (opcional)</span>
        <textarea id="task-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={K.detailsHint} />
      </label>
      <label className="field">
        <span>Responsável</span>
        <select id="task-assignee" value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); setError('') }}>
          <option value="" disabled>Escolha…</option>
          {people.map(({ m, role }) => <option key={m.id} value={m.id}>{m.name}{role ? ` · ${role}` : ''}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Entregar até</span>
        <input id="task-due" type="date" min={today} value={dueDate} onChange={(e) => { setDueDate(e.target.value); setError('') }} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? 'Salvando…' : task ? 'Salvar alterações' : K.ask}</button>
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
        <span className="arts-home-icon">{(() => { const Icon = mine.every((t) => kindOf(t) === kindOf(mine[0])) ? KIND_ICON[kindOf(mine[0])] : Palette; return <Icon size={18} /> })()}</span>
        <strong className="grow">{mine.length === 1 ? `${REQUEST_KINDS[kindOf(mine[0])].prefix} para entregar` : mine.every((t) => kindOf(t) === 'art') ? `${mine.length} artes para entregar` : `${mine.length} entregas pendentes`}</strong>
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
