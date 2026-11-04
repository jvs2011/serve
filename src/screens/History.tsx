import { History as HistoryIcon, Star } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { myPast } from '../lib/selectors'
import { DateBlock, Empty, TopBar } from '../components/ui'

export function History() {
  const { data } = useStore()
  const me = useMe()
  const { back, push } = useNav()
  const past = myPast(data, me.id)
  return (
    <div className="screen">
      <TopBar title="Histórico" subtitle={`${past.filter((x) => x.a.checkedIn).length} cultos servidos`} onBack={back} />
      {past.length === 0 ? (
        <Empty icon={<HistoryIcon />} title="Nada por aqui ainda" />
      ) : (
        <div className="list">
          {past.map((x) => (
            <button key={x.a.id} className="card assign-row" onClick={() => push({ name: 'event', id: x.ev.id })}>
              <DateBlock iso={x.ev.date} />
              <div className="grow">
                <strong>{x.ev.title}</strong>
                <span className="muted">{x.ministry.name} · {x.a.role}</span>
              </div>
              {x.a.feedback && <span className="rating"><Star size={14} fill="currentColor" /> {x.a.feedback.rating}</span>}
              {x.a.checkedIn ? <span className="pill pill-checkin">Serviu</span> : <span className="pill pill-declined">Faltou</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
