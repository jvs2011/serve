import { useStore } from '../data/store'
import { slotsFor } from '../lib/schedule'
import { firstName, memberById } from '../lib/selectors'
import { CandidatePicker, Modal, evLabel } from './common'
import type { Assignment, ChurchEvent, Ministry } from '../data/types'

/** Vaga a preencher: escalar alguém (ou um grupo) ou trocar quem já está */
export type PickFor = { ev: ChurchEvent; role: string; replace?: Assignment }

/** Janela de escalar: a pessoa entra no rascunho (quem é trocado sai); o líder publica depois */
export function AssignModal({ ministry, picking, onClose }: { ministry: Ministry; picking: PickFor; onClose: () => void }) {
  const { data, actions, notify } = useStore()
  const name = (id: string) => firstName(memberById(data, id)?.name ?? '')
  const group = !picking.replace && !!slotsFor(data, picking.ev, ministry.id).find((s) => s.name === picking.role)?.group

  const pick = (memberId: string) => {
    actions.assign(picking.ev.id, ministry.id, picking.role, memberId)
    if (picking.replace) {
      actions.unassign(picking.replace.id)
      notify(`${name(memberId)} entra no lugar de ${name(picking.replace.memberId)} (rascunho). Publique para avisar.`)
    } else notify(`${name(memberId)} entrou no rascunho. Publique para avisar.`)
    onClose()
  }
  const pickGroup = async (groupId: string) => {
    const r = await actions.assignGroup(picking.ev.id, ministry.id, picking.role, groupId)
    if (!r.ok) return notify(r.error)
    notify(`${ministry.groups?.find((g) => g.id === groupId)?.name ?? 'Grupo'} entrou no rascunho. Publique para avisar.`)
    onClose()
  }

  return (
    <Modal
      title={picking.replace ? `Trocar ${name(picking.replace.memberId)}` : `Escalar · ${picking.role}`}
      subtitle={`${picking.role} · ${evLabel(picking.ev)}`}
      onClose={onClose}
    >
      <CandidatePicker ev={picking.ev} ministry={ministry} role={picking.role} exclude={picking.replace?.memberId} group={group} onPick={pick} onPickGroup={pickGroup} />
    </Modal>
  )
}
