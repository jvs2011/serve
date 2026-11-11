import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Clock, ExternalLink, FileWarning, HeartHandshake, MessageCircle, Repeat, Send, UploadCloud, UserPlus } from 'lucide-react'
import { useStore } from '../data/store'
import { addDays, daysBetween, relativeDay, toISO, todayISO } from '../lib/dates'
import { openSlots } from '../lib/schedule'
import { careList, panelEvents, plusDays, teamRows, type Attention } from '../lib/panel'
import { deliveryLabel } from '../lib/delivery'
import { firstName, memberById } from '../lib/selectors'
import { fillOf } from '../screens/Agenda'
import { Avatar, MinistryBadge } from '../components/ui'
import { Fill, ddmm, whatsapp } from './common'
import { AssignModal, type PickFor } from './AssignModal'
import type { Section } from './Panel'
import type { Ministry } from '../data/types'

export function Overview({ ministry, managed, attention, go, pick }: {
  ministry: Ministry; managed: Ministry[]; attention: Attention[]; go: (s: Section, eventId?: string) => void; pick: (id: string) => void
}) {
  const { data, actions, notify } = useStore()
  const today = todayISO()
  const [picking, setPicking] = useState<PickFor | null>(null)
  const [showAll, setShowAll] = useState(false)

  const next30 = useMemo(() => panelEvents(data, ministry.id, today, plusDays(today, 30)), [data, ministry.id, today])
  const stats = useMemo(() => {
    let total = 0, confirmed = 0, pending = 0
    for (const ev of next30) {
      const f = fillOf(data, ev, [ministry.id])
      total += f.total; confirmed += f.confirmed; pending += f.pending
    }
    const open14 = next30.filter((e) => e.date <= plusDays(today, 13)).reduce((n, e) => n + openSlots(data, e.id, ministry.id).reduce((s, x) => s + x.missing, 0), 0)
    const ids = new Set(next30.map((e) => e.id))
    const waiting = data.assignments.filter((a) => ids.has(a.eventId) && a.ministryId === ministry.id && a.status === 'pending' && !a.draft).length
    const swaps = attention.filter((x) => x.kind === 'swap').length
    const drafts = data.assignments.filter((a) => a.draft && a.ministryId === ministry.id).length
    const from = plusDays(today, -30)
    const pastIds = new Set(data.events.filter((e) => e.date < today && e.date >= from).map((e) => e.id))
    const served = data.assignments.filter((a) => a.ministryId === ministry.id && pastIds.has(a.eventId) && a.status === 'confirmed')
    const presence = served.length ? Math.round((served.filter((a) => a.checkedIn).length / served.length) * 100) : null
    return { total, confirmed, pending, open14, waiting, swaps, drafts, presence }
  }, [data, next30, ministry.id, today, attention])

  const care = useMemo(() => careList(teamRows(data, ministry.id, today), today), [data, ministry.id, today])
  const pct = stats.total ? Math.round(((stats.confirmed + stats.pending) / stats.total) * 100) : 100

  const publish = () => {
    const n = actions.publishDrafts(ministry.id)
    notify(n ? `${n} ${n === 1 ? 'escala publicada' : 'escalas publicadas'}: a equipe foi avisada ✅` : 'Nada para publicar.')
  }

  const shown = showAll ? attention : attention.slice(0, 8)

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Visão geral</h1>
          <p>{ministry.name} · próximos 30 dias</p>
        </div>
      </header>

      <div className="pn-kpis">
        <Kpi label="Vagas preenchidas" value={`${pct}%`} sub={`${stats.confirmed + stats.pending} de ${stats.total} · 30 dias`} />
        <Kpi label="Vagas abertas" value={stats.open14} sub="nos próximos 14 dias" tone={stats.open14 ? 'bad' : 'ok'} onClick={() => go('schedule')} />
        <Kpi label="Aguardando resposta" value={stats.waiting} sub="ainda não confirmaram" tone={stats.waiting ? 'warn' : undefined} />
        <Kpi label="Trocas pedidas" value={stats.swaps} sub="esperando alguém assumir" tone={stats.swaps ? 'warn' : undefined} />
        <Kpi label="Rascunho" value={stats.drafts} sub="escalas para publicar" tone={stats.drafts ? 'info' : undefined} onClick={() => go('schedule')} />
        <Kpi label="Presença" value={stats.presence === null ? '—' : `${stats.presence}%`} sub="check-ins nos últimos 30 dias" />
      </div>

      <div className="pn-cols">
        <div className="pn-col">
          <section className="pn-card">
            <div className="pn-card-head">
              <h2>Precisa da sua atenção</h2>
              {attention.length > 0 && <span className="pn-count">{attention.length}</span>}
            </div>
            {attention.length === 0 ? (
              <p className="pn-empty"><CheckCircle2 size={18} className="ok" /> Tudo em dia: nenhuma vaga aberta, troca ou rascunho pendente. 🙌</p>
            ) : (
              <ul className="pn-attn">
                {shown.map((x, i) => <AttentionRow key={i} x={x} today={today} go={go} publish={publish} setPicking={setPicking} />)}
              </ul>
            )}
            {attention.length > 8 && <button className="link pn-more" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Mostrar menos' : `Ver todos (${attention.length})`}</button>}
          </section>

          <section className="pn-card">
            <div className="pn-card-head">
              <h2>Próximos cultos e eventos</h2>
              <button className="link" onClick={() => go('schedule')}>Abrir a grade <ArrowRight size={14} /></button>
            </div>
            {next30.length === 0 ? <p className="pn-empty">Nenhum culto ou evento com vaga para o {ministry.name} nos próximos 30 dias.</p> : (
              <table className="pn-table">
                <thead><tr><th>Quando</th><th>Evento</th><th style={{ width: '30%' }}>Preenchimento</th><th>Abertas</th><th>Aguardando</th><th /></tr></thead>
                <tbody>
                  {next30.slice(0, 10).map((ev) => {
                    const f = fillOf(data, ev, [ministry.id])
                    return (
                      <tr key={ev.id} className="pn-click" onClick={() => go('schedule', ev.id)}>
                        <td className="nowrap"><strong>{relativeDay(ev.date)}</strong><span className="muted small block">{ddmm(ev.date)}{ev.time && ` · ${ev.time}`}</span></td>
                        <td>{ev.title}{ev.special && <span className="tag pn-tag-special">especial</span>}</td>
                        <td><div className="pn-fill-row"><Fill total={f.total} confirmed={f.confirmed} pending={f.pending} /><span className="small muted">{f.confirmed + f.pending}/{f.total}</span></div></td>
                        <td>{f.open ? <span className="pn-num bad">{f.open}</span> : <span className="muted">—</span>}</td>
                        <td>{f.pending ? <span className="pn-num warn">{f.pending}</span> : <span className="muted">—</span>}</td>
                        <td className="right"><ArrowRight size={16} className="muted" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="pn-col">
          {managed.length > 1 && <MinistriesCard managed={managed} current={ministry} pick={pick} />}
          <MaterialCard ministry={ministry} />
          <section className="pn-card">
            <div className="pn-card-head">
              <h2>Quem precisa de cuidado</h2>
              <HeartHandshake size={18} className="accent" />
            </div>
            <p className="muted small pn-card-sub">Sem escala marcada e sem servir há mais de 3 semanas.</p>
            {care.length === 0 ? <p className="pn-empty">Toda a equipe está ativa. Glória a Deus! 🙌</p> : (
              <ul className="pn-people">
                {care.slice(0, 8).map((r) => (
                  <li key={r.member.id}>
                    <Avatar name={r.member.name} size={32} />
                    <div className="grow">
                      <strong>{r.member.name}</strong>
                      <span className="muted small block">{r.last ? `Serviu há ${daysBetween(r.last, today)} dias` : 'Ainda não serviu'} · {r.roles.join(', ') || 'sem função'}</span>
                    </div>
                    {whatsapp(r.member) && <a className="btn btn-ghost btn-sm" href={whatsapp(r.member)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Chamar</a>}
                  </li>
                ))}
              </ul>
            )}
            {care.length > 8 && <p className="muted small">E mais {care.length - 8}. Veja todos em Equipe.</p>}
          </section>
        </div>
      </div>

      {picking && <AssignModal ministry={ministry} picking={picking} onClose={() => setPicking(null)} />}
    </div>
  )
}

function Kpi({ label, value, sub, tone, onClick }: { label: string; value: string | number; sub: string; tone?: 'ok' | 'warn' | 'bad' | 'info'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`pn-kpi${onClick ? ' pn-click' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <b className={tone ?? ''}>{value}</b>
      <small>{sub}</small>
    </Tag>
  )
}

function AttentionRow({ x, today, go, publish, setPicking }: {
  x: Attention; today: string; go: (s: Section, eventId?: string) => void; publish: () => void; setPicking: (p: PickFor) => void
}) {
  const when = 'ev' in x ? `${relativeDay(x.ev.date)}${x.ev.time ? ` · ${x.ev.time}` : ''} · ${x.ev.title}` : ''
  switch (x.kind) {
    case 'drafts':
      return (
        <li className="info">
          <Send size={18} />
          <div className="grow"><strong>{x.count} {x.count === 1 ? 'escala em rascunho' : 'escalas em rascunho'}</strong><span>Só os líderes veem. Publique para a equipe ser avisada.</span></div>
          <button className="btn btn-ghost btn-sm" onClick={() => go('schedule')}>Conferir</button>
          <button className="btn btn-primary btn-sm" onClick={publish}>Publicar</button>
        </li>
      )
    case 'swap':
      return (
        <li className="warn">
          <Repeat size={18} />
          <div className="grow"><strong>{x.member.name} pediu troca · {x.a.role}</strong><span>{when}{x.swap.reason ? ` · “${x.swap.reason}”` : ''}</span></div>
          <button className="btn btn-ghost btn-sm" onClick={() => setPicking({ ev: x.ev, role: x.a.role, replace: x.a })}>Escalar substituto</button>
        </li>
      )
    case 'open':
      return (
        <li className={daysBetween(today, x.ev.date) <= 3 ? 'bad' : 'warn'}>
          <UserPlus size={18} />
          <div className="grow"><strong>{x.missing === 1 ? 'Falta' : `Faltam ${x.missing}`} · {x.role}</strong><span>{when}</span></div>
          <button className="btn btn-ghost btn-sm" onClick={() => setPicking({ ev: x.ev, role: x.role })}>Escalar</button>
        </li>
      )
    case 'pending':
      return (
        <li>
          <Clock size={18} />
          <div className="grow"><strong>{x.member.name} ainda não confirmou · {x.a.role}</strong><span>{when}</span></div>
          {whatsapp(x.member) && <a className="btn btn-ghost btn-sm" href={whatsapp(x.member)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
        </li>
      )
    case 'material':
      return (
        <li>
          <UploadCloud size={18} />
          <div className="grow"><strong>{x.count} {x.count === 1 ? 'material ainda não enviado' : 'materiais ainda não enviados'}</strong><span>Fotos, vídeos ou filmagens de cultos que já passaram.</span></div>
          <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('pn-material')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Ver</button>
        </li>
      )
    case 'late':
      return (
        <li className="bad">
          <FileWarning size={18} />
          <div className="grow"><strong>Pedido atrasado · {x.task.title}</strong><span>Prazo era {ddmm(x.task.dueDate)} · com <AssigneeName id={x.task.assigneeId} /></span></div>
          <button className="btn btn-ghost btn-sm" onClick={() => go('requests')}>Ver pedidos</button>
        </li>
      )
  }
}

function AssigneeName({ id }: { id: string }) {
  const { data } = useStore()
  return <>{memberById(data, id)?.name ?? 'pessoa removida'}</>
}

/** Coordenação: preenchimento de todos os ministérios (clique para abrir) */
function MinistriesCard({ managed, current, pick }: { managed: Ministry[]; current: Ministry; pick: (id: string) => void }) {
  const { data } = useStore()
  const today = todayISO()
  const until = toISO(addDays(new Date(), 30))
  const rows = managed.map((m) => {
    let total = 0, confirmed = 0, pending = 0
    for (const ev of data.events) if (ev.date >= today && ev.date <= until && ev.ministryIds.includes(m.id)) {
      const f = fillOf(data, ev, [m.id])
      total += f.total; confirmed += f.confirmed; pending += f.pending
    }
    return { m, total, confirmed, pending }
  }).filter((r) => r.total > 0)
  return (
    <section className="pn-card">
      <div className="pn-card-head"><h2>Ministérios</h2><CalendarClock size={18} className="muted" /></div>
      <p className="muted small pn-card-sub">Vagas preenchidas nos próximos 30 dias. Clique para abrir.</p>
      <ul className="pn-mins">
        {rows.map(({ m, total, confirmed, pending }) => (
          <li key={m.id}>
            <button className={m.id === current.id ? 'on' : ''} onClick={() => pick(m.id)}>
              <MinistryBadge ministry={m} size={24} />
              <span className="grow">{m.name}</span>
              <Fill total={total} confirmed={confirmed} pending={pending} color={m.color} />
              <b>{Math.round(((confirmed + pending) / total) * 100)}%</b>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Material (fotos, vídeo, filmagens) dos cultos das últimas 2 semanas: o link abre direto */
function MaterialCard({ ministry }: { ministry: Ministry }) {
  const { data } = useStore()
  if (!ministry.roles.some((r) => r.delivery)) return null
  const today = todayISO()
  const from = plusDays(today, -14)
  const rows = data.events
    .filter((e) => e.date >= from && e.date < today && e.ministryIds.includes(ministry.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    .map((e) => ({ e, list: data.assignments.filter((a) => a.eventId === e.id && a.ministryId === ministry.id && !a.draft && a.status !== 'declined' && deliveryLabel(data, a)) }))
    .filter((r) => r.list.length)
    .slice(0, 6)
  if (!rows.length) return null
  const missing = rows.reduce((n, r) => n + r.list.filter((a) => !a.delivery).length, 0)
  return (
    <section className="pn-card" id="pn-material">
      <div className="pn-card-head"><h2>Material dos últimos cultos</h2><UploadCloud size={18} className="muted" /></div>
      <p className="muted small pn-card-sub">{missing ? `${missing} ${missing === 1 ? 'envio pendente' : 'envios pendentes'}.` : 'Tudo enviado 🙌'} Clique no que já chegou para abrir.</p>
      <ul className="pn-material">
        {rows.map(({ e, list }) => (
          <li key={e.id}>
            <span className="small"><strong>{e.title}</strong> · {ddmm(e.date)}</span>
            <span className="material-chips">
              {list.map((a) => a.delivery ? (
                <a key={a.id} className="material-chip ok" href={a.delivery.link} target="_blank" rel="noreferrer" title={a.delivery.link}>
                  <CheckCircle2 size={13} /> {a.role} · {firstName(memberById(data, a.memberId)?.name ?? '')} <ExternalLink size={11} />
                </a>
              ) : (
                <span key={a.id} className="material-chip"><AlertCircle size={13} /> {a.role} · {firstName(memberById(data, a.memberId)?.name ?? '')}</span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
