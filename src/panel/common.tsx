import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Search, Users, X } from 'lucide-react'
import { useStore } from '../data/store'
import { availabilityFor, rankCandidates, rankGroups } from '../lib/schedule'
import { firstName } from '../lib/selectors'
import { weekdayShort } from '../lib/dates'
import { Avatar } from '../components/ui'
import type { ChurchEvent, Member, Ministry } from '../data/types'

export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const evLabel = (ev: ChurchEvent) => `${weekdayShort(ev.date).toLowerCase()}, ${ddmm(ev.date)}${ev.time ? ` · ${ev.time}` : ''} · ${ev.title}`
export const whatsapp = (m: Pick<Member, 'phone'>) => (m.phone ? `https://wa.me/55${m.phone.replace(/\D/g, '')}` : '')

/** Janela no centro da tela (Esc ou clique fora fecha) */
export function Modal({ title, subtitle, onClose, children, width = 560, footer }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="pn-backdrop" onMouseDown={onClose}>
      <div className="pn-modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="pn-modal-head">
          <div className="grow">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="pn-modal-body">{children}</div>
        {footer && <div className="pn-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Menu pequeno preso a um botão (abre embaixo dele; sobe se não couber) */
export function Popover({ anchor, onClose, children }: { anchor: HTMLElement; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 0
    const w = ref.current?.offsetWidth ?? 240
    const top = r.bottom + 6 + h > window.innerHeight - 8 ? r.top - h - 6 : r.bottom + 6
    setPos({ top: Math.max(8, top), left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) })
  }, [anchor])
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const scroll = () => onClose()
    document.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', scroll)
    document.querySelector('.pn-main')?.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', scroll)
      document.querySelector('.pn-main')?.removeEventListener('scroll', scroll, true)
    }
  }, [anchor, onClose])
  return createPortal(
    <div ref={ref} className="pn-pop" style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}>{children}</div>,
    document.body,
  )
}

/**
 * Escolher quem entra numa vaga: pessoas da função, das mais indicadas às menos
 * (disponibilidade, outras escalas, limite do mês e rodízio). Em vaga de grupo, os grupos primeiro.
 */
export function CandidatePicker({ ev, ministry, role, group, exclude, onPick, onPickGroup }: {
  ev: ChurchEvent; ministry: Ministry; role: string; group?: boolean; exclude?: string
  onPick: (memberId: string) => void; onPickGroup?: (groupId: string) => void
}) {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'groups' | 'people'>(group && onPickGroup ? 'groups' : 'people')
  const ranked = useMemo(() => rankCandidates(data, ev, ministry.id, role).filter((c) => c.member.id !== exclude), [data, ev, ministry.id, role, exclude])
  // quem é do ministério mas não tem essa função (dá para escalar mesmo assim, no fim da lista)
  const others = useMemo(() => data.members
    .filter((m) => m.id !== exclude && m.ministries.some((mm) => mm.ministryId === ministry.id) && !ranked.some((c) => c.member.id === m.id))
    .map((member) => {
      const av = availabilityFor(data, member, ev)
      return { member, av, blocked: av.unavailable || !!av.conflict || av.declinedHere }
    }), [data, ev, ministry.id, ranked, exclude])
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const match = (m: Member) => !q.trim() || norm(m.name).includes(norm(q.trim()))
  const groups = group ? rankGroups(data, ev, ministry.id) : []
  const inEvent = new Set(data.assignments.filter((a) => a.eventId === ev.id && a.groupId).map((a) => a.groupId))

  const row = ({ member, av, blocked }: { member: Member; av: ReturnType<typeof availabilityFor>; blocked: boolean }, best: boolean) => {
    const other = av.conflict && data.ministries.find((m) => m.id === av.conflict!.ministryId)
    return (
      <button key={member.id} className="pn-cand" disabled={blocked} onClick={() => onPick(member.id)}>
        <Avatar name={member.name} size={34} />
        <div className="grow">
          <strong>{member.name}{best && <em className="best">sugerido</em>}</strong>
          <span className="tags">
            {av.declinedHere && <span className="tag bad">Recusou este culto</span>}
            {av.unavailable && <span className="tag bad">{av.recurring ? 'Indisponível neste horário fixo' : 'Indisponível nesse dia'}</span>}
            {av.conflict && <span className="tag bad"><AlertTriangle size={11} /> Já escalado em {other?.name} ({av.conflict.role})</span>}
            {av.sameDay && <span className="tag warn">Serve em outro culto no dia</span>}
            <span className={`tag${av.overLimit ? ' warn' : ''}`}>{av.monthCount}/{member.maxPerMonth} no mês</span>
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="pn-picker">
      {group && onPickGroup && (
        <div className="pn-seg">
          <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>Grupos</button>
          <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>Pessoa avulsa</button>
        </div>
      )}
      {tab === 'groups' ? (
        <div className="pn-cands">
          {groups.length === 0 && <p className="muted">Nenhum grupo criado. Os grupos são montados no app, na aba Grupos.</p>}
          {groups.map(({ group: g, people, free, recent, blocked }, i) => {
            const here = inEvent.has(g.id)
            return (
              <button key={g.id} className="pn-cand" disabled={blocked || here} onClick={() => onPickGroup?.(g.id)}>
                <span className="pn-group-icon"><Users size={17} /></span>
                <div className="grow">
                  <strong>{g.name}{i === 0 && !blocked && !here && <em className="best">sugerido</em>}</strong>
                  <span className="muted small">{people.map((p) => firstName(p.name)).join(', ') || 'Sem pessoas'}</span>
                  <span className="tags">
                    {here ? <span className="tag">Já está neste culto</span> : <span className={`tag${blocked ? ' bad' : ''}`}>{free.length}/{people.length} disponíveis</span>}
                    {recent > 0 && <span className="tag">{recent}× nos últimos 45 dias</span>}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <label className="pn-search">
            <Search size={16} />
            <input autoFocus placeholder="Buscar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="pn-cands">
            {ranked.length === 0 && !q && <p className="muted">Ninguém cadastrado com a função {role}.</p>}
            {ranked.filter((c) => match(c.member)).map((c, i) => row(c, i === 0 && !q && !c.blocked))}
            {others.some((c) => match(c.member)) && <p className="pn-cands-sep">Outras pessoas do {ministry.name} (sem a função {role})</p>}
            {others.filter((c) => match(c.member)).map((c) => row(c, false))}
          </div>
        </>
      )}
    </div>
  )
}

/** Barra de preenchimento: confirmadas (cheia) e aguardando (clara) */
export function Fill({ total, confirmed, pending, color }: { total: number; confirmed: number; pending: number; color?: string }) {
  const pc = total ? (confirmed / total) * 100 : 0
  const pp = total ? (pending / total) * 100 : 0
  return (
    <div className="pn-fill" title={`${confirmed} confirmadas, ${pending} aguardando, ${total - confirmed - pending} abertas`}>
      <i style={{ width: `${pc}%`, background: color ?? 'var(--ok)' }} />
      <i style={{ width: `${pp}%`, background: color ?? 'var(--ok)', opacity: 0.35 }} />
    </div>
  )
}
