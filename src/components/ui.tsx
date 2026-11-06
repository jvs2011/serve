import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Baby, BookOpen, Briefcase, ChevronLeft, Flame, Footprints, HandHelping, Heart, HeartHandshake, House,
  Link2, Megaphone, Music, Rocket, Shield, Sparkles, UserPlus, Users, X,
} from 'lucide-react'
import type { AssignmentStatus, Ministry } from '../data/types'

export function MinistryIcon({ ministry, size = 18 }: { ministry: Ministry; size?: number }) {
  const props = { size, strokeWidth: 2.2 }
  switch (ministry.icon) {
    case 'music': return <Music {...props} />
    case 'megaphone': return <Megaphone {...props} />
    case 'hand': return <HandHelping {...props} />
    case 'baby': return <Baby {...props} />
    case 'heart': return <Heart {...props} />
    case 'userplus': return <UserPlus {...props} />
    case 'footprints': return <Footprints {...props} />
    case 'flame': return <Flame {...props} />
    case 'rocket': return <Rocket {...props} />
    case 'link': return <Link2 {...props} />
    case 'sparkles': return <Sparkles {...props} />
    case 'house': return <House {...props} />
    case 'briefcase': return <Briefcase {...props} />
    case 'handheart': return <HeartHandshake {...props} />
    case 'book': return <BookOpen {...props} />
    case 'shield': return <Shield {...props} />
    default: return <Users {...props} />
  }
}

export function MinistryBadge({ ministry, size = 36 }: { ministry: Ministry; size?: number }) {
  return (
    <span className="min-badge" style={{ width: size, height: size, background: `${ministry.color}22`, color: ministry.color }}>
      <MinistryIcon ministry={ministry} size={Math.round(size * 0.5)} />
    </span>
  )
}

const AVATAR_COLORS = ['#E57A47', '#7C6CF2', '#2FA8E0', '#22B07D', '#E2558B', '#C9922E', '#5B8DEF', '#D0605E']

export function initials(name: string) {
  const p = name.split(' ').filter(Boolean)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length]
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  )
}

const STATUS_LABEL: Record<AssignmentStatus, string> = { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Recusou' }

export function StatusPill({ status, checkedIn, draft }: { status: AssignmentStatus; checkedIn?: boolean; draft?: boolean }) {
  if (draft) return <span className="pill pill-draft">Rascunho</span>
  if (checkedIn) return <span className="pill pill-checkin">Check-in ✓</span>
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>
}

export function TopBar({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          <ChevronLeft size={24} />
        </button>
      )}
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="topbar-right">{right}</div>}
    </header>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  // desenhada fora da árvore (por cima de tudo); no computador, dentro da tela do celular simulado
  const target = document.querySelector('.phone-screen') ?? document.body
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    target,
  )
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function DateBlock({ iso, dark }: { iso: string; dark?: boolean }) {
  const [, , d] = iso.split('-')
  const dt = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +d)
  const wd = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][dt.getDay()]
  return (
    <div className={`date-block${dark ? ' dark' : ''}`}>
      <span>{wd}</span>
      <strong>{dt.getDate()}</strong>
    </div>
  )
}
