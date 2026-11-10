import { CheckCircle2, ChevronRight, Clock, UploadCloud } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, fromISO, toISO, todayISO, weekdayShort } from '../lib/dates'
import { deliveryLabel, materialToEdit } from '../lib/delivery'
import { firstName, memberById } from '../lib/selectors'
import type { Ministry } from '../data/types'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * Material (fotos, vídeo, filmagens) dos cultos das últimas 2 semanas, quem já enviou e quem falta.
 * Para o líder: todas as funções. Para quem edita: só as que mandam para a sua edição (`roles`).
 */
export function RecentMaterial({ ministry, roles, title = 'Material dos últimos cultos' }: { ministry: Ministry; roles?: string[]; title?: string }) {
  const { data } = useStore()
  const { push } = useNav()
  if (!ministry.roles.some((r) => r.delivery)) return null
  const today = todayISO()
  const from = toISO(addDays(fromISO(today), -14))
  const rows = data.events
    .filter((e) => e.date >= from && e.date <= today && e.ministryIds.includes(ministry.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    .map((e) => ({
      e,
      list: data.assignments.filter((a) => a.eventId === e.id && a.ministryId === ministry.id && !a.draft && a.status !== 'declined' && deliveryLabel(data, a) && (!roles || roles.includes(a.role))),
    }))
    .filter((r) => r.list.length)
    .slice(0, 6)
  if (!rows.length) return null
  const missing = rows.reduce((n, r) => n + r.list.filter((a) => !a.delivery).length, 0)
  const sent = rows.reduce((n, r) => n + r.list.filter((a) => a.delivery).length, 0)

  return (
    <div className="card recent-material">
      <div className="arts-home-head">
        <span className="arts-home-icon"><UploadCloud size={18} /></span>
        <div className="grow">
          <strong>{title}</strong>
          <span className="muted small block">
            {roles
              ? [sent && `${sent} ${sent === 1 ? 'chegou' : 'chegaram'}`, missing && `${missing} a caminho`].filter(Boolean).join(' · ') + '. Toque no culto para abrir.'
              : missing ? `${missing} ${missing === 1 ? 'envio pendente' : 'envios pendentes'}` : 'Tudo enviado 🙌'}
          </span>
        </div>
      </div>
      {rows.map(({ e, list }) => (
        <button key={e.id} className="arts-home-row" onClick={() => push({ name: 'event', id: e.id })}>
          <div className="grow">
            <span className="arts-home-title">{e.title} · {weekdayShort(e.date).toLowerCase()}, {ddmm(e.date)}</span>
            <span className="material-chips">
              {list.map((a) => (
                <span key={a.id} className={`material-chip${a.delivery ? ' ok' : ''}`}>
                  {a.delivery ? <CheckCircle2 size={13} /> : <Clock size={13} />} {a.role} · {firstName(memberById(data, a.memberId)?.name ?? '')}
                </span>
              ))}
            </span>
          </div>
          <ChevronRight size={18} className="muted" />
        </button>
      ))}
    </div>
  )
}

/** Na tela Início de quem edita: o material que chegou para editar (ex.: Edição de fotos ← Fotografia) */
export function HomeMaterialToEdit() {
  const { data } = useStore()
  const me = useMe()
  return (
    <>
      {materialToEdit(data, me.id).map(({ ministryId, roles }) => {
        const m = data.ministries.find((x) => x.id === ministryId)
        return m && <RecentMaterial key={ministryId} ministry={m} roles={roles} title="Material para editar" />
      })}
    </>
  )
}
