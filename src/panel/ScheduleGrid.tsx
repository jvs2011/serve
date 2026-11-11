import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, MessageCircle, Plus, Printer, Repeat, Send, Sparkles, Trash2, Users, X } from 'lucide-react'
import { useStore } from '../data/store'
import { todayISO, weekdayShort } from '../lib/dates'
import { draftsOf, openSlots } from '../lib/schedule'
import { cellOf, gridRoles, panelEvents, plusDays, scheduleText } from '../lib/panel'
import { firstName, memberById, ministryMembers } from '../lib/selectors'
import { shortNames } from '../lib/people'
import { copyText } from '../lib/clipboard'
import { initials } from '../components/ui'
import { Popover, ddmm, whatsapp } from './common'
import { AssignModal, type PickFor } from './AssignModal'
import type { Assignment, ChurchEvent, Ministry } from '../data/types'

const WEEKS_KEY = 'serve:panel:weeks'
const STATUS: Record<string, string> = { confirmed: 'Confirmado', pending: 'Aguardando resposta', declined: 'Recusou' }

type Menu = { anchor: HTMLElement; ev: ChurchEvent; list: Assignment[]; groupId?: string }

/** Grade de escalas: cada linha é um culto/evento, cada coluna uma função */
export function ScheduleGrid({ ministry, focusEvent }: { ministry: Ministry; focusEvent: string | null }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()
  const focusDate = focusEvent ? data.events.find((e) => e.id === focusEvent)?.date : undefined
  const [weeks, setWeeksState] = useState<number>(() => {
    let w = 4
    try { w = Number(localStorage.getItem(WEEKS_KEY)) || 4 } catch { /* ignore */ }
    return focusDate && focusDate > plusDays(today, w * 7 - 1) ? 8 : w
  })
  const setWeeks = (w: number) => { setWeeksState(w); try { localStorage.setItem(WEEKS_KEY, String(w)) } catch { /* ignore */ } }
  const [offset, setOffset] = useState(0)
  const [picking, setPicking] = useState<PickFor | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const from = plusDays(today, offset * 7)
  const until = plusDays(from, weeks * 7 - 1)
  const events = useMemo(() => panelEvents(data, ministry.id, from, until), [data, ministry.id, from, until])
  const roles = useMemo(() => gridRoles(data, ministry, events), [data, ministry, events])
  const drafts = draftsOf(data, ministry.id).length
  // "Davi" vira "Davi Moraes" quando há outro Davi no ministério
  const shortName = useMemo(() => {
    const people = ministryMembers(data, ministry.id)
    const short = shortNames(people.map((m) => m.name))
    const map = new Map(people.map((m, i) => [m.id, short[i]]))
    return (id: string) => map.get(id) ?? firstName(memberById(data, id)?.name ?? '?')
  }, [data, ministry.id])
  const openIn = (list: ChurchEvent[]) => list.reduce((n, e) => n + openSlots(data, e.id, ministry.id).reduce((s, x) => s + x.missing, 0), 0)
  const upcoming = events.filter((e) => e.date >= today)
  const open = openIn(upcoming)

  useEffect(() => {
    if (!focusEvent) return
    const el = document.getElementById(`ev-${focusEvent}`)
    el?.scrollIntoView({ block: 'center' })
  }, [focusEvent])

  const fillAll = () => {
    if (!open) return notify('Todas as vagas deste período já estão preenchidas 🙌')
    const n = actions.autoSchedule(upcoming.map((e) => e.id), ministry.id)
    notify(n === 0 ? 'Ninguém disponível para as vagas abertas (indisponíveis, já escalados ou no limite do mês).'
      : n < open ? `${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} em rascunho. ${open - n} sem ninguém disponível.`
      : `${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} em rascunho ✨ Confira e publique.`)
  }
  const fillOne = (ev: ChurchEvent) => {
    const before = openIn([ev])
    const n = actions.autoSchedule([ev.id], ministry.id)
    notify(n === 0 ? 'Ninguém disponível para as vagas deste culto.' : n < before ? `${n} de ${before} vagas preenchidas em rascunho.` : `${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} em rascunho ✨`)
  }
  const publish = () => {
    const n = actions.publishDrafts(ministry.id)
    notify(n ? `${n} ${n === 1 ? 'escala publicada' : 'escalas publicadas'}: a equipe foi avisada ✅` : 'Nada para publicar.')
  }
  const discard = () => {
    const n = actions.discardDrafts(ministry.id)
    setConfirmDiscard(false)
    notify(`${n} ${n === 1 ? 'escala descartada' : 'escalas descartadas'}.`)
  }
  const copy = async () => {
    const ok = await copyText(scheduleText(data, ministry, events, from, until))
    const hasDrafts = events.some((e) => draftsOf(data, ministry.id, e.id).length)
    notify(ok ? `Escala copiada: cole no grupo do WhatsApp ✅${hasDrafts ? ' (o rascunho não entra)' : ''}` : 'Não deu para copiar neste navegador.')
  }

  return (
    <div className="pn-page pn-schedule">
      <header className="pn-head">
        <div>
          <h1>Escalas</h1>
          <p>{ministry.name} · {ddmm(from)} a {ddmm(until)}</p>
        </div>
        <div className="pn-head-actions no-print">
          <button className="btn btn-ghost btn-sm" onClick={copy} title="Copia a escala publicada em texto, pronta para o grupo"><Copy size={15} /> Copiar para o WhatsApp</button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
          <button className="btn btn-primary btn-sm" onClick={fillAll} disabled={!open} title="Monta um rascunho respeitando disponibilidade, outras escalas, limite do mês e rodízio">
            <Sparkles size={15} /> Preencher {open ? `${open} ${open === 1 ? 'vaga aberta' : 'vagas abertas'}` : 'vagas'}
          </button>
        </div>
      </header>

      <div className="pn-toolbar no-print">
        <div className="pn-range">
          <button className="icon-btn sm" onClick={() => setOffset((o) => o - 1)} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(0)} disabled={offset === 0}>Hoje</button>
          <button className="icon-btn sm" onClick={() => setOffset((o) => o + 1)} aria-label="Próxima semana"><ChevronRight size={18} /></button>
        </div>
        <div className="pn-seg">
          {[2, 4, 8].map((w) => <button key={w} className={weeks === w ? 'on' : ''} onClick={() => setWeeks(w)}>{w} semanas</button>)}
        </div>
        <div className="grow" />
        <div className="pn-legend">
          <span><i className="s-confirmed" /> Confirmado</span>
          <span><i className="s-pending" /> Aguardando</span>
          <span><i className="s-draft" /> Rascunho</span>
          <span><i className="s-open" /> Vaga aberta</span>
        </div>
      </div>

      {drafts > 0 && (
        <div className="pn-draftbar no-print">
          <Send size={18} />
          <div className="grow">
            <strong>{drafts} {drafts === 1 ? 'escala em rascunho' : 'escalas em rascunho'}</strong>
            <span>Só os líderes veem. Ao publicar, cada pessoa recebe a notificação para confirmar.</span>
          </div>
          {confirmDiscard ? (
            <>
              <span className="small">Descartar todo o rascunho?</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDiscard(false)}>Cancelar</button>
              <button className="btn btn-danger btn-sm" onClick={discard}>Descartar</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDiscard(true)}>Descartar</button>
              <button className="btn btn-primary btn-sm" onClick={publish}>Publicar e avisar a equipe</button>
            </>
          )}
        </div>
      )}

      {events.length === 0 ? (
        <div className="pn-card"><p className="pn-empty">Nenhum culto ou evento com vaga para o {ministry.name} entre {ddmm(from)} e {ddmm(until)}.</p></div>
      ) : (
        <div className="pn-grid-wrap">
          <table className="pn-grid">
            <thead>
              <tr>
                <th className="pn-sticky">Culto ou evento</th>
                {roles.map((r) => {
                  const missing = upcoming.reduce((n, e) => n + (openSlots(data, e.id, ministry.id).find((s) => s.role === r.name)?.missing ?? 0), 0)
                  return (
                    <th key={r.name}>
                      {r.name}
                      {r.hint && <small>{r.hint}</small>}
                      {missing > 0 && <small className="bad">{missing} {missing === 1 ? 'aberta' : 'abertas'}</small>}
                    </th>
                  )
                })}
                <th className="pn-act-col no-print" />
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const past = ev.date < today
                const evOpen = past ? 0 : openIn([ev])
                // linha mais marcada quando começa outra semana (domingo a sábado)
                const newWeek = i > 0 && weekStart(ev.date) !== weekStart(events[i - 1].date)
                return (
                  <tr key={ev.id} id={`ev-${ev.id}`} className={`${focusEvent === ev.id ? 'focus' : ''}${past ? ' past' : ''}${newWeek ? ' week' : ''}`}>
                    <th className="pn-sticky pn-evcell">
                      <span className="pn-evdate">{weekdayShort(ev.date)} {ddmm(ev.date)}{ev.date === today && <em> · hoje</em>}</span>
                      <span className="pn-evtitle">{ev.time && `${ev.time} · `}{ev.title}</span>
                      {(ev.special || ev.place) && <span className="pn-evmeta">{ev.special ? 'Evento especial' : ''}{ev.special && ev.place ? ' · ' : ''}{ev.place}</span>}
                    </th>
                    {roles.map((r) => {
                      const c = cellOf(data, ev, ministry.id, r.name)
                      if (!c.count && !c.units.length) return <td key={r.name} className="pn-na">—</td>
                      return (
                        <td key={r.name}>
                          <div className="pn-cell">
                            {c.units.map((u) => {
                              const draft = u.list.some((a) => a.draft)
                              const confirmed = u.list.every((a) => a.status === 'confirmed')
                              const swap = data.swaps.some((s) => s.status === 'open' && u.list.some((a) => a.id === s.assignmentId))
                              const cls = `pn-chip ${draft ? 's-draft' : confirmed ? 's-confirmed' : 's-pending'}${swap ? ' swap' : ''}`
                              if (u.groupId) {
                                const g = ministry.groups?.find((x) => x.id === u.groupId)
                                return (
                                  <button key={u.groupId} className={`${cls} group`} onClick={(e) => setMenu({ anchor: e.currentTarget, ev, list: u.list, groupId: u.groupId })}
                                    title={u.list.map((a) => `${memberById(data, a.memberId)?.name}: ${STATUS[a.status]}`).join('\n')}>
                                    <Users size={13} /> {g?.name ?? 'Grupo'} <small>{u.list.length}</small>
                                  </button>
                                )
                              }
                              const a = u.list[0]
                              const m = memberById(data, a.memberId)
                              return (
                                <button key={a.id} className={cls} onClick={(e) => setMenu({ anchor: e.currentTarget, ev, list: u.list })}
                                  title={`${m?.name ?? ''} · ${draft ? 'Rascunho (não publicado)' : STATUS[a.status]}${swap ? ' · pediu troca' : ''}`}>
                                  <i>{initials(m?.name ?? '?')}</i> {shortName(a.memberId)}{swap && <Repeat size={12} />}
                                </button>
                              )
                            })}
                            {c.missing > 0 && (past
                              ? <span className="pn-missing">{c.missing} sem ninguém</span>
                              : <button className="pn-add no-print" onClick={() => setPicking({ ev, role: r.name })}><Plus size={14} /> Escalar{c.missing > 1 ? ` · ${c.missing}` : ''}</button>)}
                            {c.declined.map((a) => <span key={a.id} className="pn-declined" title="Recusou">{shortName(a.memberId)}</span>)}
                          </div>
                        </td>
                      )
                    })}
                    <td className="pn-act-col no-print">
                      {evOpen > 0 && <button className="icon-btn sm" onClick={() => fillOne(ev)} title="Preencher as vagas deste culto"><Sparkles size={16} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small pn-foot-note no-print">Quem você escala entra no rascunho e só recebe o aviso quando você publica. Clique em um nome para trocar ou tirar da escala.</p>

      {menu && <ChipMenu menu={menu} ministry={ministry} onClose={() => setMenu(null)} onReplace={(a) => { setMenu(null); setPicking({ ev: menu.ev, role: a.role, replace: a }) }} />}
      {picking && <AssignModal ministry={ministry} picking={picking} onClose={() => setPicking(null)} />}
    </div>
  )
}

const weekStart = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return plusDays(iso, -new Date(y, m - 1, d).getDay()) }

/** Menu de quem está na escala: status, trocar, tirar, WhatsApp */
function ChipMenu({ menu, ministry, onClose, onReplace }: { menu: Menu; ministry: Ministry; onClose: () => void; onReplace: (a: Assignment) => void }) {
  const { data, actions, notify } = useStore()
  const past = menu.ev.date < todayISO()
  const swapOf = (a: Assignment) => data.swaps.find((s) => s.status === 'open' && s.assignmentId === a.id)
  if (menu.groupId) {
    const g = ministry.groups?.find((x) => x.id === menu.groupId)
    return (
      <Popover anchor={menu.anchor} onClose={onClose}>
        <div className="pn-menu pn-chipmenu">
          <div className="pn-menu-head"><strong>{g?.name ?? 'Grupo'}</strong><span>{menu.list[0]?.role}</span></div>
          <ul className="pn-menu-people">
            {menu.list.map((a) => (
              <li key={a.id}><span className="grow">{memberById(data, a.memberId)?.name}</span><span className={`pill ${a.draft ? 'pill-draft' : a.status === 'confirmed' ? 'pill-confirmed' : 'pill-pending'}`}>{a.draft ? 'Rascunho' : STATUS[a.status]}</span></li>
            ))}
          </ul>
          {!past && (
            <button className="danger" onClick={() => { actions.unassignGroup(menu.ev.id, menu.groupId!); notify(`${g?.name ?? 'Grupo'} saiu da escala.`); onClose() }}>
              <Trash2 size={16} /> Tirar o grupo da escala
            </button>
          )}
        </div>
      </Popover>
    )
  }
  const a = menu.list[0]
  const m = memberById(data, a.memberId)
  const swap = swapOf(a)
  return (
    <Popover anchor={menu.anchor} onClose={onClose}>
      <div className="pn-menu pn-chipmenu">
        <div className="pn-menu-head">
          <strong>{m?.name}</strong>
          <span>{a.role} · {a.draft ? 'Rascunho (ainda não avisado)' : STATUS[a.status]}{a.checkedIn ? ' · fez check-in' : ''}</span>
          {swap && <span className="warn small">Pediu troca{swap.reason ? `: “${swap.reason}”` : ''}</span>}
        </div>
        {!past && <button onClick={() => onReplace(a)}><Repeat size={16} /> Trocar por outra pessoa</button>}
        {m && whatsapp(m) && <a href={whatsapp(m)} target="_blank" rel="noreferrer" onClick={onClose}><MessageCircle size={16} /> Chamar no WhatsApp</a>}
        {!past && (
          <button className="danger" onClick={() => { actions.unassign(a.id); notify(`${firstName(m?.name ?? '')} saiu da escala.`); onClose() }}>
            {a.draft ? <X size={16} /> : <Trash2 size={16} />} {a.draft ? 'Tirar do rascunho' : 'Tirar da escala'}
          </button>
        )}
      </div>
    </Popover>
  )
}
