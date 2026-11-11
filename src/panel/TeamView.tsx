import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, MessageCircle, Search, X } from 'lucide-react'
import { useStore } from '../data/store'
import { daysBetween, relativeDay, todayISO } from '../lib/dates'
import { formatPhone } from '../lib/people'
import { teamRows, type TeamRow } from '../lib/panel'
import { downloadText, teamCsv } from '../lib/export'
import { Avatar } from '../components/ui'
import { ddmm, whatsapp } from './common'
import type { Ministry } from '../data/types'

type SortKey = 'name' | 'month' | 'next' | 'last' | 'confirm'
const WEEKDAYS_PL = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados']

/** Equipe do ministério: quem serve em quê, quanto está servindo e quem está parado */
export function TeamView({ ministry }: { ministry: Ministry }) {
  const { data } = useStore()
  const today = todayISO()
  const all = useMemo(() => teamRows(data, ministry.id, today), [data, ministry.id, today])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [idle, setIdle] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [open, setOpen] = useState<TeamRow | null>(null)

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const rows = all
    .filter((r) => !q.trim() || norm(r.member.name).includes(norm(q.trim())))
    .filter((r) => !role || r.roles.includes(role))
    .filter((r) => !idle || !r.next)
    .sort((a, b) => {
      const v = (r: TeamRow): string | number => sort.key === 'name' ? r.member.name
        : sort.key === 'month' ? r.month
        : sort.key === 'next' ? r.next?.ev.date ?? '9999'
        : sort.key === 'last' ? r.last ?? '0000'
        : r.confirmRate ?? -1
      const x = v(a), y = v(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir || a.member.name.localeCompare(b.member.name)
    })
  const head = (key: SortKey, label: string) => (
    <th>
      <button className={`pn-sort${sort.key === key ? ' on' : ''}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}{sort.key === key && (sort.dir === 1 ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
      </button>
    </th>
  )
  const withoutNext = all.filter((r) => !r.next).length

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Equipe</h1>
          <p>{ministry.name} · {all.length} {all.length === 1 ? 'pessoa' : 'pessoas'}{withoutNext ? ` · ${withoutNext} sem escala marcada` : ''}</p>
        </div>
        <div className="pn-head-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => downloadText(`equipe-${ministry.id}-${today}.csv`, teamCsv(rows, today))}><Download size={15} /> Baixar planilha</button>
        </div>
      </header>

      <div className="pn-toolbar">
        <label className="pn-search">
          <Search size={16} />
          <input placeholder="Buscar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="pn-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Todas as funções</option>
          {ministry.roles.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <label className="pn-check"><input type="checkbox" checked={idle} onChange={(e) => setIdle(e.target.checked)} /> Só quem está sem escala</label>
      </div>

      <div className="pn-card pn-card-flush">
        <table className="pn-table pn-team">
          <thead>
            <tr>
              {head('name', 'Pessoa')}
              <th>Funções</th>
              {head('month', 'Neste mês')}
              {head('next', 'Próxima escala')}
              {head('last', 'Última vez')}
              {head('confirm', 'Confirma')}
              <th>Indisponível</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member.id} className="pn-click" onClick={() => setOpen(r)}>
                <td>
                  <div className="pn-person">
                    <Avatar name={r.member.name} size={32} />
                    <div><strong>{r.member.name}</strong>{ministry.leaderIds.includes(r.member.id) && <span className="tag pn-tag-leader">líder</span>}<span className="muted small block">{r.member.phone ? formatPhone(r.member.phone) : 'sem celular'}</span></div>
                  </div>
                </td>
                <td><span className="tags">{r.roles.map((x) => <span key={x} className="tag">{x}</span>)}</span></td>
                <td>
                  <div className="pn-month"><b className={r.month >= r.member.maxPerMonth ? 'warn' : ''}>{r.month}</b><span className="muted">/{r.member.maxPerMonth}</span></div>
                </td>
                <td>{r.next ? <><strong className="small">{relativeDay(r.next.ev.date)}</strong><span className="muted small block">{r.next.ev.title} · {r.next.a.role}{r.next.a.status === 'pending' ? ' · aguardando' : ''}</span></> : <span className="muted small">Sem escala</span>}</td>
                <td>{r.last ? <span className={`small${daysBetween(r.last, today) > 21 ? ' warn' : ''}`}>há {daysBetween(r.last, today)} dias</span> : <span className="muted small">Ainda não serviu</span>}</td>
                <td>{r.confirmRate === null ? <span className="muted small">—</span> : <span className={`small ${r.confirmRate < 70 ? 'bad' : ''}`}>{r.confirmRate}%</span>}</td>
                <td>{r.off || r.recurringOff ? <span className="small">{[r.off && `${r.off} ${r.off === 1 ? 'dia' : 'dias'}`, r.recurringOff && `${r.recurringOff} fixo${r.recurringOff > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</span> : <span className="muted small">—</span>}</td>
                <td className="right" onClick={(e) => e.stopPropagation()}>
                  {whatsapp(r.member) && <a className="icon-btn sm" href={whatsapp(r.member)} target="_blank" rel="noreferrer" title="Chamar no WhatsApp"><MessageCircle size={17} /></a>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="pn-empty">Ninguém encontrado com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <PersonDrawer row={all.find((r) => r.member.id === open.member.id) ?? open} ministry={ministry} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Detalhes de uma pessoa: escalas (todos os ministérios), histórico e indisponibilidade */
function PersonDrawer({ row, ministry, onClose }: { row: TeamRow; ministry: Ministry; onClose: () => void }) {
  const { data } = useStore()
  const today = todayISO()
  const m = row.member
  const evs = new Map(data.events.map((e) => [e.id, e]))
  const mine = data.assignments.filter((a) => a.memberId === m.id && evs.has(a.eventId))
  const upcoming = mine.filter((a) => evs.get(a.eventId)!.date >= today && a.status !== 'declined').sort((a, b) => evs.get(a.eventId)!.date.localeCompare(evs.get(b.eventId)!.date)).slice(0, 8)
  const past = mine.filter((a) => evs.get(a.eventId)!.date < today).sort((a, b) => evs.get(b.eventId)!.date.localeCompare(evs.get(a.eventId)!.date)).slice(0, 6)
  const offDates = (data.unavailability[m.id] ?? []).filter((d) => d >= today).sort().slice(0, 12)
  const fixed = (m.recurringOff ?? []).map((k) => { const [d, t] = k.split('-'); return `${WEEKDAYS_PL[Number(d)]} ${t}` })
  const minName = (id: string) => data.ministries.find((x) => x.id === id)?.name ?? id
  const others = m.ministries.filter((mm) => mm.ministryId !== ministry.id)

  return (
    <div className="pn-drawer-backdrop" onMouseDown={onClose}>
      <aside className="pn-drawer" onMouseDown={(e) => e.stopPropagation()} aria-label={m.name}>
        <div className="pn-drawer-head">
          <Avatar name={m.name} size={48} />
          <div className="grow">
            <h2>{m.name}</h2>
            <p className="muted small">{m.phone ? formatPhone(m.phone) : 'sem celular'} · {m.access === 'admin' ? 'Coordenação' : ministry.leaderIds.includes(m.id) ? 'Líder' : 'Voluntário'}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        {whatsapp(m) && <a className="btn btn-ghost btn-sm pn-drawer-wa" href={whatsapp(m)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Chamar no WhatsApp</a>}

        <div className="pn-drawer-stats">
          <div><b>{row.month}/{m.maxPerMonth}</b><span>escalas no mês</span></div>
          <div><b>{row.confirmRate === null ? '—' : `${row.confirmRate}%`}</b><span>confirma</span></div>
          <div><b>{row.last ? `${daysBetween(row.last, today)}d` : '—'}</b><span>desde a última vez</span></div>
        </div>

        <h3>Funções no {ministry.name}</h3>
        <p className="tags">{row.roles.length ? row.roles.map((x) => <span key={x} className="tag">{x}</span>) : <span className="muted small">Nenhuma função marcada</span>}</p>
        {others.length > 0 && <p className="muted small">Também serve em: {others.map((o) => `${minName(o.ministryId)}${o.roles.length ? ` (${o.roles.join(', ')})` : ''}`).join(' · ')}</p>}

        <h3>Próximas escalas</h3>
        {upcoming.length === 0 ? <p className="muted small">Nenhuma escala marcada.</p> : (
          <ul className="pn-drawer-list">
            {upcoming.map((a) => {
              const ev = evs.get(a.eventId)!
              return (
                <li key={a.id}>
                  <span className="grow"><strong>{relativeDay(ev.date)}</strong> · {ev.title}<span className="muted small block">{minName(a.ministryId)} · {a.role}</span></span>
                  <span className={`pill ${a.draft ? 'pill-draft' : a.status === 'confirmed' ? 'pill-confirmed' : 'pill-pending'}`}>{a.draft ? 'Rascunho' : a.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}</span>
                </li>
              )
            })}
          </ul>
        )}

        <h3>Últimas escalas</h3>
        {past.length === 0 ? <p className="muted small">Ainda não serviu.</p> : (
          <ul className="pn-drawer-list">
            {past.map((a) => {
              const ev = evs.get(a.eventId)!
              return (
                <li key={a.id}>
                  <span className="grow">{ddmm(ev.date)} · {ev.title}<span className="muted small block">{minName(a.ministryId)} · {a.role}</span></span>
                  <span className={`pill ${a.status === 'declined' ? 'pill-declined' : a.checkedIn ? 'pill-checkin' : 'pill-confirmed'}`}>{a.status === 'declined' ? 'Recusou' : a.checkedIn ? 'Check-in' : 'Serviu'}</span>
                </li>
              )
            })}
          </ul>
        )}

        <h3>Indisponibilidade</h3>
        {offDates.length === 0 && fixed.length === 0 ? <p className="muted small">Nenhuma data marcada.</p> : (
          <p className="tags">
            {fixed.map((f) => <span key={f} className="tag warn">{f}</span>)}
            {offDates.map((d) => <span key={d} className="tag">{ddmm(d)}</span>)}
          </p>
        )}
      </aside>
    </div>
  )
}
