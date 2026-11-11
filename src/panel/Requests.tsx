import { useState } from 'react'
import { Camera, CheckCircle2, Clapperboard, ExternalLink, Film, MonitorPlay, Palette, Pencil, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { todayISO } from '../lib/dates'
import { memberById } from '../lib/selectors'
import { REQUEST_KINDS, bareName, kindOf, type RequestKind } from '../lib/requests'
import { DueBadge, TaskSheet } from '../screens/Arts'
import { Avatar } from '../components/ui'
import { Modal, ddmm } from './common'
import type { Ministry, Task } from '../data/types'

const KIND_ICON = { art: Palette, video: Film, photo: Camera, news: Clapperboard }

/** Pedidos de edição (arte, vídeo, fotos, News) em tabela: prazos, responsáveis e entregas */
export function Requests({ ministry }: { ministry: Ministry }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [view, setView] = useState<'open' | 'done'>('open')
  const [kind, setKind] = useState<RequestKind | ''>('')
  const [deliver, setDeliver] = useState<Task | null>(null)
  const [link, setLink] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const tasks = (data.tasks ?? []).filter((t) => t.ministryId === ministry.id)
  const open = tasks.filter((t) => t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const late = open.filter((t) => t.dueDate < today).length
  const list = (view === 'open' ? open : done).filter((t) => !kind || kindOf(t) === kind)
  const evTitle = (t: Task) => (t.airDate ? `domingo ${ddmm(t.airDate)}` : data.events.find((e) => e.id === t.eventId)?.title)

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Pedidos</h1>
          <p>{ministry.name} · {open.length} em aberto{late ? ` · ${late} ${late === 1 ? 'atrasado' : 'atrasados'}` : ''}</p>
        </div>
        <div className="pn-head-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={16} /> Novo pedido</button>
        </div>
      </header>

      <div className="pn-toolbar">
        <div className="pn-seg">
          <button className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>Em aberto ({open.length})</button>
          <button className={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>Entregues ({done.length})</button>
        </div>
        <div className="chips">
          <button className={`chip${kind === '' ? ' on' : ''}`} onClick={() => setKind('')}>Todos</button>
          {(Object.keys(REQUEST_KINDS) as RequestKind[]).map((k) => {
            const Icon = KIND_ICON[k]
            return <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}><Icon size={14} /> {REQUEST_KINDS[k].chip}</button>
          })}
        </div>
      </div>

      <div className="pn-card pn-card-flush">
        <table className="pn-table pn-requests">
          <thead>
            <tr><th>Pedido</th><th>Tipo</th><th>Destino</th><th>Responsável</th><th>{view === 'open' ? 'Prazo' : 'Entregue'}</th><th /></tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const k = kindOf(t)
              const Icon = KIND_ICON[k]
              const who = memberById(data, t.assigneeId)
              return (
                <tr key={t.id} className={t.status === 'open' && t.dueDate < today ? 'late' : ''}>
                  <td>
                    <strong>{t.title}</strong>
                    {(t.details || evTitle(t)) && <span className="muted small block pn-clip">{[evTitle(t), t.details].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="nowrap"><span className="pn-kind"><Icon size={15} /> {REQUEST_KINDS[k].prefix}</span></td>
                  <td className="nowrap">
                    <span className="pn-dest">
                      {t.projection && <span><MonitorPlay size={14} /> Projeção</span>}
                      {t.social && <span><Share2 size={14} /> Redes</span>}
                    </span>
                  </td>
                  <td className="nowrap"><div className="pn-person"><Avatar name={who?.name ?? '?'} size={26} /><span className="small">{who?.name ?? 'Pessoa removida'}</span></div></td>
                  <td className="nowrap">{t.status === 'open' ? <DueBadge due={t.dueDate} /> : <span className="small">{t.doneAt ? ddmm(t.doneAt.slice(0, 10)) : '—'}</span>}</td>
                  <td className="right nowrap">
                    {confirmDel === t.id ? (
                      <span className="pn-inline-confirm">
                        <span className="small">Excluir?</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>Não</button>
                        <button className="btn btn-danger btn-sm" onClick={() => { actions.removeTask(t.id); setConfirmDel(null); notify('Pedido excluído') }}>Excluir</button>
                      </span>
                    ) : (
                      <>
                        {t.status === 'open'
                          ? <button className="btn btn-ghost btn-sm" onClick={() => { setDeliver(t); setLink('') }}><CheckCircle2 size={15} /> Entregue</button>
                          : t.link
                            ? <a className="btn btn-soft btn-sm" href={t.link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir</a>
                            : null}
                        {t.status === 'done' && <button className="icon-btn sm" title="Reabrir" onClick={() => { actions.setTaskDone(t.id, false); notify('Pedido voltou para “em aberto”') }}><RotateCcw size={16} /></button>}
                        <button className="icon-btn sm" title="Editar" onClick={() => setEditing(t)}><Pencil size={16} /></button>
                        <button className="icon-btn sm" title="Excluir" onClick={() => setConfirmDel(t.id)}><Trash2 size={16} /></button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && <tr><td colSpan={6} className="pn-empty">{view === 'open' ? 'Nenhum pedido em aberto.' : 'Nenhum pedido entregue ainda.'}</td></tr>}
          </tbody>
        </table>
      </div>

      <TaskSheet ministry={ministry} task={editing} onClose={() => setEditing(null)} />
      {deliver && (
        <Modal title={`Entregar ${bareName(kindOf(deliver))}`} subtitle={deliver.title} onClose={() => setDeliver(null)} width={480}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeliver(null)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!!deliver.projection && !link.trim()} onClick={() => {
              actions.setTaskDone(deliver.id, true, link)
              notify(deliver.projection ? 'Entregue! A Projeção e os líderes foram avisados ✅' : 'Entregue! Os líderes foram avisados ✅')
              setDeliver(null)
            }}>Confirmar entrega</button>
          </>}>
          <label className="field">
            <span>Link {REQUEST_KINDS[kindOf(deliver)].of}{deliver.projection ? '' : ' (opcional)'}</span>
            <input autoFocus inputMode="url" placeholder={REQUEST_KINDS[kindOf(deliver)].linkHint} value={link} onChange={(e) => setLink(e.target.value)} />
          </label>
          {deliver.projection && <p className="muted small">A Projeção abre por este link no dia do culto.</p>}
        </Modal>
      )}
    </div>
  )
}
