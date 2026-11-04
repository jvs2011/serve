import { useState } from 'react'
import { HeartHandshake, Star } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, daysBetween, toISO, todayISO } from '../lib/dates'
import { managedMinistries, ministryMembers } from '../lib/selectors'
import { openSlots } from '../lib/schedule'
import { Avatar, MinistryBadge, Section, TopBar } from '../components/ui'

export function Dashboard() {
  const { data } = useStore()
  const me = useMe()
  const { back } = useNav()
  const managed = managedMinistries(data, me)
  const [filter, setFilter] = useState<string>('all')
  const scope = filter === 'all' ? managed : managed.filter((m) => m.id === filter)
  const ids = new Set(scope.map((m) => m.id))

  const today = todayISO()
  const until = toISO(addDays(new Date(), 30))
  const upcoming = data.events.filter((e) => e.date >= today && e.date <= until)
  const upIds = new Set(upcoming.map((e) => e.id))
  const upA = data.assignments.filter((a) => ids.has(a.ministryId) && upIds.has(a.eventId))

  let open = 0
  let total = 0
  for (const ev of upcoming) for (const m of scope) if (ev.ministryIds.includes(m.id)) {
    open += openSlots(data, ev.id, m.id).reduce((s, x) => s + x.missing, 0)
    total += m.roles.reduce((s, r) => s + r.count, 0)
  }
  const confirmed = upA.filter((a) => a.status === 'confirmed').length
  const pending = upA.filter((a) => a.status === 'pending').length
  const declined = upA.filter((a) => a.status === 'declined').length
  const swaps = data.swaps.filter((s) => s.status === 'open' && upA.some((a) => a.id === s.assignmentId)).length

  // presença e feedback (últimos 30 dias)
  const from = toISO(addDays(new Date(), -30))
  const pastIds = new Set(data.events.filter((e) => e.date < today && e.date >= from).map((e) => e.id))
  const pastA = data.assignments.filter((a) => ids.has(a.ministryId) && pastIds.has(a.eventId) && a.status === 'confirmed')
  const attendance = pastA.length ? Math.round((pastA.filter((a) => a.checkedIn).length / pastA.length) * 100) : 0
  const ratings = pastA.filter((a) => a.feedback).map((a) => a.feedback!.rating)
  const avgRating = ratings.length ? (ratings.reduce((s, x) => s + x, 0) / ratings.length).toFixed(1) : '—'

  // quem precisa de cuidado: não serve há mais de 30 dias e não tem escala futura
  const people = [...new Map(scope.flatMap((m) => ministryMembers(data, m.id)).map((p) => [p.id, p])).values()]
  const lastServed = (id: string) => {
    const dates = data.assignments
      .filter((a) => a.memberId === id && a.checkedIn)
      .map((a) => data.events.find((e) => e.id === a.eventId)?.date ?? '')
      .sort()
    return dates[dates.length - 1]
  }
  const care = people
    .filter((p) => !data.assignments.some((a) => a.memberId === p.id && a.status !== 'declined' && upIds.has(a.eventId)))
    .map((p) => ({ p, last: lastServed(p.id) }))
    .filter(({ last }) => !last || daysBetween(last, today) > 21)
    .slice(0, 6)

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  return (
    <div className="screen">
      <TopBar title="Painel do líder" subtitle="Próximos 30 dias" onBack={back} />
      {managed.length > 1 && (
        <div className="chips scroll">
          <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>Todos</button>
          {managed.map((m) => <button key={m.id} className={`chip${filter === m.id ? ' on' : ''}`} onClick={() => setFilter(m.id)}>{m.name}</button>)}
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><span>Vagas preenchidas</span><b>{pct(total - open)}%</b><small>{total - open} de {total}</small></div>
        <div className="kpi"><span>Vagas abertas</span><b className={open ? 'warn' : ''}>{open}</b><small>precisam de alguém</small></div>
        <div className="kpi"><span>Confirmados</span><b>{confirmed}</b><small>{pending} aguardando resposta</small></div>
        <div className="kpi"><span>Recusas · trocas</span><b>{declined} · {swaps}</b><small>trocas em aberto</small></div>
        <div className="kpi"><span>Presença (30d)</span><b>{attendance}%</b><small>check-ins realizados</small></div>
        <div className="kpi"><span>Avaliação média</span><b>{avgRating}{ratings.length > 0 && <Star size={16} fill="currentColor" className="accent" />}</b><small>{ratings.length} feedbacks</small></div>
      </div>

      {scope.length > 1 && (
        <Section title="Preenchimento por ministério">
          <div className="card">
            {scope.map((m) => {
              let t = 0
              let o = 0
              for (const ev of upcoming) if (ev.ministryIds.includes(m.id)) {
                t += m.roles.reduce((s, r) => s + r.count, 0)
                o += openSlots(data, ev.id, m.id).reduce((s, x) => s + x.missing, 0)
              }
              const p = t ? Math.round(((t - o) / t) * 100) : 0
              return (
                <div key={m.id} className="bar-row" title={`${m.name}: ${t - o} de ${t} vagas`}>
                  <MinistryBadge ministry={m} size={26} />
                  <span className="bar-label">{m.name}</span>
                  <div className="progress"><div style={{ width: `${p}%`, background: m.color }} /></div>
                  <b className="bar-val">{p}%</b>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title="Quem precisa de cuidado" action={<HeartHandshake size={18} className="accent" />}>
        <div className="card">
          {care.length === 0 ? (
            <p className="muted small">Toda a equipe está ativa. Glória a Deus! 🙌</p>
          ) : (
            care.map(({ p, last }) => (
              <div key={p.id} className="member-row">
                <Avatar name={p.name} size={34} />
                <div className="grow">
                  <strong>{p.name}</strong>
                  <span className="muted small">{last ? `Serviu pela última vez há ${daysBetween(last, today)} dias` : 'Ainda não serviu'} · sem escala futura</span>
                </div>
                <a className="link small" href={`https://wa.me/55${p.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Chamar</a>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  )
}
