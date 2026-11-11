import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarPlus, ChevronLeft, ChevronRight, Copy, ExternalLink, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { useStore } from '../data/store'
import { addDays, monthLong, timeRange, toISO, todayISO, weekdayShort } from '../lib/dates'
import { draftsOf, openSlots, slotsFor, sortEvents } from '../lib/schedule'
import { EVENT_KIND_LABEL, eventKind, plusDays } from '../lib/panel'
import { copyText } from '../lib/clipboard'
import { DEFAULT_WEEKLY, EVERY_WEEKDAY, frequencyLabel } from '../data/agenda'
import { fillOf, NewEventSheet } from '../screens/Agenda'
import { EventEditForm } from '../screens/MinistryEvents'
import { WeeklyForm } from '../screens/Weekly'
import { Avatar, MinistryBadge } from '../components/ui'
import { Fill, Modal, Popover, ddmm, evLabel } from './common'
import { PersonEditor } from './PeopleView'
import type { Section } from './Panel'
import type { ChurchEvent, Member, WeeklySlot } from '../data/types'

/* ======================= Visão da igreja ======================= */

/** Coordenação: a igreja inteira de uma vez (ministérios, cadastros e o que precisa de ajuste) */
export function ChurchView({ go, pick }: { go: (s: Section) => void; pick: (id: string) => void }) {
  const { data, mode, reload } = useStore()
  useEffect(() => { reload() }, [reload])
  const today = todayISO()
  const [editing, setEditing] = useState<Member | null>(null)
  const rows = useMemo(() => data.ministries.map((m) => {
    let total = 0, confirmed = 0, pending = 0, open14 = 0
    for (const ev of data.events) {
      if (ev.date < today || ev.date > plusDays(today, 30) || !ev.ministryIds.includes(m.id)) continue
      const f = fillOf(data, ev, [m.id])
      total += f.total; confirmed += f.confirmed; pending += f.pending
      if (ev.date <= plusDays(today, 13)) open14 += openSlots(data, ev.id, m.id).reduce((s, x) => s + x.missing, 0)
    }
    const people = data.members.filter((x) => x.ministries.some((mm) => mm.ministryId === m.id)).length
    const swaps = data.swaps.filter((s) => s.status === 'open' && data.assignments.find((a) => a.id === s.assignmentId)?.ministryId === m.id).length
    return { m, total, confirmed, pending, open14, people, drafts: draftsOf(data, m.id).length, swaps, leaders: m.leaderIds.map((id) => data.members.find((x) => x.id === id)?.name.split(' ')[0]).filter(Boolean) }
  }), [data, today])

  const recent = data.members.filter((m) => m.createdAt && m.createdAt.slice(0, 10) >= plusDays(today, -14)).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const fix = data.members.filter((m) => !m.ministries.length || m.ministries.some((mm) => !mm.roles.length && !data.ministries.find((x) => x.id === mm.ministryId)?.leaderIds.includes(m.id)))
  const noLeader = data.ministries.filter((m) => !m.leaderIds.length)
  const withPin = data.members.filter((m) => m.hasPin).length
  const week = data.events.filter((e) => e.date >= today && e.date <= plusDays(today, 6)).length
  const sum = (k: 'open14' | 'drafts' | 'swaps') => rows.reduce((n, r) => n + r[k], 0)

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div><h1>Visão da igreja</h1><p>Todos os ministérios, os cadastros novos e o que precisa de ajuste.</p></div>
        <div className="pn-head-actions"><button className="btn btn-ghost btn-sm" onClick={() => go('people')}><UserPlus size={15} /> Pessoas</button></div>
      </header>
      <div className="pn-kpis">
        <Kpi label="Pessoas cadastradas" value={data.members.length} sub={mode === 'live' ? `${withPin} já criaram o PIN` : 'voluntários e líderes'} />
        <Kpi label="Cadastros novos" value={recent.length} sub="nos últimos 14 dias" tone={recent.length ? 'info' : undefined} />
        <Kpi label="Vagas abertas" value={sum('open14')} sub="todos os ministérios · 14 dias" tone={sum('open14') ? 'bad' : 'ok'} />
        <Kpi label="Rascunhos" value={sum('drafts')} sub="escalas ainda não publicadas" tone={sum('drafts') ? 'info' : undefined} />
        <Kpi label="Trocas pedidas" value={sum('swaps')} sub="esperando alguém assumir" tone={sum('swaps') ? 'warn' : undefined} />
        <Kpi label="Eventos" value={week} sub="nos próximos 7 dias" />
      </div>
      <div className="pn-cols">
        <div className="pn-col">
          <section className="pn-card pn-card-flush">
            <div className="pn-card-head pn-pad"><h2>Ministérios</h2><span className="muted small">próximos 30 dias · clique para abrir</span></div>
            <table className="pn-table">
              <thead><tr><th>Ministério</th><th>Líderes</th><th>Pessoas</th><th style={{ width: '22%' }}>Preenchimento</th><th>Abertas</th><th>Rascunho</th><th>Trocas</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.m.id} className="pn-click" onClick={() => { pick(r.m.id); go('overview') }}>
                    <td><div className="pn-person"><MinistryBadge ministry={r.m} size={26} /><strong>{r.m.name}</strong></div></td>
                    <td className="small">{r.leaders.length ? r.leaders.join(', ') : <span className="bad">sem líder</span>}</td>
                    <td>{r.people}</td>
                    <td>{r.total ? <div className="pn-fill-row"><Fill total={r.total} confirmed={r.confirmed} pending={r.pending} color={r.m.color} /><span className="small muted">{Math.round(((r.confirmed + r.pending) / r.total) * 100)}%</span></div> : <span className="muted small">sem escala</span>}</td>
                    <td>{r.open14 ? <span className="pn-num bad">{r.open14}</span> : <span className="muted">—</span>}</td>
                    <td>{r.drafts ? <span className="pn-num info">{r.drafts}</span> : <span className="muted">—</span>}</td>
                    <td>{r.swaps ? <span className="pn-num warn">{r.swaps}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <div className="pn-col">
          <section className="pn-card">
            <div className="pn-card-head"><h2>Cadastros novos</h2><span className="pn-count">{recent.length}</span></div>
            {recent.length === 0 ? <p className="pn-empty">Nenhum cadastro nos últimos 14 dias.</p> : (
              <ul className="pn-people">
                {recent.slice(0, 8).map((m) => (
                  <li key={m.id} className="pn-click" onClick={() => setEditing(m)}>
                    <Avatar name={m.name} size={32} />
                    <div className="grow">
                      <strong>{m.name}</strong>
                      <span className="muted small block">{m.ministries.map((mm) => `${data.ministries.find((x) => x.id === mm.ministryId)?.name}${mm.roles.length ? ` (${mm.roles.join(', ')})` : ''}`).join(' · ') || 'Sem ministério'}</span>
                      {m.interests?.some((i) => i.roles.length) && <span className="small block pn-interest">Interesse: {m.interests.flatMap((i) => i.roles).join(', ')}</span>}
                    </div>
                    <span className="muted small nowrap">{new Date(m.createdAt!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {(fix.length > 0 || noLeader.length > 0) && (
            <section className="pn-card">
              <div className="pn-card-head"><h2>Precisa de ajuste</h2><span className="pn-count">{fix.length + noLeader.length}</span></div>
              {noLeader.length > 0 && <p className="small pn-fix"><b>Sem líder:</b> {noLeader.map((m) => m.name).join(', ')}. Marque o líder no cadastro da pessoa.</p>}
              {fix.length > 0 && <p className="muted small pn-card-sub">Sem ministério ou sem função: não entram na escala.</p>}
              <ul className="pn-people">
                {fix.slice(0, 8).map((m) => (
                  <li key={m.id} className="pn-click" onClick={() => setEditing(m)}>
                    <Avatar name={m.name} size={30} />
                    <div className="grow"><strong className="small">{m.name}</strong><span className="muted small block">{m.ministries.length ? `Sem função em ${m.ministries.filter((mm) => !mm.roles.length).map((mm) => data.ministries.find((x) => x.id === mm.ministryId)?.name).join(', ')}` : 'Sem ministério'}</span></div>
                    <ArrowRight size={15} className="muted" />
                  </li>
                ))}
              </ul>
              {fix.length > 8 && <button className="link pn-more" onClick={() => go('people')}>Ver todos ({fix.length})</button>}
            </section>
          )}
        </div>
      </div>
      {editing && <PersonEditor member={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: 'ok' | 'warn' | 'bad' | 'info' }) {
  return <div className="pn-kpi"><span>{label}</span><b className={tone ?? ''}>{value}</b><small>{sub}</small></div>
}

/* ======================= Agenda da igreja (mês) ======================= */

const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Coordenação: o mês inteiro, com todos os cultos e eventos; criar, editar e cancelar */
export function CalendarView({ go, pick }: { go: (s: Section, eventId?: string) => void; pick: (id: string) => void }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()
  const [offset, setOffset] = useState(0)
  const [creating, setCreating] = useState(false)
  const [sel, setSel] = useState<{ ev: ChurchEvent; anchor: HTMLElement } | null>(null)
  const [editing, setEditing] = useState<ChurchEvent | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const base = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + offset, 1)
  const y = base.getFullYear(), mo = base.getMonth()
  const weeks = useMemo(() => {
    const first = new Date(y, mo, 1)
    const start = addDays(first, -first.getDay())
    const last = new Date(y, mo + 1, 0)
    const n = Math.ceil((first.getDay() + last.getDate()) / 7)
    return Array.from({ length: n }, (_, w) => Array.from({ length: 7 }, (_, d) => toISO(addDays(start, w * 7 + d))))
  }, [y, mo])
  const byDay = useMemo(() => {
    const map = new Map<string, ChurchEvent[]>()
    for (const e of [...data.events].sort(sortEvents)) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [data.events])
  const monthKey = `${y}-${String(mo + 1).padStart(2, '0')}`
  const inMonth = data.events.filter((e) => e.date.startsWith(monthKey))

  const cancel = async (ev: ChurchEvent) => {
    const r = await actions.removeEvent(ev.id)
    setConfirmDel(false); setSel(null)
    notify(r.ok ? `${ev.title} (${ddmm(ev.date)}) cancelado. Quem estava escalado é avisado.` : r.error)
  }

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div><h1>Agenda da igreja</h1><p>{monthLong(mo)[0].toUpperCase() + monthLong(mo).slice(1)} de {y} · {inMonth.length} cultos e eventos. Clique em um evento para editar, cancelar ou abrir a escala.</p></div>
        <div className="pn-head-actions"><button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><CalendarPlus size={16} /> Novo evento especial</button></div>
      </header>
      <div className="pn-toolbar">
        <div className="pn-range">
          <button className="icon-btn sm" onClick={() => setOffset((o) => o - 1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(0)} disabled={offset === 0}>Este mês</button>
          <button className="icon-btn sm" onClick={() => setOffset((o) => o + 1)} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
        <div className="grow" />
        <div className="pn-legend">
          {(['fixed', 'special', 'ministry', 'session'] as const).map((k) => <span key={k}><i className={`k-${k}`} /> {EVENT_KIND_LABEL[k]}</span>)}
        </div>
      </div>
      <div className="pn-cal">
        {WD_SHORT.map((d) => <div key={d} className="pn-cal-wd">{d}</div>)}
        {weeks.flat().map((iso) => {
          const evs = byDay.get(iso) ?? []
          const out = !iso.startsWith(monthKey)
          return (
            <div key={iso} className={`pn-cal-day${out ? ' out' : ''}${iso === today ? ' today' : ''}${iso < today ? ' past' : ''}`}>
              <span className="pn-cal-n">{Number(iso.slice(8))}</span>
              {evs.slice(0, 5).map((e) => (
                <button key={e.id} className={`pn-cal-ev k-${eventKind(e)}`} onClick={(x) => { setConfirmDel(false); setSel({ ev: e, anchor: x.currentTarget }) }} title={`${e.time} ${e.title}`}>
                  <b>{e.time || '—'}</b> {e.title}
                </button>
              ))}
              {evs.length > 5 && <span className="muted small">+{evs.length - 5}</span>}
            </div>
          )
        })}
      </div>

      {sel && (
        <Popover anchor={sel.anchor} onClose={() => setSel(null)}>
          <div className="pn-menu pn-evpop">
            <div className="pn-menu-head">
              <strong>{sel.ev.title}</strong>
              <span>{weekdayShort(sel.ev.date)}, {ddmm(sel.ev.date)} · {timeRange(sel.ev)}{sel.ev.place ? ` · ${sel.ev.place}` : ''}</span>
              <span>{EVENT_KIND_LABEL[eventKind(sel.ev)]}{sel.ev.edited ? ' · ajustado à mão' : ''}</span>
            </div>
            {sel.ev.ministryIds.length === 0 && <p className="muted small pn-evpop-note">Sem escala de ministérios.</p>}
            {sel.ev.ministryIds.map((id) => {
              const m = data.ministries.find((x) => x.id === id)
              if (!m || !slotsFor(data, sel.ev, id).length) return null
              const f = fillOf(data, sel.ev, [id])
              return (
                <button key={id} onClick={() => { pick(id); go('schedule', sel.ev.date >= today ? sel.ev.id : undefined); setSel(null) }}>
                  <MinistryBadge ministry={m} size={20} /> <span className="grow">{m.name}</span>
                  <span className={`small ${f.open ? 'bad' : 'muted'}`}>{f.confirmed + f.pending}/{f.total}</span>
                </button>
              )
            })}
            {sel.ev.date >= today && <div className="pn-menu-sep" />}
            {sel.ev.date >= today && <button onClick={() => { setEditing(sel.ev); setSel(null) }}><Pencil size={16} /> Editar este dia</button>}
            {sel.ev.date >= today && (confirmDel
              ? <button className="danger" onClick={() => cancel(sel.ev)}><Trash2 size={16} /> Confirmar: cancelar {ddmm(sel.ev.date)}</button>
              : <button className="danger" onClick={() => setConfirmDel(true)}><Trash2 size={16} /> Cancelar este dia</button>)}
          </div>
        </Popover>
      )}
      {editing && <Modal title="Editar evento" subtitle={evLabel(editing)} onClose={() => setEditing(null)} width={560}><EventEditForm ev={editing} onDone={() => setEditing(null)} /></Modal>}
      <NewEventSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

/* ======================= Cultos da semana ======================= */

/** Coordenação: a agenda fixa da igreja, um dia da semana por coluna */
export function WeeklyView() {
  const { data } = useStore()
  const weekly = data.weekly ?? DEFAULT_WEEKLY
  const [editing, setEditing] = useState<WeeklySlot | 'new' | null>(null)
  return (
    <div className="pn-page">
      <header className="pn-head">
        <div><h1>Cultos da semana</h1><p>Os cultos e encontros que se repetem. Ao mudar aqui, os próximos eventos são atualizados e as escalas já feitas continuam. Para mudar só um dia, use a Agenda da igreja.</p></div>
        <div className="pn-head-actions"><button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={16} /> Novo culto fixo</button></div>
      </header>
      <div className="pn-week">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const slots = weekly.filter((s) => s.day === day).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
          return (
            <div key={day} className="pn-week-col">
              <h3>{EVERY_WEEKDAY[day]}</h3>
              {slots.map((s) => (
                <button key={s.id} className="pn-week-slot" onClick={() => setEditing(s)}>
                  <span className="pn-week-time">{s.time}{s.endTime ? `–${s.endTime}` : ''}</span>
                  <strong>{s.title}</strong>
                  <span className="muted small">{frequencyLabel(s)}{s.place ? ` · ${s.place}` : ''}</span>
                  <span className="pn-week-mins">
                    {s.ministryIds.length === 0 ? <span className="muted small">Sem escala</span> : s.ministryIds.map((id) => {
                      const m = data.ministries.find((x) => x.id === id)
                      return m ? <span key={id} title={m.name}><MinistryBadge ministry={m} size={20} /></span> : null
                    })}
                  </span>
                </button>
              ))}
              {slots.length === 0 && <span className="muted small pn-week-empty">—</span>}
            </div>
          )
        })}
      </div>
      {editing && (
        <Modal title={editing === 'new' ? 'Novo culto fixo' : `Editar · ${editing.title}`} subtitle={editing === 'new' ? undefined : `${EVERY_WEEKDAY[editing.day]} · ${editing.time}`} onClose={() => setEditing(null)} width={600}>
          <WeeklyForm slot={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}

/* ======================= Configurações ======================= */

/** Coordenação: liberar o app, demonstração na tela de entrada e os links dos formulários de cadastro */
export function SettingsView() {
  const { data, actions, notify, mode } = useStore()
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const open = data.settings?.open === true
  const demo = data.settings?.demo !== false
  const people = data.members.filter((m) => m.access !== 'admin').length
  const site = mode === 'live' ? location.origin : 'https://serve.lagoinhafranca.com'
  const setOpen = async (v: boolean) => {
    setBusy(true)
    const r = await actions.setOpen(v)
    setBusy(false); setConfirmOpen(false)
    notify(r.ok ? (v ? 'App liberado para todos 🎉' : 'Acesso restrito à coordenação') : r.error)
  }
  const setDemo = async (v: boolean) => {
    setBusy(true)
    const r = await actions.setDemo(v)
    setBusy(false)
    notify(r.ok ? (v ? 'A demonstração voltou para a tela de entrada' : 'Demonstração escondida da tela de entrada') : r.error)
  }

  return (
    <div className="pn-page">
      <header className="pn-head"><div><h1>Configurações</h1><p>Quem entra no app, a demonstração e os formulários de cadastro.</p></div></header>
      {mode === 'demo' && <p className="pn-note">Na demonstração, estas chaves mudam só os dados de exemplo.</p>}
      <div className="pn-cols pn-cols-even">
        <section className="pn-card">
          <div className="pn-card-head"><h2>Acesso ao app</h2><span className={`pill ${open ? 'pill-confirmed' : 'pill-pending'}`}>{open ? 'Liberado para todos' : 'Só a coordenação'}</span></div>
          <p className="muted small pn-card-sub">{open
            ? 'Todas as pessoas cadastradas entram com o celular e o PIN.'
            : `Fase de cadastros: ${people} ${people === 1 ? 'pessoa cadastrada ainda não entra e vê' : 'pessoas cadastradas ainda não entram e veem'} a mensagem “em breve teremos novidades”. O formulário continua funcionando.`}</p>
          {confirmOpen ? (
            <div className="pn-inline-confirm">
              <span className="small">Liberar o Serve para {people === 1 ? 'a pessoa cadastrada' : `as ${people} pessoas cadastradas`}?</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmOpen(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setOpen(true)}>Liberar</button>
            </div>
          ) : open
            ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen(false)}>Voltar a restringir</button>
            : <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setConfirmOpen(true)}>Liberar o app para todos</button>}
        </section>
        <section className="pn-card">
          <div className="pn-card-head"><h2>Demonstração na tela de entrada</h2><span className={`pill ${demo ? 'pill-confirmed' : 'pill-draft'}`}>{demo ? 'Aparecendo' : 'Escondida'}</span></div>
          <p className="muted small pn-card-sub">{demo
            ? 'Quem abre o Serve vê os perfis de exemplo para conhecer o app sem entrar.'
            : 'A tela de entrada mostra só o celular e o PIN. Os dados de exemplo continuam guardados.'}</p>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDemo(!demo)}>{demo ? 'Esconder a demonstração' : 'Mostrar a demonstração'}</button>
        </section>
      </div>
      <section className="pn-card pn-card-flush">
        <div className="pn-card-head pn-pad"><h2>Formulários de cadastro</h2><span className="muted small">mande o link no grupo de WhatsApp do ministério</span></div>
        <table className="pn-table">
          <thead><tr><th>Ministério</th><th>Link</th><th>Cadastros pelo formulário</th><th /></tr></thead>
          <tbody>
            {data.ministries.map((m) => {
              const url = `${site}/cadastro/${m.id}`
              const n = data.members.filter((x) => x.source === 'form' && x.ministries.some((mm) => mm.ministryId === m.id)).length
              return (
                <tr key={m.id}>
                  <td><div className="pn-person"><MinistryBadge ministry={m} size={24} /><strong>{m.name}</strong></div></td>
                  <td className="small"><code>{url.replace(/^https?:\/\//, '')}</code></td>
                  <td>{n || <span className="muted">—</span>}</td>
                  <td className="right nowrap">
                    <button className="btn btn-ghost btn-sm" onClick={async () => notify(await copyText(url) ? 'Link copiado ✅' : url)}><Copy size={14} /> Copiar</button>
                    <a className="icon-btn sm" href={`/cadastro/${m.id}`} target="_blank" rel="noreferrer" title="Abrir o formulário"><ExternalLink size={16} /></a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
