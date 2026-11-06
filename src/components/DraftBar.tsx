import { useState } from 'react'
import { FilePen, Send } from 'lucide-react'
import { useStore } from '../data/store'
import { draftsOf } from '../lib/schedule'
import type { Ministry } from '../data/types'

/**
 * Escalas em rascunho de um ministério (ou de um evento): o líder confere e publica.
 * Só ao publicar as pessoas veem a escala e recebem a notificação.
 */
export function DraftBar({ ministry, eventId, showName }: { ministry: Ministry; eventId?: string; showName?: boolean }) {
  const { data, actions, notify } = useStore()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const drafts = draftsOf(data, ministry.id, eventId)
  if (!drafts.length) return null
  const events = new Set(drafts.map((a) => a.eventId)).size
  const people = new Set(drafts.map((a) => a.memberId)).size
  return (
    <div className="card draft-bar">
      <div className="draft-text">
        <FilePen size={20} />
        <div className="grow">
          <strong>{showName ? `${ministry.name}: ` : ''}{drafts.length} {drafts.length === 1 ? 'escala em rascunho' : 'escalas em rascunho'}</strong>
          <span className="small">
            {eventId ? '' : `${events} ${events === 1 ? 'evento' : 'eventos'} · `}{people} {people === 1 ? 'pessoa' : 'pessoas'}. Só os líderes veem; publique para avisar a equipe.
          </span>
        </div>
      </div>
      {confirmDiscard ? (
        <div className="btn-row">
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDiscard(false)}>Manter</button>
          <button className="btn btn-danger btn-sm" onClick={() => {
            const n = actions.discardDrafts(ministry.id, eventId)
            setConfirmDiscard(false)
            notify(`${n} ${n === 1 ? 'escala descartada' : 'escalas descartadas'}`)
          }}>Descartar rascunho</button>
        </div>
      ) : (
        <div className="btn-row">
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDiscard(true)}>Descartar</button>
          <button className="btn btn-primary btn-sm" onClick={() => {
            const n = actions.publishDrafts(ministry.id, eventId)
            notify(`Escala publicada ✨ ${n === 1 ? 'A pessoa foi avisada' : `${people} ${people === 1 ? 'pessoa avisada' : 'pessoas avisadas'}`} para confirmar.`)
          }}><Send size={15} /> Publicar</button>
        </div>
      )}
    </div>
  )
}
