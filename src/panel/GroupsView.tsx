import { useState } from 'react'
import { Pencil, Plus, Users } from 'lucide-react'
import { useStore } from '../data/store'
import { groupPeople } from '../data/actions'
import { daysBetween, relativeDay, todayISO } from '../lib/dates'
import { GroupForm } from '../screens/Groups'
import { Avatar } from '../components/ui'
import { Modal } from './common'
import type { MemberGroup, Ministry } from '../data/types'

/** Grupos que entram juntos na escala (ex.: grupos de voz do Louvor) */
export function GroupsView({ ministry }: { ministry: Ministry }) {
  const { data } = useStore()
  const today = todayISO()
  const [editing, setEditing] = useState<MemberGroup | 'new' | null>(null)
  const groups = ministry.groups ?? []
  const people = groupPeople(data, ministry.id)
  const loose = people.filter((p) => !groups.some((g) => g.memberIds.includes(p.id)))
  const roleNames = ministry.roles.filter((r) => r.group).map((r) => r.name).join(', ')
  const evs = new Map(data.events.map((e) => [e.id, e]))
  const usage = (g: MemberGroup) => {
    const ids = [...new Set(data.assignments.filter((a) => a.groupId === g.id && a.status !== 'declined').map((a) => a.eventId))]
    const dates = ids.map((id) => evs.get(id)?.date).filter((d): d is string => !!d).sort()
    return {
      next: dates.find((d) => d >= today),
      recent: dates.filter((d) => d < today && daysBetween(d, today) <= 45).length,
    }
  }

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Grupos</h1>
          <p>Cada grupo entra junto na escala, na vaga de {roleNames}. Na escala automática os grupos fazem rodízio; quem estiver indisponível no dia fica de fora.</p>
        </div>
        <div className="pn-head-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={16} /> Novo grupo</button>
        </div>
      </header>
      <div className="pn-groups">
        {groups.map((g) => {
          const u = usage(g)
          return (
            <section key={g.id} className="pn-card pn-group">
              <div className="pn-card-head">
                <div className="pn-person"><span className="pn-group-icon"><Users size={17} /></span><div><h2>{g.name}</h2><span className="muted small">{g.memberIds.length} {g.memberIds.length === 1 ? 'pessoa' : 'pessoas'}</span></div></div>
                <button className="icon-btn sm" title="Editar grupo" onClick={() => setEditing(g)}><Pencil size={16} /></button>
              </div>
              <ul className="pn-group-people">
                {g.memberIds.map((id) => data.members.find((m) => m.id === id)).filter((m) => !!m).map((m) => (
                  <li key={m!.id}><Avatar name={m!.name} size={26} /> {m!.name}</li>
                ))}
                {g.memberIds.length === 0 && <li className="muted small">Sem pessoas</li>}
              </ul>
              <p className="muted small">{u.next ? `Próxima escala: ${relativeDay(u.next).toLowerCase()}` : 'Sem escala marcada'} · {u.recent}× nos últimos 45 dias</p>
            </section>
          )
        })}
        {groups.length === 0 && <div className="pn-card"><p className="pn-empty">Nenhum grupo ainda. Crie os grupos com as pessoas de {roleNames}.</p></div>}
      </div>
      {loose.length > 0 && groups.length > 0 && (
        <div className="pn-card pn-loose">
          <strong>Sem grupo ({loose.length})</strong>
          <p className="muted small">{loose.map((p) => p.name).join(', ')}. Elas ainda podem ser escaladas como pessoa avulsa.</p>
        </div>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'Novo grupo' : `Editar · ${editing.name}`} onClose={() => setEditing(null)} width={520}>
          <GroupForm ministry={ministry} group={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}
