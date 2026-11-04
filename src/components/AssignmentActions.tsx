import { useState } from 'react'
import { Check, MapPin, Repeat, X } from 'lucide-react'
import { useStore } from '../data/store'
import type { Joined } from '../lib/selectors'
import { isPast, isToday } from '../lib/schedule'
import { Sheet } from './ui'

/** Botões de ação de uma escala do próprio voluntário: confirmar, recusar, pedir troca, check-in */
export function AssignmentActions({ item, compact }: { item: Joined; compact?: boolean }) {
  const { data, actions, notify } = useStore()
  const [declineOpen, setDeclineOpen] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { a, ev } = item
  const openSwap = data.swaps.find((s) => s.assignmentId === a.id && s.status === 'open')

  if (isPast(ev)) return null

  const sendSwap = () => {
    actions.requestSwap(a.id, reason.trim() || 'Não vou conseguir servir neste dia.')
    setSwapOpen(false)
    setDeclineOpen(false)
    setReason('')
    notify('Pedido de troca enviado para a equipe 🔁')
  }

  return (
    <>
      {a.status === 'pending' && (
        <div className={`btn-row${compact ? ' compact' : ''}`}>
          <button className="btn btn-primary" onClick={() => { actions.respond(a.id, 'confirmed'); notify('Presença confirmada! Deus abençoe 🙌') }}>
            <Check size={18} /> Confirmar
          </button>
          <button className="btn btn-ghost" onClick={() => setDeclineOpen(true)}>
            <X size={18} /> Não posso
          </button>
        </div>
      )}

      {a.status === 'confirmed' && isToday(ev) && !a.checkedIn && (
        <button className="btn btn-primary btn-block" onClick={() => { actions.checkIn(a.id); notify('Check-in feito! +10 pontos ⭐') }}>
          <MapPin size={18} /> Fazer check-in
        </button>
      )}

      {a.status === 'confirmed' && !a.checkedIn && (
        openSwap ? (
          <div className="swap-note">
            <Repeat size={16} /> Troca solicitada — aguardando alguém assumir
            <button className="link" onClick={() => actions.cancelSwap(openSwap.id)}>Cancelar</button>
          </div>
        ) : (
          !compact && (
            <button className="btn btn-ghost btn-block" onClick={() => setSwapOpen(true)}>
              <Repeat size={18} /> Pedir troca
            </button>
          )
        )
      )}

      <Sheet open={declineOpen} onClose={() => setDeclineOpen(false)} title="Não vai conseguir servir?">
        <p className="muted">Você pode pedir para alguém da equipe assumir no seu lugar, ou apenas recusar e o líder escala outra pessoa.</p>
        <div className="stack">
          <button className="btn btn-primary btn-block" onClick={() => { setDeclineOpen(false); setSwapOpen(true) }}>
            <Repeat size={18} /> Pedir troca para a equipe
          </button>
          <button className="btn btn-danger btn-block" onClick={() => { actions.respond(a.id, 'declined'); setDeclineOpen(false); notify('Escala recusada. O líder foi avisado.') }}>
            Recusar escala
          </button>
        </div>
      </Sheet>

      <Sheet open={swapOpen} onClose={() => setSwapOpen(false)} title="Pedir troca">
        <p className="muted">Quem tem a mesma função ({a.role}) vai ver seu pedido e poderá assumir.</p>
        <label className="field">
          <span>Motivo (opcional)</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: vou viajar nesse fim de semana" />
        </label>
        <button className="btn btn-primary btn-block" onClick={sendSwap}>Enviar pedido</button>
      </Sheet>
    </>
  )
}
