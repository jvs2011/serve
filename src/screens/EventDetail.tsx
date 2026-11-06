import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ExternalLink, Music2, Pencil, Plus, Sparkles, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { longDate, relativeDay, timeRange } from '../lib/dates'
import { firstName, join, memberById } from '../lib/selectors'
import { canEditSetlist, canManage, isPast, openSlots, rankCandidates, slotsFor } from '../lib/schedule'
import { AssignmentActions } from '../components/AssignmentActions'
import { Avatar, Empty, MinistryBadge, Sheet, StatusPill, TopBar } from '../components/ui'
import type { ChurchEvent, Ministry, Song } from '../data/types'
import { FillBar, fillOf } from './Agenda'

export function EventDetail({ id }: { id: string }) {
  const { data } = useStore()
  const me = useMe()
  const { back } = useNav()
  const ev = data.events.find((e) => e.id === id)
  const [tab, setTab] = useState<'team' | 'setlist'>('team')
  const { actions, notify } = useStore()
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (!ev) return <div className="screen"><TopBar title="Evento" onBack={back} /><Empty icon={<X />} title="Evento não encontrado" /></div>

  const canRemove = me.access === 'admin' || (!!ev.slots && ev.ministryIds.every((id) => canManage(me, id, data)))
  const mine = join(data, data.assignments.filter((a) => a.eventId === ev.id && a.memberId === me.id && a.status !== 'declined'))
  const hasLouvor = ev.ministryIds.includes('louvor')
  const { total } = fillOf(data, ev)
  // ministérios que eu gerencio aparecem primeiro
  const ministries = ev.ministryIds
    .map((mid) => data.ministries.find((m) => m.id === mid))
    .filter((m): m is Ministry => !!m)
    .sort((a, b) => Number(canManage(me, b.id, data)) - Number(canManage(me, a.id, data)))

  return (
    <div className="screen">
      <div className="event-hero">
        <TopBar title="" onBack={back} right={canRemove && (
          <button className="icon-btn hero-icon" aria-label="Cancelar evento" onClick={() => setConfirmRemove(true)}><Trash2 size={18} /></button>
        )} />
        <span className="kicker light">{relativeDay(ev.date)} · {timeRange(ev)}</span>
        <h1>{ev.title}</h1>
        <p>{longDate(ev.date)} · {ev.place ?? 'Lagoinha Franca'}</p>
        {(ev.responsible || ev.activity) && (
          <p className="event-meta">{[ev.activity, ev.responsible && `Responsável: ${ev.responsible}`].filter(Boolean).join(' · ')}</p>
        )}
        {total > 0 && (
          <FillBar data={data} ev={ev} light />
        )}
      </div>

      {confirmRemove && (
        <div className="card confirm-box mb">
          <p>Cancelar <b>{ev.title}</b> ({longDate(ev.date)})? As pessoas escaladas deixam de ver esse evento.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Voltar</button>
            <button className="btn btn-danger" onClick={async () => {
              const r = await actions.removeEvent(ev.id)
              if (!r.ok) return notify(r.error)
              notify('Evento cancelado')
              back()
            }}>Cancelar evento</button>
          </div>
        </div>
      )}

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

      {ministries.length === 0 ? (
        <div className="card"><Empty icon={<Users />} title="Sem escala de voluntários" text="Este encontro não tem equipes escaladas pelo Serve." /></div>
      ) : tab === 'team' || !hasLouvor ? (
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
      {[
        ...slotsFor(data, ev, ministry.id),
        // funções sem vaga neste evento, mas com alguém escalado (ex.: escala antiga)
        ...[...new Set(list.map((a) => a.role))].filter((role) => !slotsFor(data, ev, ministry.id).some((s) => s.name === role)).map((name) => ({ name, count: 0 })),
      ].map((r) => {
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
                {av.unavailable && <span className="tag bad">{av.recurring ? 'Indisponível neste horário fixo' : 'Indisponível'}</span>}
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
  const { data, actions, notify } = useStore()
  const me = useMe()
  const canEdit = canEditSetlist(data, me, ev) && !isPast(ev)
  const [editing, setEditing] = useState<Song | 'new' | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [reorder, setReorder] = useState(false)
  const q = (s: string) => encodeURIComponent(s)

  return (
    <div className="card">
      {ev.setlist.length === 0 && <Empty icon={<Music2 />} title="Repertório ainda não definido" text={canEdit ? 'Toque em “Adicionar música” para montar o repertório deste culto.' : undefined} />}
      <ol className="setlist">
        {ev.setlist.map((s, i) => (
          <li key={s.id}>
            <span className="setlist-n">{i + 1}</span>
            <div className="grow">
              <strong>{s.title}</strong>
              <span className="muted small">{s.artist}</span>
            </div>
            <span className="key">{s.key}</span>
            {reorder ? (
              <>
                <button className="icon-btn sm move-btn" disabled={i === 0} onClick={() => actions.moveSong(ev.id, s.id, -1)} aria-label="Subir"><ArrowUp size={18} /></button>
                <button className="icon-btn sm move-btn" disabled={i === ev.setlist.length - 1} onClick={() => actions.moveSong(ev.id, s.id, 1)} aria-label="Descer"><ArrowDown size={18} /></button>
              </>
            ) : (<>
            <a className="icon-btn sm" href={s.link || `https://www.cifraclub.com.br/?q=${q(`${s.title} ${s.artist}`)}`} target="_blank" rel="noreferrer" aria-label={s.link ? 'Abrir link' : 'Buscar cifra'}>
              <ExternalLink size={16} />
            </a>
            {canEdit && <button className="icon-btn sm" onClick={() => setEditing(s)} aria-label="Editar"><Pencil size={16} /></button>}
            {canEdit && (confirmDel === s.id ? (
              <button className="btn btn-danger btn-sm" onClick={() => { actions.removeSong(ev.id, s.id); setConfirmDel(null); notify('Música removida') }}>Remover</button>
            ) : (
              <button className="icon-btn sm" onClick={() => setConfirmDel(s.id)} aria-label="Remover"><Trash2 size={16} /></button>
            ))}
            </>)}
          </li>
        ))}
      </ol>
      {canEdit && (reorder ? (
        <button className="btn btn-primary btn-block" onClick={() => setReorder(false)}><Check size={16} /> Pronto</button>
      ) : (
        <div className="btn-row">
          <button className="btn btn-soft" onClick={() => setEditing('new')}><Plus size={16} /> Adicionar música</button>
          <button className="btn btn-ghost" disabled={ev.setlist.length < 2} onClick={() => { setReorder(true); setConfirmDel(null) }}><ArrowUpDown size={16} /> Reordenar</button>
        </div>
      ))}
      {!canEdit && !isPast(ev) && <p className="muted small setlist-hint">Quem está escalado no Louvor deste culto pode montar o repertório.</p>}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Adicionar música' : 'Editar música'}>
        {editing && <SongForm key={editing === 'new' ? 'new' : editing.id} song={editing === 'new' ? null : editing} onSave={(song) => {
          if (editing === 'new') { actions.addSong(ev.id, song); notify('Música adicionada') }
          else { actions.editSong(ev.id, editing.id, song); notify('Música atualizada') }
          setEditing(null)
        }} />}
      </Sheet>
    </div>
  )
}

function SongForm({ song, onSave }: { song: Song | null; onSave: (s: Omit<Song, 'id'>) => void }) {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [key, setKey] = useState(song && song.key !== '—' ? song.key : '')
  const [link, setLink] = useState(song?.link ?? '')
  return (
    <>
      <label className="field"><span>Música</span><input id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Bondade de Deus" /></label>
      <div className="field-row">
        <label className="field"><span>Artista</span><input id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
        <label className="field narrow"><span>Tom</span><input id="song-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="G" /></label>
      </div>
      <label className="field"><span>Link da cifra ou do vídeo (opcional)</span><input id="song-link" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Cifra Club, YouTube…" /></label>
      <button className="btn btn-primary btn-block" disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), artist: artist.trim(), key: key.trim() || '—', ...(link.trim() ? { link: link.trim() } : {}) })}>
        {song ? 'Salvar' : 'Adicionar'}
      </button>
    </>
  )
}
