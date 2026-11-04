import { useState } from 'react'
import { AlertTriangle, ExternalLink, Music2, Plus, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { longDate, relativeDay } from '../lib/dates'
import { firstName, join, memberById } from '../lib/selectors'
import { canManage, isPast, openSlots, rankCandidates } from '../lib/schedule'
import { AssignmentActions } from '../components/AssignmentActions'
import { Avatar, Empty, MinistryBadge, Sheet, StatusPill, TopBar } from '../components/ui'
import type { ChurchEvent, Ministry } from '../data/types'
import { fillOf } from './Agenda'

export function EventDetail({ id }: { id: string }) {
  const { data } = useStore()
  const me = useMe()
  const { back } = useNav()
  const ev = data.events.find((e) => e.id === id)
  const [tab, setTab] = useState<'team' | 'setlist'>('team')
  if (!ev) return <div className="screen"><TopBar title="Evento" onBack={back} /><Empty icon={<X />} title="Evento não encontrado" /></div>

  const mine = join(data, data.assignments.filter((a) => a.eventId === ev.id && a.memberId === me.id && a.status !== 'declined'))
  const hasLouvor = ev.ministryIds.includes('louvor')
  const { total, filled } = fillOf(data, ev)
  // ministérios que eu gerencio aparecem primeiro
  const ministries = ev.ministryIds
    .map((mid) => data.ministries.find((m) => m.id === mid))
    .filter((m): m is Ministry => !!m)
    .sort((a, b) => Number(canManage(me, b.id, data)) - Number(canManage(me, a.id, data)))

  return (
    <div className="screen">
      <div className="event-hero">
        <TopBar title="" onBack={back} />
        <span className="kicker light">{relativeDay(ev.date)} · {ev.time}</span>
        <h1>{ev.title}</h1>
        <p>{longDate(ev.date)} · Lagoinha Franca</p>
        <div className="progress-row light">
          <div className="progress"><div style={{ width: `${total ? (filled / total) * 100 : 0}%` }} /></div>
          <span className="small">{filled}/{total} vagas preenchidas</span>
        </div>
      </div>

      {mine.map((x) => (
        <div key={x.a.id} className="card my-assignment">
          <div className="assign-row">
            <MinistryBadge ministry={x.ministry} />
            <div className="grow">
              <span className="kicker">Sua escala</span>
              <strong>{x.ministry.name} · {x.a.role}</strong>
            </div>
            <StatusPill status={x.a.status} checkedIn={x.a.checkedIn} />
          </div>
          <AssignmentActions item={x} />
        </div>
      ))}

      {hasLouvor && (
        <div className="segmented">
          <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>Equipe</button>
          <button className={tab === 'setlist' ? 'on' : ''} onClick={() => setTab('setlist')}>Repertório ({ev.setlist.length})</button>
        </div>
      )}

      {tab === 'team' || !hasLouvor ? (
        ministries.map((m) => <MinistryTeam key={m.id} ev={ev} ministry={m} />)
      ) : (
        <Setlist ev={ev} />
      )}
    </div>
  )
}

function MinistryTeam({ ev, ministry }: { ev: ChurchEvent; ministry: Ministry }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const manage = canManage(me, ministry.id, data) && !isPast(ev)
  const [picker, setPicker] = useState<string | null>(null)
  const list = data.assignments.filter((a) => a.eventId === ev.id && a.ministryId === ministry.id)

  const auto = () => {
    const before = openSlots(data, ev.id, ministry.id).reduce((s, x) => s + x.missing, 0)
    if (!before) return notify('Todas as vagas já estão preenchidas 🙌')
    const n = actions.autoSchedule([ev.id], ministry.id)
    const left = before - n
    notify(
      n === 0 ? 'Ninguém disponível para as vagas abertas (indisponíveis, já escalados ou no limite do mês).'
      : left ? `${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} ✨ ${left} sem ninguém disponível.`
      : `Escala completa: ${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} ✨`,
    )
  }

  return (
    <div className="card team">
      <div className="team-head">
        <MinistryBadge ministry={ministry} size={32} />
        <strong className="grow">{ministry.name}</strong>
        {manage && (
          <button className="btn btn-soft btn-sm" onClick={auto}><Sparkles size={15} /> Automática</button>
        )}
      </div>
      {ministry.roles.map((r) => {
        const people = list.filter((a) => a.role === r.name && a.status !== 'declined')
        const declined = list.filter((a) => a.role === r.name && a.status === 'declined')
        const missing = Math.max(0, r.count - people.length)
        return (
          <div key={r.name} className="role">
            <span className="role-name">{r.name}</span>
            <div className="role-people">
              {people.map((a) => {
                const m = memberById(data, a.memberId)
                const swap = data.swaps.find((s) => s.assignmentId === a.id && s.status === 'open')
                return (
                  <div key={a.id} className={`person${a.memberId === me.id ? ' me' : ''}`}>
                    <Avatar name={m?.name ?? '?'} size={28} />
                    <span className="grow">{m ? (a.memberId === me.id ? 'Você' : m.name) : '—'}{swap && <em className="swap-tag">troca</em>}</span>
                    <StatusPill status={a.status} checkedIn={a.checkedIn} />
                    {manage && (
                      <button className="icon-btn sm" aria-label="Remover" onClick={() => actions.unassign(a.id)}><X size={16} /></button>
                    )}
                  </div>
                )
              })}
              {declined.map((a) => (
                <div key={a.id} className="person declined">
                  <Avatar name={memberById(data, a.memberId)?.name ?? '?'} size={28} />
                  <span className="grow">{memberById(data, a.memberId)?.name}</span>
                  <StatusPill status="declined" />
                  {manage && <button className="icon-btn sm" aria-label="Remover" onClick={() => actions.unassign(a.id)}><X size={16} /></button>}
                </div>
              ))}
              {Array.from({ length: missing }).map((_, i) =>
                manage ? (
                  <button key={i} className="slot-empty" onClick={() => setPicker(r.name)}><UserPlus size={16} /> Escalar alguém</button>
                ) : (
                  <div key={i} className="slot-empty static">Vaga aberta</div>
                ),
              )}
            </div>
          </div>
        )
      })}

      <Sheet open={!!picker} onClose={() => setPicker(null)} title={`Escalar · ${picker ?? ''}`}>
        {picker && <CandidatePicker ev={ev} ministry={ministry} role={picker} onPick={(memberId) => {
          actions.assign(ev.id, ministry.id, picker, memberId)
          notify(`${firstName(memberById(data, memberId)?.name ?? '')} foi escalado(a). Aguardando confirmação.`)
          setPicker(null)
        }} />}
      </Sheet>
    </div>
  )
}

function CandidatePicker({ ev, ministry, role, onPick }: { ev: ChurchEvent; ministry: Ministry; role: string; onPick: (id: string) => void }) {
  const { data } = useStore()
  const ranked = rankCandidates(data, ev, ministry.id, role)
  if (!ranked.length) return <Empty icon={<UserPlus />} title="Ninguém com essa função" text="Cadastre voluntários com essa função no ministério." />
  return (
    <div className="candidates">
      <p className="muted small">Ordenados por disponibilidade e rodízio — quem serviu menos aparece primeiro.</p>
      {ranked.map(({ member, av, blocked }, i) => {
        const otherMinistry = av.conflict && data.ministries.find((m) => m.id === av.conflict!.ministryId)
        return (
          <button key={member.id} className="candidate" disabled={blocked} onClick={() => onPick(member.id)}>
            <Avatar name={member.name} size={36} />
            <div className="grow">
              <strong>{member.name}{i === 0 && !blocked && <em className="best">sugerido</em>}</strong>
              <span className="tags">
                {av.unavailable && <span className="tag bad">Indisponível</span>}
                {av.conflict && <span className="tag bad"><AlertTriangle size={11} /> Já escalado em {otherMinistry?.name} ({av.conflict.role})</span>}
                {av.sameDay && <span className="tag warn">Serve em outro culto no dia</span>}
                <span className={`tag${av.overLimit ? ' warn' : ''}`}>{av.monthCount}/{member.maxPerMonth} no mês</span>
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Setlist({ ev }: { ev: ChurchEvent }) {
  const { data, actions } = useStore()
  const me = useMe()
  const manage = canManage(me, 'louvor', data) && !isPast(ev)
  const [open, setOpen] = useState(false)
  const [song, setSong] = useState({ title: '', artist: '', key: '' })
  const q = (s: string) => encodeURIComponent(s)

  return (
    <div className="card">
      {ev.setlist.length === 0 && <Empty icon={<Music2 />} title="Repertório ainda não definido" />}
      <ol className="setlist">
        {ev.setlist.map((s, i) => (
          <li key={s.id}>
            <span className="setlist-n">{i + 1}</span>
            <div className="grow">
              <strong>{s.title}</strong>
              <span className="muted small">{s.artist}</span>
            </div>
            <span className="key">{s.key}</span>
            <a className="icon-btn sm" href={s.link || `https://www.cifraclub.com.br/?q=${q(`${s.title} ${s.artist}`)}`} target="_blank" rel="noreferrer" aria-label="Cifra">
              <ExternalLink size={16} />
            </a>
            {manage && <button className="icon-btn sm" onClick={() => actions.removeSong(ev.id, s.id)} aria-label="Remover"><Trash2 size={16} /></button>}
          </li>
        ))}
      </ol>
      {manage && <button className="btn btn-soft btn-block" onClick={() => setOpen(true)}><Plus size={16} /> Adicionar música</button>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Adicionar música">
        <label className="field"><span>Música</span><input value={song.title} onChange={(e) => setSong({ ...song, title: e.target.value })} /></label>
        <div className="field-row">
          <label className="field"><span>Artista</span><input value={song.artist} onChange={(e) => setSong({ ...song, artist: e.target.value })} /></label>
          <label className="field narrow"><span>Tom</span><input value={song.key} onChange={(e) => setSong({ ...song, key: e.target.value })} placeholder="G" /></label>
        </div>
        <button className="btn btn-primary btn-block" disabled={!song.title.trim()} onClick={() => {
          actions.addSong(ev.id, { title: song.title.trim(), artist: song.artist.trim(), key: song.key.trim() || '—' })
          setSong({ title: '', artist: '', key: '' })
          setOpen(false)
        }}>Adicionar</button>
      </Sheet>
    </div>
  )
}
