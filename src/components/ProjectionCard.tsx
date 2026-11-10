import { Clapperboard, Copy, ExternalLink, Image, MonitorPlay, Music2 } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { dueLabel } from '../lib/dates'
import { firstName, memberById } from '../lib/selectors'
import { copyText } from '../lib/clipboard'
import { projectionMaterials, projectionTeam, seesProjection } from '../lib/projection'
import type { ChurchEvent, Task } from '../data/types'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const q = (s: string) => encodeURIComponent(s)

/** "Para a projeção": tudo o que vai para a projeção neste culto, dentro da escala do dia */
export function ProjectionCard({ ev }: { ev: ChurchEvent }) {
  const { data, notify } = useStore()
  const me = useMe()
  if (!seesProjection(data, me, ev)) return null
  const { tasks, songs } = projectionMaterials(data, ev)
  const onDuty = projectionTeam(data, ev.id).includes(me.id)
  // quem não está escalado só vê o quadro quando já tem algo nele
  if (!tasks.length && !songs.length && !onDuty) return null

  const item = (t: Task) => {
    const news = t.kind === 'news'
    const who = memberById(data, t.assigneeId)
    const done = t.status === 'done'
    return (
      <div key={t.id} className="proj-item">
        <span className={`proj-icon${t.kind === 'video' || t.kind === 'news' ? ' news' : ''}`}>{t.kind === 'video' || t.kind === 'news' ? <Clapperboard size={18} /> : <Image size={18} />}</span>
        <div className="grow">
          <strong>{news ? 'Vídeo do Lagoinha News' : t.title}</strong>
          <span className="muted small">
            {done ? `Entregue por ${firstName(who?.name ?? '')}${t.doneAt ? ` em ${ddmm(t.doneAt.slice(0, 10))}` : ''}`
              : `Em produção com ${firstName(who?.name ?? '')} · ${dueLabel(t.dueDate).text.toLowerCase()}`}
          </span>
        </div>
        {done && t.link
          ? <button className="btn btn-primary btn-sm" onClick={async () => notify(await copyText(t.link!) ? 'Link copiado ✅' : `Não deu para copiar. Link: ${t.link}`)}><Copy size={15} /> Copiar link</button>
          : <span className={`pill ${done ? 'pill-confirmed' : 'pill-pending'}`}>{done ? 'Sem link' : 'A caminho'}</span>}
      </div>
    )
  }

  return (
    <div className="card proj-card">
      <div className="proj-head">
        <MonitorPlay size={20} />
        <div className="grow">
          <strong>Para a projeção</strong>
          <span className="small">O que vai para a projeção neste culto</span>
        </div>
      </div>
      {tasks.map(item)}
      {songs.length > 0 && (
        <div className="proj-songs">
          <span className="proj-label"><Music2 size={15} /> Músicas do Louvor ({songs.length})</span>
          {songs.map((s, i) => (
            <div key={s.id} className="proj-song">
              <span className="proj-n">{i + 1}</span>
              <span className="grow"><b>{s.title}</b>{s.artist && <span className="muted"> · {s.artist}</span>}</span>
              <a className="icon-btn sm" href={s.link || `https://www.letras.mus.br/?q=${q(`${s.title} ${s.artist}`)}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${s.title}`}><ExternalLink size={15} /></a>
            </div>
          ))}
          <span className="muted small">{ev.setlistSentAt
            ? `Repertório enviado pelo Louvor em ${new Date(ev.setlistSentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`
            : 'O Louvor ainda pode mudar o repertório. Você é avisado quando enviarem.'}</span>
        </div>
      )}
      {!tasks.length && !songs.length && (
        <p className="muted small">Ainda não chegou nada. Quando o Louvor enviar as músicas ou alguém entregar uma arte ou o vídeo do News, você recebe um aviso.</p>
      )}
    </div>
  )
}
