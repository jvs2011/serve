import { useState } from 'react'
import { Repeat } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { relativeDay, timeAgo, timeRange } from '../lib/dates'
import { firstName, memberById, swapsICanCover } from '../lib/selectors'
import { availabilityFor } from '../lib/schedule'
import { Avatar, Empty, MinistryBadge, Sheet, TopBar } from '../components/ui'

export function Swaps() {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const { push } = useNav()
  const [view, setView] = useState<'open' | 'mine'>('open')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const available = swapsICanCover(data, me)
  const mine = data.swaps.filter((s) => s.fromMemberId === me.id && s.status !== 'cancelled')
  const confirming = available.find((x) => x.s.id === confirmId)

  return (
    <div className="screen">
      <TopBar title="Trocas" subtitle="Cubra um irmão ou peça ajuda quando não puder servir" />
      <div className="segmented">
        <button className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>Posso assumir {available.length > 0 && <b className="count">{available.length}</b>}</button>
        <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>Meus pedidos</button>
      </div>

      {view === 'open' ? (
        available.length === 0 ? (
          <Empty icon={<Repeat />} title="Nenhum pedido de troca" text="Quando alguém da sua função precisar de substituto, aparece aqui." />
        ) : (
          <div className="list">
            {available.map(({ s, a, ev, ministry }) => {
              const from = memberById(data, s.fromMemberId)
              const av = availabilityFor(data, me, ev)
              const blocked = av.unavailable || !!av.conflict
              return (
                <div key={s.id} className="card swap-card">
                  <div className="swap-from">
                    <Avatar name={from?.name ?? '?'} size={36} />
                    <div className="grow">
                      <strong>{from?.name}</strong>
                      <span className="muted small">pediu troca · {timeAgo(s.createdAt)}</span>
                    </div>
                  </div>
                  {s.reason && <p className="quote">“{s.reason}”</p>}
                  <button className="swap-event" onClick={() => push({ name: 'event', id: ev.id })}>
                    <MinistryBadge ministry={ministry} size={32} />
                    <div className="grow">
                      <strong>{ev.title}</strong>
                      <span className="muted small">{relativeDay(ev.date)} · {timeRange(ev)} · {ministry.name} · {a.role}</span>
                    </div>
                  </button>
                  {blocked ? (
                    <p className="muted small">{av.unavailable ? 'Você marcou indisponibilidade nesse dia.' : 'Você já está escalado nesse culto.'}</p>
                  ) : (
                    <button className="btn btn-primary btn-block" onClick={() => setConfirmId(s.id)}>Assumir essa escala</button>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : mine.length === 0 ? (
        <Empty icon={<Repeat />} title="Você não pediu trocas" text="Para pedir, abra uma escala confirmada e toque em “Pedir troca”." />
      ) : (
        <div className="list">
          {mine.map((s) => {
            const a = data.assignments.find((x) => x.id === s.assignmentId)
            const ev = a && data.events.find((e) => e.id === a.eventId)
            const ministry = a && data.ministries.find((m) => m.id === a.ministryId)
            if (!a || !ev || !ministry) return null
            const by = s.acceptedById ? memberById(data, s.acceptedById) : null
            return (
              <div key={s.id} className="card swap-card">
                <button className="swap-event" onClick={() => push({ name: 'event', id: ev.id })}>
                  <MinistryBadge ministry={ministry} size={32} />
                  <div className="grow">
                    <strong>{ev.title}</strong>
                    <span className="muted small">{relativeDay(ev.date)} · {timeRange(ev)} · {a.role}</span>
                  </div>
                  {s.status === 'open' ? <span className="pill pill-pending">Aguardando</span> : <span className="pill pill-confirmed">Resolvido</span>}
                </button>
                {s.status === 'accepted' && by && <p className="muted small">🙌 {by.name} assumiu no seu lugar.</p>}
                {s.status === 'open' && (
                  <button className="btn btn-ghost btn-block" onClick={() => { actions.cancelSwap(s.id); notify('Pedido cancelado. Você continua escalado.') }}>Cancelar pedido</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={!!confirming} onClose={() => setConfirmId(null)} title="Assumir escala?">
        {confirming && (
          <>
            <p>
              Você vai servir no <b>{confirming.ev.title}</b> ({relativeDay(confirming.ev.date).toLowerCase()}, {timeRange(confirming.ev)}) como <b>{confirming.a.role}</b> no lugar de {firstName(memberById(data, confirming.s.fromMemberId)?.name ?? '')}.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => {
              actions.acceptSwap(confirming.s.id)
              setConfirmId(null)
              notify('Escala assumida! +5 pontos 💪')
            }}>Sim, eu assumo</button>
          </>
        )}
      </Sheet>
    </div>
  )
}
