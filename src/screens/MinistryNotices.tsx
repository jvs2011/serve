import { useState } from 'react'
import { Eye, EyeOff, Megaphone, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { timeAgo, todayISO } from '../lib/dates'
import { memberById, noticeActive } from '../lib/selectors'
import { Empty, Sheet } from '../components/ui'
import { NOTICE_PUSH_HINT, UntilPicker, defaultNoticeUntil, noticeStatus, publishedMessage } from '../components/NoticeBits'
import type { Ministry, Notice } from '../data/types'

/** Aba Avisos do ministério: a equipe vê os ativos; quem lidera publica, retira e exclui */
export function MinistryNotices({ ministry, manage }: { ministry: Ministry; manage: boolean }) {
  const { data, actions, notify } = useStore()
  const today = todayISO()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', until: defaultNoticeUntil() })
  const [showEnded, setShowEnded] = useState(false)
  const all = data.notices.filter((n) => n.ministryId === ministry.id)
  const active = all.filter((n) => noticeActive(n, today))
  const ended = all.filter((n) => !noticeActive(n, today))

  const [sending, setSending] = useState(false)
  const publish = async () => {
    setSending(true)
    const r = await actions.addNotice(ministry.id, form.title.trim(), form.body.trim(), form.until || undefined)
    setSending(false)
    notify(publishedMessage('a equipe', r))
    if (!r.ok) return
    setForm({ title: '', body: '', until: defaultNoticeUntil() })
    setOpen(false)
  }

  return (
    <>
      {manage && <button className="btn btn-primary btn-block" onClick={() => setOpen(true)}><Megaphone size={18} /> Novo aviso</button>}
      {active.length === 0 ? (
        <Empty icon={<Megaphone />} title="Sem avisos por aqui" />
      ) : (
        <div className="list mt">
          {active.map((n) => <NoticeCard key={n.id} n={n} manage={manage} />)}
        </div>
      )}
      {manage && ended.length > 0 && (
        <>
          <button className="link done-toggle" onClick={() => setShowEnded((v) => !v)}>{showEnded ? 'Esconder encerrados' : `Ver encerrados e retirados (${ended.length})`}</button>
          {showEnded && <div className="list">{ended.map((n) => <NoticeCard key={n.id} n={n} manage />)}</div>}
        </>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={`Aviso para ${ministry.name}`}>
        <label className="field"><span>Título</span><input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="field"><span>Mensagem</span><textarea rows={4} maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        <UntilPicker value={form.until} onChange={(until) => setForm({ ...form, until })} />
        <button className="btn btn-primary btn-block" disabled={!form.title.trim() || sending} onClick={publish}>{sending ? 'Publicando…' : 'Publicar'}</button>
        <p className="muted small notice-hint">{NOTICE_PUSH_HINT}</p>
      </Sheet>
    </>
  )
}

function NoticeCard({ n, manage }: { n: Notice; manage: boolean }) {
  const { data, actions, notify } = useStore()
  const [confirmDel, setConfirmDel] = useState(false)
  const st = noticeStatus(n)
  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => { const r = await p; notify(r.ok ? msg : r.error ?? 'Não foi possível.') }
  return (
    <div className={`card notice${st.active ? '' : ' ended'}`}>
      <span className="muted small">{memberById(data, n.authorId)?.name} · {timeAgo(n.createdAt)}</span>
      <strong>{n.title}</strong>
      <p>{n.body}</p>
      {manage && (
        <div className="notice-manage">
          <span className={`small ${st.active ? 'muted' : 'warn'}`}>{st.text}</span>
          {confirmDel ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Cancelar</button>
              <button className="btn btn-danger btn-sm" onClick={() => run(actions.removeNotice(n.id), 'Aviso excluído')}>Excluir</button>
            </>
          ) : (
            <>
              {st.active
                ? <button className="btn btn-ghost btn-sm" onClick={() => run(actions.archiveNotice(n.id, true), 'Aviso retirado: a equipe não vê mais')}><EyeOff size={15} /> Retirar</button>
                : <button className="btn btn-ghost btn-sm" onClick={() => run(actions.archiveNotice(n.id, false), 'O aviso voltou a aparecer')}><Eye size={15} /> Mostrar de novo</button>}
              <button className="icon-btn sm" aria-label="Excluir aviso" onClick={() => setConfirmDel(true)}><Trash2 size={16} /></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
