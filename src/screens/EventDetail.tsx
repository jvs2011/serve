import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ExternalLink, Music2, Pencil, Plus, Send, Sparkles, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { longDate, relativeDay, timeRange } from '../lib/dates'
import { firstName, join, memberById } from '../lib/selectors'
import { canEditSetlist, canManage, isPast, openSlots, rankCandidates, rankGroups, slotsFor } from '../lib/schedule'
import { AssignmentActions } from '../components/AssignmentActions'
import { DraftBar } from '../components/DraftBar'
import { EventEditForm } from './MinistryEvents'
import { Avatar, Empty, MinistryBadge, Sheet, StatusPill, TopBar } from '../components/ui'
import type { Assignment, ChurchEvent, Ministry, Song } from '../data/types'
import { FillBar, fillOf } from './Agenda'

export function EventDetail({ id }: { id: string }) {
  const { data } = useStore()
  const me = useMe()
  const { back } = useNav()
  const ev = data.events.find((e) => e.id === id)
  const [tab, setTab] = useState<'team' | 'setlist'>('team')
  const { actions, notify } = useStore()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  if (!ev) return <div className="screen"><TopBar title="Evento" onBack={back} /><Empty icon={<X />} title="Evento não encontrado" /></div>

  const canRemove = me.access === 'admin' || (!!ev.slots && ev.ministryIds.every((id) => canManage(me, id, data)))
  const mine = join(data, data.assignments.filter((a) => a.eventId === ev.id && a.memberId === me.id && a.status !== 'declined' && !a.draft))
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
          <div className="hero-actions">
            <button className="icon-btn hero-icon" aria-label="Editar evento" onClick={() => setEditOpen(true)}><Pencil size={18} /></button>
            <button className="icon-btn hero-icon" aria-label="Cancelar evento" onClick={() => setConfirmRemove(true)}><Trash2 size={18} /></button>
          </div>
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

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Editar evento">
        {editOpen && <EventEditForm ev={ev} onDone={() => setEditOpen(false)} />}
      </Sheet>

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
  const [groupPicker, setGroupPicker] = useState<string | null>(null)
  const list = data.assignments.filter((a) => a.eventId === ev.id && a.ministryId === ministry.id)

  const auto = () => {
    const before = openSlots(data, ev.id, ministry.id).reduce((s, x) => s + x.missing, 0)
    if (!before) return notify('Todas as vagas já estão preenchidas 🙌')
    const n = actions.autoSchedule([ev.id], ministry.id)
    const left = before - n
    notify(
      n === 0 ? 'Ninguém disponível para as vagas abertas (indisponíveis, já escalados ou no limite do mês).'
      : left ? `${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} em rascunho. ${left} sem ninguém disponível.`
      : `${n} ${n === 1 ? 'vaga preenchida' : 'vagas preenchidas'} em rascunho ✨ Confira e publique.`,
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
      {manage && <DraftBar ministry={ministry} eventId={ev.id} />}
      {[
        ...slotsFor(data, ev, ministry.id),
        // funções sem vaga neste evento, mas com alguém escalado (ex.: escala antiga)
        ...[...new Set(list.map((a) => a.role))].filter((role) => !slotsFor(data, ev, ministry.id).some((s) => s.name === role)).map((name) => ({ name, count: 0, group: false, hint: undefined })),
      ].map((r) => {
        const roleList = list.filter((a) => a.role === r.name)
        const people = roleList.filter((a) => a.status !== 'declined' && !(r.group && a.groupId))
        const declined = roleList.filter((a) => a.status === 'declined' && !(r.group && a.groupId))
        // vaga de grupo: cada grupo aparece junto, com as pessoas dele
        const groupIds = r.group ? [...new Set(roleList.filter((a) => a.groupId).map((a) => a.groupId!))] : []
        const activeGroups = groupIds.filter((g) => roleList.some((a) => a.groupId === g && a.status !== 'declined'))
        const missing = Math.max(0, r.count - people.length - activeGroups.length)
        const row = (a: Assignment) => {
          const m = memberById(data, a.memberId)
          const swap = data.swaps.find((s) => s.assignmentId === a.id && s.status === 'open')
          return (
            <div key={a.id} className={`person${a.memberId === me.id ? ' me' : ''}${a.status === 'declined' ? ' declined' : ''}`}>
              <Avatar name={m?.name ?? '?'} size={28} />
              <span className="grow">{m ? (a.memberId === me.id ? 'Você' : m.name) : '—'}{swap && <em className="swap-tag">troca</em>}</span>
              <StatusPill status={a.status} checkedIn={a.checkedIn} draft={a.draft} />
              {manage && (
                <button className="icon-btn sm" aria-label="Remover" onClick={() => actions.unassign(a.id)}><X size={16} /></button>
              )}
            </div>
          )
        }
        return (
          <div key={r.name} className="role">
            <span className="role-name">{r.name}{r.hint && <span className="role-hint">{r.hint}</span>}</span>
            <div className="role-people">
              {groupIds.map((gid) => {
                const g = ministry.groups?.find((x) => x.id === gid)
                return (
                  <div key={gid} className="group-block">
                    <div className="group-head">
                      <Users size={15} />
                      <strong className="grow">{g?.name ?? 'Grupo'}</strong>
                      {manage && (
                        <button className="icon-btn sm" aria-label="Tirar o grupo" onClick={() => {
                          actions.unassignGroup(ev.id, gid)
                          notify(`${g?.name ?? 'Grupo'} saiu da escala`)
                        }}><X size={16} /></button>
                      )}
                    </div>
                    {roleList.filter((a) => a.groupId === gid).map(row)}
                  </div>
                )
              })}
              {people.map(row)}
              {declined.map(row)}
              {Array.from({ length: missing }).map((_, i) =>
                manage ? (
                  <button key={i} className="slot-empty" onClick={() => r.group ? setGroupPicker(r.name) : setPicker(r.name)}>
                    {r.group ? <><Users size={16} /> Escolher grupo</> : <><UserPlus size={16} /> Escalar alguém</>}
                  </button>
                ) : (
                  <div key={i} className="slot-empty static">Vaga aberta</div>
                ),
              )}
            </div>
          </div>
        )
      })}

      <Sheet open={!!groupPicker} onClose={() => setGroupPicker(null)} title={`Escalar · ${groupPicker ?? ''}`}>
        {groupPicker && <GroupPicker ev={ev} ministry={ministry} onSingle={() => { setPicker(groupPicker); setGroupPicker(null) }} onPick={async (groupId) => {
          const role = groupPicker
          setGroupPicker(null)
          const r = await actions.assignGroup(ev.id, ministry.id, role, groupId)
          const name = ministry.groups?.find((g) => g.id === groupId)?.name ?? 'Grupo'
          notify(r.ok ? `${name} entrou no rascunho. Publique para avisar o grupo.` : r.error)
        }} />}
      </Sheet>
      <Sheet open={!!picker} onClose={() => setPicker(null)} title={`Escalar · ${picker ?? ''}`}>
        {picker && <CandidatePicker ev={ev} ministry={ministry} role={picker} onPick={(memberId) => {
          actions.assign(ev.id, ministry.id, picker, memberId)
          notify(`${firstName(memberById(data, memberId)?.name ?? '')} entrou no rascunho. Publique para avisar.`)
          setPicker(null)
        }} />}
      </Sheet>
    </div>
  )
}

function GroupPicker({ ev, ministry, onPick, onSingle }: { ev: ChurchEvent; ministry: Ministry; onPick: (groupId: string) => void; onSingle: () => void }) {
  const { data } = useStore()
  const inEvent = new Set(data.assignments.filter((a) => a.eventId === ev.id && a.groupId).map((a) => a.groupId))
  const ranked = rankGroups(data, ev, ministry.id)
  return (
    <div className="candidates">
      {ranked.length === 0 ? (
        <Empty icon={<Users />} title="Nenhum grupo criado" text={`Os líderes criam os grupos na aba Grupos do ${ministry.name}.`} />
      ) : (
        <p className="muted small">Quem estiver indisponível ou já escalado fica de fora. Grupos que serviram menos aparecem primeiro.</p>
      )}
      {ranked.map(({ group, people, status, free, recent, blocked }, i) => {
        const here = inEvent.has(group.id)
        const out = status.filter((s) => s.av.unavailable || s.av.conflict)
        return (
          <button key={group.id} className="candidate" disabled={blocked || here} onClick={() => onPick(group.id)}>
            <span className="group-icon"><Users size={18} /></span>
            <div className="grow">
              <strong>{group.name}{i === 0 && !blocked && !here && <em className="best">sugerido</em>}</strong>
              <span className="muted small">{people.map((p) => firstName(p.name)).join(', ') || 'Sem pessoas'}</span>
              <span className="tags">
                {here && <span className="tag">Já está neste culto</span>}
                {!here && <span className={`tag${blocked ? ' bad' : ''}`}>{free.length}/{people.length} disponíveis</span>}
                {out.map((s) => (
                  <span key={s.member.id} className="tag bad">{firstName(s.member.name)}: {s.av.conflict ? `já em ${data.ministries.find((m) => m.id === s.av.conflict!.ministryId)?.name}` : 'indisponível'}</span>
                ))}
                {recent > 0 && <span className="tag">{recent}× nos últimos 45 dias</span>}
              </span>
            </div>
          </button>
        )
      })}
      <button className="btn btn-ghost btn-block" onClick={onSingle}><UserPlus size={18} /> Escalar uma pessoa avulsa</button>
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
      {canEdit && !reorder && ev.setlist.length > 0 && (
        <div className="setlist-send">
          <button className="btn btn-primary btn-block" onClick={async () => {
            const r = await actions.sendSetlist(ev.id)
            notify(r.ok ? 'Repertório enviado para a equipe do Louvor 🎶' : r.error)
          }}><Send size={16} /> {ev.setlistSentAt ? 'Avisar a equipe de novo' : 'Avisar a equipe'}</button>
          <span className="muted small">{ev.setlistSentAt
            ? `Equipe avisada em ${new Date(ev.setlistSentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Mudou algo? Avise de novo.`
            : 'Quando o repertório estiver pronto, avise quem está escalado no Louvor.'}</span>
        </div>
      )}
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
