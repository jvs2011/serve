import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { timeAgo } from '../lib/dates'
import { memberById, ministryMembers } from '../lib/selectors'
import type { Ministry } from '../data/types'

/** Avisos do ministério (e da igreja): escrever com calma no computador e ver o que já foi enviado */
export function Notices({ ministry }: { ministry: Ministry }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<'ministry' | 'church'>('ministry')
  const [error, setError] = useState('')
  const people = ministryMembers(data, ministry.id).length
  const list = data.notices
    .filter((n) => n.ministryId === ministry.id || n.ministryId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30)

  const send = () => {
    if (!title.trim()) return setError('Dê um título para o aviso.')
    if (!body.trim()) return setError('Escreva a mensagem.')
    actions.addNotice(target === 'church' ? null : ministry.id, title.trim(), body.trim())
    notify(target === 'church' ? 'Aviso publicado para toda a igreja 📣' : `Aviso publicado para o ${ministry.name} 📣`)
    setTitle(''); setBody(''); setError('')
  }

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Avisos</h1>
          <p>{ministry.name} · chegam no celular de cada pessoa, com notificação</p>
        </div>
      </header>
      <div className="pn-cols pn-cols-notices">
        <section className="pn-card">
          <div className="pn-card-head"><h2>Novo aviso</h2><Megaphone size={18} className="accent" /></div>
          {me.access === 'admin' && (
            <div className="pn-seg pn-seg-block">
              <button className={target === 'ministry' ? 'on' : ''} onClick={() => setTarget('ministry')}>{ministry.name} ({people})</button>
              <button className={target === 'church' ? 'on' : ''} onClick={() => setTarget('church')}>Toda a igreja</button>
            </div>
          )}
          <label className="field">
            <span>Título</span>
            <input id="pn-notice-title" maxLength={120} value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder="Ex.: Ensaio geral no sábado" />
          </label>
          <label className="field">
            <span>Mensagem</span>
            <textarea id="pn-notice-body" rows={7} maxLength={2000} value={body} onChange={(e) => { setBody(e.target.value); setError('') }} placeholder="Escreva o recado completo: dia, horário, local, o que levar…" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={send}>Publicar aviso</button>
          <p className="muted small pn-card-sub">{target === 'church' ? 'Vai para todos os voluntários da igreja.' : `Vai para as ${people} pessoas do ${ministry.name}.`}</p>
        </section>

        <section className="pn-card">
          <div className="pn-card-head"><h2>Enviados</h2></div>
          {list.length === 0 ? <p className="pn-empty">Nenhum aviso ainda.</p> : (
            <ul className="pn-notices">
              {list.map((n) => (
                <li key={n.id}>
                  <span className="muted small">{n.ministryId ? ministry.name : 'Lagoinha Franca'} · {memberById(data, n.authorId)?.name.split(' ')[0] ?? 'Liderança'} · {timeAgo(n.createdAt)}</span>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
