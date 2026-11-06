import { useState } from 'react'
import { ChevronRight, Megaphone, Sparkles, Trophy, Users } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, relativeDay, timeAgo, timeRange, toISO, todayISO } from '../lib/dates'
import { memberById, ministryMembers, myMinistries } from '../lib/selectors'
import { canManage, levelFor, pointsFor, sortEvents } from '../lib/schedule'
import { Avatar, Empty, MinistryBadge, Section, Sheet, TopBar } from '../components/ui'
import type { Ministry } from '../data/types'
import { ARTS_MINISTRIES, ArtsTab } from './Arts'
import { SessionCards } from './Sessions'
import { fillOf } from './Agenda'

export function Team() {
  const { data } = useStore()
  const me = useMe()
  const { push } = useNav()
  const mine = myMinistries(data, me)
  const others = data.ministries.filter((m) => !mine.includes(m))

  const card = (m: Ministry) => (
    <button key={m.id} className="card ministry-card" onClick={() => push({ name: 'ministry', id: m.id })}>
      <MinistryBadge ministry={m} size={44} />
      <div className="grow">
        <strong>{m.name}</strong>
        <span className="muted small">{ministryMembers(data, m.id).length} voluntários · líder {m.leaderIds.map((id) => memberById(data, id)?.name.split(' ')[0]).join(', ')}</span>
      </div>
      <ChevronRight size={18} className="muted" />
    </button>
  )

  return (
    <div className="screen">
      <TopBar
        title="Ministérios"
        subtitle="Lagoinha Franca"
        right={me.access === 'admin' && (
          <button className="btn btn-soft btn-sm" onClick={() => push({ name: 'people' })}><Users size={15} /> Pessoas</button>
        )}
      />
      <Section title="Meus ministérios"><div className="list">{mine.map(card)}</div></Section>
      {others.length > 0 && <Section title="Outros ministérios"><div className="list">{others.map(card)}</div></Section>}
    </div>
  )
}

export function MinistryDetail({ id, initialTab }: { id: string; initialTab?: 'schedule' | 'team' | 'notices' | 'arts' }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const { back, push } = useNav()
  const [tab, setTab] = useState<'schedule' | 'team' | 'notices' | 'arts'>(initialTab ?? 'schedule')
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [notice, setNotice] = useState({ title: '', body: '' })
  const ministry = data.ministries.find((m) => m.id === id)
  if (!ministry) return null
  const manage = canManage(me, ministry.id, data)
  const members = ministryMembers(data, ministry.id)
  const events = data.events.filter((e) => e.ministryIds.includes(ministry.id) && e.date >= todayISO()).sort(sortEvents)
  const notices = data.notices.filter((n) => n.ministryId === ministry.id)
  const ranking = members.map((m) => ({ m, pts: pointsFor(data, m.id) })).sort((a, b) => b.pts - a.pts)

  const autoMonth = () => {
    const until = toISO(addDays(new Date(), 30))
    const n = actions.autoSchedule(events.filter((e) => e.date <= until).map((e) => e.id), ministry.id)
    notify(n ? `Escala dos próximos 30 dias gerada: ${n} vagas preenchidas ✨` : 'Todas as vagas dos próximos 30 dias já estão preenchidas.')
  }

  return (
    <div className="screen">
      <div className="ministry-hero" style={{ background: ministry.color }}>
        <TopBar title="" onBack={back} />
        <h1>{ministry.name}</h1>
        <p>{ministry.description}</p>
        <div className="hero-stats">
          <span><b>{members.length}</b> voluntários</span>
          <span><b>{ministry.roles.length}</b> funções</span>
          <span><b>{events.length}</b> eventos</span>
        </div>
      </div>

      <div className="segmented">
        <button className={tab === 'schedule' ? 'on' : ''} onClick={() => setTab('schedule')}>Escalas</button>
        <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>Equipe</button>
        <button className={tab === 'notices' ? 'on' : ''} onClick={() => setTab('notices')}>Avisos</button>
        {ARTS_MINISTRIES.includes(ministry.id) && (
          <button className={tab === 'arts' ? 'on' : ''} onClick={() => setTab('arts')}>Artes</button>
        )}
      </div>

      {tab === 'arts' && <ArtsTab ministry={ministry} />}

      {tab === 'schedule' && (
        <>
          {manage && <SessionCards ministry={ministry} />}
          {manage && (
            <div className="card auto-card">
              <Sparkles size={22} />
              <div className="grow">
                <strong>Escala automática</strong>
                <span className="small">Preenche as vagas dos próximos 30 dias respeitando disponibilidade, outras escalas e rodízio.</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={autoMonth}>Gerar</button>
            </div>
          )}
          <div className="list">
            {events.slice(0, 12).map((ev) => {
              const { total, filled } = fillOf(data, ev, [ministry.id])
              return (
                <button key={ev.id} className="card event-card" onClick={() => push({ name: 'event', id: ev.id })}>
                  <div className="event-card-top">
                    <div>
                      <strong>{ev.title}</strong>
                      <span className="muted">{relativeDay(ev.date)} · {timeRange(ev)}{ev.place && ` · ${ev.place}`}</span>
                    </div>
                    <span className={`pill ${filled === total ? 'pill-confirmed' : 'pill-pending'}`}>{filled}/{total}</span>
                  </div>
                  <div className="progress"><div style={{ width: `${total ? (filled / total) * 100 : 0}%`, background: ministry.color }} /></div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {tab === 'team' && (
        <>
          <Section title="Ranking de dedicação" action={<Trophy size={18} className="accent" />}>
            <div className="card">
              {ranking.slice(0, 3).map(({ m, pts }, i) => (
                <div key={m.id} className="rank-row">
                  <span className={`rank-pos p${i + 1}`}>{i + 1}</span>
                  <Avatar name={m.name} size={32} />
                  <span className="grow">{m.id === me.id ? 'Você' : m.name}</span>
                  <span className="small muted">{levelFor(pts).name}</span>
                  <b>{pts} pts</b>
                </div>
              ))}
            </div>
          </Section>
          <Section title={`Equipe (${members.length})`}>
            <div className="card">
              {members.map((m) => {
                const roles = m.ministries.find((x) => x.ministryId === ministry.id)?.roles ?? []
                return (
                  <div key={m.id} className="member-row">
                    <Avatar name={m.name} size={36} />
                    <div className="grow">
                      <strong>{m.name}{ministry.leaderIds.includes(m.id) && <em className="best">líder</em>}</strong>
                      <span className="muted small">{roles.join(' · ')}</span>
                      {manage && (m.interests?.find((i) => i.ministryId === ministry.id)?.roles.length ?? 0) > 0 && (
                        <span className="small interest-line">Interesse: {m.interests!.find((i) => i.ministryId === ministry.id)!.roles.join(', ')}</span>
                      )}
                    </div>
                    {manage && m.phone && <a className="link small" href={`https://wa.me/55${m.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                  </div>
                )
              })}
            </div>
          </Section>
        </>
      )}

      {tab === 'notices' && (
        <>
          {manage && <button className="btn btn-primary btn-block" onClick={() => setNoticeOpen(true)}><Megaphone size={18} /> Novo aviso</button>}
          {notices.length === 0 ? (
            <Empty icon={<Megaphone />} title="Sem avisos por aqui" />
          ) : (
            <div className="list">
              {notices.map((n) => (
                <div key={n.id} className="card notice">
                  <span className="muted small">{memberById(data, n.authorId)?.name} · {timeAgo(n.createdAt)}</span>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={noticeOpen} onClose={() => setNoticeOpen(false)} title={`Aviso para ${ministry.name}`}>
        <label className="field"><span>Título</span><input value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} /></label>
        <label className="field"><span>Mensagem</span><textarea rows={4} value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} /></label>
        <button className="btn btn-primary btn-block" disabled={!notice.title.trim()} onClick={() => {
          actions.addNotice(ministry.id, notice.title.trim(), notice.body.trim())
          setNotice({ title: '', body: '' })
          setNoticeOpen(false)
          notify('Aviso publicado para a equipe 📣')
        }}>Publicar</button>
      </Sheet>
    </div>
  )
}
