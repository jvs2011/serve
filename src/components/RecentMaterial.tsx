import { CheckCircle2, ChevronRight, Clock, UploadCloud } from 'lucide-react'
import { useStore } from '../data/store'
import { useNav } from '../nav'
import { addDays, fromISO, toISO, todayISO, weekdayShort } from '../lib/dates'
import { deliveryLabel } from '../lib/delivery'
import { firstName, memberById } from '../lib/selectors'
import type { Ministry } from '../data/types'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Para o líder: material (fotos, vídeo, filmagens) dos cultos das últimas 2 semanas, quem já enviou e quem falta */
export function RecentMaterial({ ministry }: { ministry: Ministry }) {
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
      list: data.assignments.filter((a) => a.eventId === e.id && a.ministryId === ministry.id && !a.draft && a.status !== 'declined' && deliveryLabel(data, a)),
    }))
    .filter((r) => r.list.length)
    .slice(0, 6)
  if (!rows.length) return null
  const missing = rows.reduce((n, r) => n + r.list.filter((a) => !a.delivery).length, 0)

  return (
    <div className="card recent-material">
      <div className="arts-home-head">
        <span className="arts-home-icon"><UploadCloud size={18} /></span>
        <div className="grow">
          <strong>Material dos últimos cultos</strong>
          <span className="muted small block">{missing ? `${missing} ${missing === 1 ? 'envio pendente' : 'envios pendentes'}` : 'Tudo enviado 🙌'}</span>
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
