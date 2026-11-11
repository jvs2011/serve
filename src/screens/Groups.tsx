import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { groupPeople } from '../data/actions'
import { canManage } from '../lib/schedule'
import { Avatar, Empty, Sheet } from '../components/ui'
import type { MemberGroup, Ministry } from '../data/types'

/** Aba "Grupos" (ex.: grupos de voz do Louvor): o líder monta os grupos que entram juntos na escala */
export function GroupsTab({ ministry }: { ministry: Ministry }) {
  const { data } = useStore()
  const me = useMe()
  const manage = canManage(me, ministry.id, data)
  const [editing, setEditing] = useState<MemberGroup | 'new' | null>(null)
  const groups = ministry.groups ?? []
  const people = groupPeople(data, ministry.id)
  const roleNames = ministry.roles.filter((r) => r.group).map((r) => r.name).join(', ')
  const loose = people.filter((p) => !groups.some((g) => g.memberIds.includes(p.id)))

  return (
    <>
      <p className="muted small form-help">
        Cada grupo entra junto na escala, ocupando a vaga de {roleNames}. Na escala automática os grupos fazem rodízio,
        e quem estiver indisponível no dia fica de fora.
      </p>
      {manage && <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}><Plus size={18} /> Novo grupo</button>}
      {groups.length === 0 ? (
        <Empty icon={<Users />} title="Nenhum grupo criado" text={manage ? `Crie os grupos com as pessoas de ${roleNames}.` : 'Os líderes ainda não montaram os grupos.'} />
      ) : (
        <div className="list mt">
          {groups.map((g) => (
            <div key={g.id} className="card group-card">
              <div className="group-head">
                <span className="group-icon"><Users size={18} /></span>
                <strong className="grow">{g.name}</strong>
                {manage && <button className="icon-btn sm" aria-label={`Editar ${g.name}`} onClick={() => setEditing(g)}><Pencil size={16} /></button>}
              </div>
              <div className="group-people">
                {g.memberIds.map((id) => data.members.find((m) => m.id === id)).filter((m) => !!m).map((m) => (
                  <span key={m!.id} className={`group-person${m!.id === me.id ? ' me' : ''}`}>
                    <Avatar name={m!.name} size={24} /> {m!.id === me.id ? 'Você' : m!.name}
                  </span>
                ))}
                {g.memberIds.length === 0 && <span className="muted small">Sem pessoas</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {manage && loose.length > 0 && groups.length > 0 && (
        <p className="muted small mt">Sem grupo: {loose.map((p) => p.name).join(', ')}</p>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo grupo' : 'Editar grupo'}>
        {editing && <GroupForm key={editing === 'new' ? 'new' : editing.id} ministry={ministry} group={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

export function GroupForm({ ministry, group, onDone }: { ministry: Ministry; group?: MemberGroup; onDone: () => void }) {
  const { data, actions, notify } = useStore()
  const [name, setName] = useState(group?.name ?? '')
  const [ids, setIds] = useState<string[]>(group?.memberIds ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const people = [...groupPeople(data, ministry.id)].sort((a, b) => a.name.localeCompare(b.name))
  const otherGroup = (id: string) => ministry.groups?.find((g) => g.id !== group?.id && g.memberIds.includes(id))
  const toggle = (id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const save = async () => {
    setSaving(true)
    setError('')
    const r = await actions.saveGroup(ministry.id, { id: group?.id, name, memberIds: ids })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    notify(group ? 'Grupo atualizado' : `${name.trim()} criado ✨`)
    onDone()
  }

  return (
    <div className="group-form">
      <label className="field">
        <span>Nome do grupo</span>
        <input id="group-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Grupo 1" />
      </label>
      <span className="field-label">Quem faz parte ({ids.length})</span>
      {people.length === 0 ? (
        <p className="muted small">Ninguém cadastrado com a função {ministry.roles.filter((r) => r.group).map((r) => r.name).join(', ')}.</p>
      ) : (
        <div className="pick-list">
          {people.map((p) => {
            const on = ids.includes(p.id)
            const other = otherGroup(p.id)
            return (
              <button key={p.id} className={`pick-row${on ? ' on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}>
                <Avatar name={p.name} size={32} />
                <span className="grow">
                  {p.name}
                  {other && <span className="muted small block">Também no {other.name}</span>}
                </span>
                <span className={`check${on ? ' on' : ''}`}>{on && <Check size={16} />}</span>
              </button>
            )
          })}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={!name.trim() || !ids.length || saving} onClick={save}>
        {saving ? 'Salvando…' : group ? 'Salvar grupo' : 'Criar grupo'}
      </button>
      {group && (confirmDel ? (
        <div className="card confirm-box">
          <p>Apagar o <b>{group.name}</b>? As escalas já feitas continuam como estão.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Cancelar</button>
            <button className="btn btn-danger" onClick={() => { actions.removeGroup(ministry.id, group.id); notify(`${group.name} apagado`); onDone() }}>Apagar</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-block danger-text" onClick={() => setConfirmDel(true)}><Trash2 size={18} /> Apagar grupo</button>
      ))}
    </div>
  )
}
