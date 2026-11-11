import { useState } from 'react'
import { CalendarClock, EyeOff, Megaphone, Trash2 } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { timeAgo, todayISO } from '../lib/dates'
import { memberById, ministryMembers, noticeActive } from '../lib/selectors'
import { NOTICE_PUSH_HINT, UntilPicker, defaultNoticeUntil, noticeStatus, publishedMessage } from '../components/NoticeBits'
import type { Ministry, Notice } from '../data/types'

/** Avisos do ministério (e da igreja): escrever, escolher até quando fica ativo, retirar e excluir */
export function Notices({ ministry }: { ministry: Ministry }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const today = todayISO()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [until, setUntil] = useState(defaultNoticeUntil)
  const [target, setTarget] = useState<'ministry' | 'church'>('ministry')
  const [view, setView] = useState<'active' | 'ended'>('active')
  const [error, setError] = useState('')
  const people = ministryMembers(data, ministry.id).length
  const mine = data.notices
    .filter((n) => n.ministryId === ministry.id || n.ministryId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const active = mine.filter((n) => noticeActive(n, today))
  const ended = mine.filter((n) => !noticeActive(n, today))
  const list = view === 'active' ? active : ended

  const [sending, setSending] = useState(false)
  const send = async () => {
    if (!title.trim()) return setError('Dê um título para o aviso.')
    if (!body.trim()) return setError('Escreva a mensagem.')
    setSending(true)
    const r = await actions.addNotice(target === 'church' ? null : ministry.id, title.trim(), body.trim(), until || undefined)
    setSending(false)
    notify(publishedMessage(target === 'church' ? 'toda a igreja' : `o ${ministry.name}`, r))
    if (!r.ok) return
    setTitle(''); setBody(''); setError(''); setUntil(defaultNoticeUntil()); setView('active')
  }

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Avisos</h1>
          <p>{ministry.name} · chegam no celular de cada pessoa, com notificação, e ficam na tela Início até a data escolhida.</p>
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
            <textarea id="pn-notice-body" rows={6} maxLength={2000} value={body} onChange={(e) => { setBody(e.target.value); setError('') }} placeholder="Escreva o recado completo: dia, horário, local, o que levar…" />
          </label>
          <UntilPicker value={until} onChange={setUntil} />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={sending} onClick={send}>{sending ? 'Publicando…' : 'Publicar aviso'}</button>
          <p className="muted small pn-under">{target === 'church' ? 'Vai para todos os voluntários da igreja.' : `Vai para as ${people} pessoas do ${ministry.name}.`} Recebe a notificação quem ativou no celular; depois da data, o aviso sai sozinho da tela da equipe.</p>
          <p className="muted small">{NOTICE_PUSH_HINT}</p>
        </section>

        <section className="pn-card">
          <div className="pn-card-head">
            <div className="pn-seg">
              <button className={view === 'active' ? 'on' : ''} onClick={() => setView('active')}>Ativos ({active.length})</button>
              <button className={view === 'ended' ? 'on' : ''} onClick={() => setView('ended')}>Encerrados e retirados ({ended.length})</button>
            </div>
          </div>
          {list.length === 0 ? <p className="pn-empty">{view === 'active' ? 'Nenhum aviso ativo.' : 'Nenhum aviso encerrado ou retirado.'}</p> : (
            <ul className="pn-notices">
              {list.slice(0, 40).map((n) => <NoticeRow key={n.id} n={n} ministry={ministry} canManage={n.ministryId !== null || me.access === 'admin'} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/** Um aviso enviado: situação (até quando, retirado, encerrado) e as ações de quem cuida dele */
function NoticeRow({ n, ministry, canManage }: { n: Notice; ministry: Ministry; canManage: boolean }) {
  const { data, actions, notify } = useStore()
  const [confirmDel, setConfirmDel] = useState(false)
  const [editDate, setEditDate] = useState<string | null>(null)
  const st = noticeStatus(n)
  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => { const r = await p; notify(r.ok ? msg : r.error ?? 'Não foi possível.') }

  return (
    <li className={st.active ? '' : 'ended'}>
      <span className="muted small">{n.ministryId ? ministry.name : 'Lagoinha Franca'} · {memberById(data, n.authorId)?.name.split(' ')[0] ?? 'Liderança'} · {timeAgo(n.createdAt)}</span>
      <strong>{n.title}</strong>
      <p>{n.body}</p>
      <div className="pn-notice-foot">
        <span className={`pn-notice-status${st.active ? '' : ' off'}`}><CalendarClock size={14} /> {st.text}</span>
        {canManage && (confirmDel ? (
          <span className="pn-inline-confirm">
            <span className="small">Excluir de vez?</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Não</button>
            <button className="btn btn-danger btn-sm" onClick={() => run(actions.removeNotice(n.id), 'Aviso excluído')}>Excluir</button>
          </span>
        ) : editDate === null ? (
          <span className="pn-notice-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditDate(n.until && n.until >= todayISO() ? n.until : defaultNoticeUntil())}><CalendarClock size={14} /> {st.active ? 'Mudar data' : 'Reativar'}</button>
            {st.active && <button className="btn btn-ghost btn-sm" onClick={() => run(actions.archiveNotice(n.id, true), 'Aviso retirado: a equipe não vê mais')}><EyeOff size={14} /> Retirar</button>}
            <button className="icon-btn sm" title="Excluir aviso" onClick={() => setConfirmDel(true)}><Trash2 size={16} /></button>
          </span>
        ) : null)}
      </div>
      {editDate !== null && (
        <div className="pn-notice-date">
          <UntilPicker value={editDate} onChange={setEditDate} />
          <div className="pn-inline-confirm">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditDate(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={async () => {
              await run(actions.archiveNotice(n.id, false, editDate), st.active ? (editDate ? 'Data do aviso atualizada' : 'O aviso fica até alguém retirar') : 'O aviso voltou a aparecer para a equipe')
              setEditDate(null)
            }}>{st.active ? 'Salvar data' : 'Reativar aviso'}</button>
          </div>
        </div>
      )}
    </li>
  )
}
