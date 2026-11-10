import { useState } from 'react'
import { CheckCircle2, ChevronRight, ExternalLink, UploadCloud } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { todayISO, weekdayShort } from '../lib/dates'
import { deliveryLabel, pendingDeliveries } from '../lib/delivery'
import type { Joined } from '../lib/selectors'
import { Sheet } from './ui'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Na escala de quem é de Fotografia, Vídeo ou Filmagem do News: enviar o link do material */
export function DeliveryBox({ item }: { item: Joined }) {
  const { data, actions, notify } = useStore()
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState(item.a.delivery?.link ?? '')
  const [saving, setSaving] = useState(false)
  const label = deliveryLabel(data, item.a)
  if (!label || item.a.status === 'declined' || item.ev.date > todayISO()) return null
  const d = item.a.delivery

  const send = async () => {
    setSaving(true)
    const r = await actions.deliverMaterial(item.a.id, link)
    setSaving(false)
    if (!r.ok) return notify(r.error)
    setOpen(false)
    notify(link.trim() ? `Pronto! Os líderes receberam ${label} ✅` : 'Link removido')
  }

  return (
    <>
      {d ? (
        <div className="delivery done">
          <CheckCircle2 size={18} />
          <span className="grow">Você enviou {label} em {ddmm(d.at.slice(0, 10))}</span>
          <a className="btn btn-soft btn-sm" href={d.link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir</a>
          <button className="link small" onClick={() => setOpen(true)}>Trocar</button>
        </div>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => setOpen(true)}><UploadCloud size={18} /> Enviar {label}</button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={`Enviar ${label}`}>
        <p className="muted">{item.ev.title} · {weekdayShort(item.ev.date).toLowerCase()}, {ddmm(item.ev.date)}</p>
        <label className="field">
          <span>Link da pasta ou do arquivo</span>
          <input id={`deliv-${item.a.id}`} inputMode="url" placeholder="Drive, WeTransfer, Dropbox…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <p className="muted small">Confira se o link está aberto para quem tiver o endereço.</p>
        <button className="btn btn-primary btn-block" disabled={saving || (!d && !link.trim())} onClick={send}>{saving ? 'Enviando…' : d && !link.trim() ? 'Remover link' : 'Enviar'}</button>
      </Sheet>
    </>
  )
}

/** Cartão na tela Início: material que a pessoa ainda precisa enviar */
export function HomeDeliveriesCard() {
  const { data } = useStore()
  const me = useMe()
  const { push } = useNav()
  const list = pendingDeliveries(data, me.id, todayISO())
  if (!list.length) return null
  const evs = new Map(data.events.map((e) => [e.id, e]))
  const label = (id: string) => deliveryLabel(data, data.assignments.find((a) => a.id === id)!) ?? 'o material'
  return (
    <div className="card arts-home">
      <div className="arts-home-head">
        <span className="arts-home-icon"><UploadCloud size={18} /></span>
        <strong className="grow">{list.length === 1 ? `Envie ${label(list[0].id)}` : `${list.length} materiais para enviar`}</strong>
      </div>
      {list.slice(0, 3).map((a) => {
        const ev = evs.get(a.eventId)!
        return (
          <button key={a.id} className="arts-home-row" onClick={() => push({ name: 'event', id: ev.id })}>
            <div className="grow">
              <span className="arts-home-title">{ev.title} · {a.role}</span>
              <span className="muted small">{weekdayShort(ev.date).toLowerCase()}, {ddmm(ev.date)} · falta enviar {label(a.id)}</span>
            </div>
            <ChevronRight size={18} className="muted" />
          </button>
        )
      })}
    </div>
  )
}
