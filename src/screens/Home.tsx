import { useState } from 'react'
import { BarChart3, Bell, CalendarCheck, ChevronRight, Clock, Megaphone, RotateCcw, Star } from 'lucide-react'
import { demoExpiresAt, useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { greeting, relativeDay, timeAgo, timeRange, todayISO, addDays, toISO } from '../lib/dates'
import { firstName, join, managedMinistries, memberById, myMinistries, myUpcoming, swapsICanCover } from '../lib/selectors'
import { openSlots } from '../lib/schedule'
import { AssignmentActions } from '../components/AssignmentActions'
import { Avatar, DateBlock, Empty, MinistryBadge, Section, StatusPill } from '../components/ui'
import { Logo } from '../components/Logo'
import { NotificationsPrompt } from '../components/Notifications'
import { ThemeToggle } from '../components/ThemeToggle'

export function Home() {
  const { data, actions, notify, mode } = useStore()
  const me = useMe()
  const { push, setTab } = useNav()
  const upcoming = myUpcoming(data, me.id)
  const exp = mode === 'demo' ? demoExpiresAt(data) : null
  const demoUntil = exp ? new Date(exp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  const next = upcoming[0]
  const otherPending = upcoming.slice(1).filter((x) => x.a.status === 'pending')
  const rest = upcoming.slice(1).filter((x) => x.a.status !== 'pending').slice(0, 4)
  const swaps = swapsICanCover(data, me)
  const managed = managedMinistries(data, me)
  const mineIds = new Set(myMinistries(data, me).map((m) => m.id))
  const notices = data.notices.filter((n) => n.ministryId === null || mineIds.has(n.ministryId)).slice(0, 3)

  // feedback das últimas escalas com check-in
  const weekAgo = toISO(addDays(new Date(), -7))
  const toRate = join(data, data.assignments.filter((a) => a.memberId === me.id && a.checkedIn && !a.feedback))
    .filter((x) => x.ev.date < todayISO() && x.ev.date >= weekAgo)
    .slice(-1)[0]

  // resumo do líder (próximos 14 dias)
  const horizon = toISO(addDays(new Date(), 14))
  const leaderStats = managed.length
    ? (() => {
        const evs = data.events.filter((e) => e.date >= todayISO() && e.date <= horizon)
        let open = 0
        for (const ev of evs) for (const m of managed) if (ev.ministryIds.includes(m.id)) open += openSlots(data, ev.id, m.id).reduce((s, x) => s + x.missing, 0)
        const ids = new Set(managed.map((m) => m.id))
        const evIds = new Set(evs.map((e) => e.id))
        const pending = data.assignments.filter((a) => ids.has(a.ministryId) && evIds.has(a.eventId) && a.status === 'pending').length
        return { open, pending }
      })()
    : null

  return (
    <div className="screen">
      <header className="home-head">
        <Logo size={26} />
        <div className="home-head-actions">
          <ThemeToggle />
          <button className="icon-btn" onClick={() => setTab('profile')} aria-label="Perfil">
            <Avatar name={me.name} size={38} />
          </button>
        </div>
      </header>

      <div className="hello">
        <h1>{greeting()}, {firstName(me.name)} 👋</h1>
        <p>{upcoming.length ? `Você tem ${upcoming.length} ${upcoming.length === 1 ? 'escala' : 'escalas'} pela frente.` : 'Nenhuma escala por enquanto.'}</p>
      </div>

      {demoUntil && (
        <div className="demo-note">
          <RotateCcw size={14} />
          <span>Demonstração: suas alterações serão desfeitas às <b>{demoUntil}</b></span>
        </div>
      )}

      <NotificationsPrompt />

      {next ? (
        <div className="hero-card" onClick={() => push({ name: 'event', id: next.ev.id })}>
          <div className="hero-top">
            <span className="hero-kicker">Próxima escala · {relativeDay(next.ev.date)}</span>
            <StatusPill status={next.a.status} checkedIn={next.a.checkedIn} />
          </div>
          <div className="hero-main">
            <DateBlock iso={next.ev.date} dark />
            <div>
              <h2>{next.ev.title}</h2>
              <p><Clock size={14} /> {timeRange(next.ev)}{next.ev.place && ` · ${next.ev.place}`} · {next.ministry.name} · <b>{next.a.role}</b></p>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <AssignmentActions item={next} />
          </div>
        </div>
      ) : (
        <div className="card">
          <Empty icon={<CalendarCheck />} title="Tudo tranquilo por aqui" text="Quando você for escalado, a escala aparece aqui para confirmar." />
        </div>
      )}

      {toRate && <FeedbackCard key={toRate.a.id} title={toRate.ev.title} onSend={(r, c) => { actions.feedback(toRate.a.id, r, c); notify('Obrigado pelo feedback! +2 pontos') }} />}

      {leaderStats && (
        <button className="leader-card" onClick={() => push({ name: 'dashboard' })}>
          <div className="leader-icon"><BarChart3 size={20} /></div>
          <div className="leader-body">
            <strong>Painel do líder</strong>
            <span>Próximos 14 dias · {managed.length === data.ministries.length ? 'todos os ministérios' : managed.map((m) => m.name).join(', ')}</span>
          </div>
          <div className="leader-stats">
            <span><b className={leaderStats.open ? 'warn' : ''}>{leaderStats.open}</b> vagas</span>
            <span><b>{leaderStats.pending}</b> pend.</span>
          </div>
        </button>
      )}

      {otherPending.length > 0 && (
        <Section title="Aguardando sua resposta">
          <div className="list">
            {otherPending.map((x) => (
              <div key={x.a.id} className="card assign-card">
                <div className="assign-row" onClick={() => push({ name: 'event', id: x.ev.id })}>
                  <DateBlock iso={x.ev.date} />
                  <div className="grow">
                    <strong>{x.ev.title}</strong>
                    <span className="muted">{timeRange(x.ev)} · {x.ministry.name} · {x.a.role}</span>
                  </div>
                </div>
                <AssignmentActions item={x} compact />
              </div>
            ))}
          </div>
        </Section>
      )}

      {swaps.length > 0 && (
        <button className="swap-banner" onClick={() => setTab('swaps')}>
          <Bell size={18} />
          <span><b>{swaps.length} {swaps.length === 1 ? 'pedido' : 'pedidos'} de troca</b> que você pode assumir</span>
          <ChevronRight size={18} />
        </button>
      )}

      {notices.length > 0 && (
        <Section title="Avisos">
          <div className="list">
            {notices.map((n) => {
              const ministry = data.ministries.find((m) => m.id === n.ministryId)
              return (
                <div key={n.id} className="card notice">
                  <div className="notice-head">
                    {ministry ? <MinistryBadge ministry={ministry} size={28} /> : <span className="min-badge general"><Megaphone size={14} /></span>}
                    <span className="muted small">{ministry?.name ?? 'Lagoinha Franca'} · {memberById(data, n.authorId)?.name.split(' ')[0]} · {timeAgo(n.createdAt)}</span>
                  </div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {rest.length > 0 && (
        <Section title="Próximas escalas" action={<button className="link" onClick={() => setTab('agenda')}>Ver todas</button>}>
          <div className="list">
            {rest.map((x) => (
              <button key={x.a.id} className="card assign-row" onClick={() => push({ name: 'event', id: x.ev.id })}>
                <DateBlock iso={x.ev.date} />
                <div className="grow">
                  <strong>{x.ev.title}</strong>
                  <span className="muted">{timeRange(x.ev)} · {x.ministry.name} · {x.a.role}</span>
                </div>
                <StatusPill status={x.a.status} />
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function FeedbackCard({ title, onSend }: { title: string; onSend: (rating: number, comment: string) => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  return (
    <div className="card feedback">
      <strong>Como foi servir no {title}?</strong>
      <p className="muted small">Seu feedback ajuda a liderança a cuidar melhor da equipe.</p>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`} className={n <= rating ? 'on' : ''}>
            <Star size={28} fill={n <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea rows={2} placeholder="Quer deixar algum comentário? (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-primary btn-block" onClick={() => onSend(rating, comment)}>Enviar</button>
        </>
      )}
    </div>
  )
}
