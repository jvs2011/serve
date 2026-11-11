import { addDays, toISO, todayISO, weekdayShort } from '../lib/dates'
import { noticeActive } from '../lib/selectors'
import type { Notice } from '../data/types'
import type { ActionResult } from '../data/actions'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const inDays = (n: number) => toISO(addDays(new Date(), n))

/** Data padrão de um aviso novo: fica uma semana */
export const defaultNoticeUntil = () => inDays(7)

/** Até quando o aviso fica ativo: atalhos (1 semana, 2 semanas, 1 mês, sem data) ou um dia escolhido */
export function UntilPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = todayISO()
  const quick: [string, string][] = [['1 semana', inDays(7)], ['2 semanas', inDays(14)], ['1 mês', inDays(30)]]
  return (
    <div className="until-picker">
      <span className="field-label">Fica ativo até</span>
      <div className="chips">
        {quick.map(([label, v]) => <button key={label} type="button" className={`chip${value === v ? ' on' : ''}`} onClick={() => onChange(v)}>{label}</button>)}
        <button type="button" className={`chip${value === '' ? ' on' : ''}`} onClick={() => onChange('')}>Sem data</button>
      </div>
      <label className="field until-date">
        <span>{value ? `Último dia: ${weekdayShort(value).toLowerCase()}, ${ddmm(value)}` : 'Fica até alguém retirar'}</span>
        <input type="date" min={today} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

/** Situação do aviso para quem cuida dele: ativo até quando, retirado ou encerrado */
export function noticeStatus(n: Notice, today = todayISO()): { active: boolean; text: string } {
  if (n.archivedAt) return { active: false, text: `Retirado em ${ddmm(n.archivedAt.slice(0, 10))}` }
  if (n.until && n.until < today) return { active: false, text: `Encerrado em ${ddmm(n.until)}` }
  if (n.until) return { active: noticeActive(n, today), text: n.until === today ? 'Ativo até hoje' : `Ativo até ${weekdayShort(n.until).toLowerCase()}, ${ddmm(n.until)}` }
  return { active: true, text: 'Ativo, sem data de término' }
}

/** Mensagem depois de publicar: em quantos celulares a notificação chegou (nos dados reais) */
export function publishedMessage(where: string, r: { ok: true; result: ActionResult } | { ok: false; error: string }): string {
  if (!r.ok) return r.error
  const n = r.result.pushed
  if (n === undefined) return `Aviso publicado para ${where} 📣`
  if (n === 0) return `Aviso publicado para ${where}, mas nenhum celular recebeu a notificação: ninguém ativou as notificações ainda.`
  return `Aviso publicado para ${where} 📣 A notificação chegou em ${n} ${n === 1 ? 'celular' : 'celulares'}.`
}

/** Explica quem recebe a notificação de um aviso */
export const NOTICE_PUSH_HINT = 'A notificação chega para quem ativou no celular, e você também recebe uma cópia como confirmação.'
