import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, LayoutDashboard, LogOut, Megaphone, MonitorSmartphone, Palette, Smartphone, Users } from 'lucide-react'
import { StoreProvider, useMe, useStore } from '../data/store'
import { managedMinistries } from '../lib/selectors'
import { todayISO } from '../lib/dates'
import { draftsOf } from '../lib/schedule'
import { attentionFor } from '../lib/panel'
import { Logo } from '../components/Logo'
import { Avatar, MinistryBadge } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { Login } from '../screens/Login'
import { CreatePinGate } from '../screens/PinScreens'
import { ARTS_MINISTRIES } from '../screens/Arts'
import { Popover } from './common'
import { Overview } from './Overview'
import { ScheduleGrid } from './ScheduleGrid'
import { TeamView } from './TeamView'
import { Requests } from './Requests'
import { Notices } from './Notices'
import type { Ministry } from '../data/types'
import './panel.css'

/** Perfis da demonstração que fazem sentido no painel (só quem lidera) */
const PANEL_DEMO = [
  { id: 'm-rafaela', label: 'Líder do Follow', hint: 'escalas, pedidos, material e equipe do Follow' },
  { id: 'm-mariana', label: 'Líder do Louvor', hint: 'escalas com grupos de voz' },
  { id: 'm-lucas', label: 'Coordenação', hint: 'todos os ministérios' },
]

/** Telas menores que isso usam o app do celular */
const MIN_WIDTH = 760

export type Section = 'overview' | 'schedule' | 'team' | 'requests' | 'notices'
const HASH: Record<Section, string> = { overview: '', schedule: 'escalas', team: 'equipe', requests: 'pedidos', notices: 'avisos' }
const fromHash = (): Section => (Object.entries(HASH).find(([, h]) => h && `#${h}` === location.hash)?.[0] as Section) ?? 'overview'

/** serve.lagoinhafranca.com/painel: painel para líderes e coordenação, no computador ou tablet */
export default function Panel() {
  useEffect(() => {
    document.title = 'Painel · Serve'
    document.body.classList.add('panel-mode')
    return () => document.body.classList.remove('panel-mode')
  }, [])
  return (
    <StoreProvider>
      <PanelShell />
    </StoreProvider>
  )
}

function useWide() {
  const [wide, setWide] = useState(() => window.innerWidth >= MIN_WIDTH)
  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= MIN_WIDTH)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return wide
}

function PanelShell() {
  const { me, data, toast, mode, loading, loadError, reload, actions, needsPin } = useStore()
  const wide = useWide()
  let body
  if (!wide) {
    body = (
      <div className="pn-gate">
        <div className="pn-gate-card">
          <Logo size={32} />
          <MonitorSmartphone size={40} className="accent" />
          <h1>O painel é para computador ou tablet</h1>
          <p>No celular, use o app: as escalas, a equipe e os pedidos também estão lá.</p>
          <a className="btn btn-primary" href="/">Abrir o app</a>
        </div>
      </div>
    )
  } else if (mode === 'live' && loading) {
    body = (
      <div className="pn-gate">
        <div className="pn-gate-card">
          <Logo size={32} />
          {loadError ? (
            <>
              <p className="muted">{loadError}</p>
              <button className="btn btn-primary" onClick={reload}>Tentar de novo</button>
              <button className="link" onClick={actions.logout}>Sair</button>
            </>
          ) : <div className="spinner" aria-label="Carregando" />}
        </div>
      </div>
    )
  } else if (!me) {
    body = (
      <div className="pn-login">
        <div className="pn-login-box">
          <Login title={<>Painel do <em>líder.</em></>} text="Escalas, equipe e pedidos do seu ministério numa tela grande." profiles={PANEL_DEMO} />
        </div>
      </div>
    )
  } else if (needsPin) {
    body = <div className="pn-login"><div className="pn-login-box pn-pin"><CreatePinGate /></div></div>
  } else if (!managedMinistries(data, me).length) {
    body = (
      <div className="pn-gate">
        <div className="pn-gate-card">
          <Logo size={32} />
          <h1>O painel é para líderes e coordenação</h1>
          <p>{me.name.split(' ')[0]}, suas escalas, trocas e avisos estão no app do celular.</p>
          <a className="btn btn-primary" href="/"><Smartphone size={18} /> Abrir o app</a>
          <button className="link" onClick={actions.logout}>Entrar com outro número</button>
        </div>
      </div>
    )
  } else body = <PanelApp />
  return (
    <>
      {body}
      {toast && <div key={toast.id} className="toast pn-toast" role="status">{toast.text}</div>}
    </>
  )
}

const MINISTRY_KEY = 'serve:panel:ministry'

function PanelApp() {
  const { data, mode, actions } = useStore()
  const me = useMe()
  const managed = managedMinistries(data, me)
  // ministério escolhido: o último usado; senão o primeiro que a pessoa lidera
  const [ministryId, setMinistryId] = useState(() => {
    let saved = ''
    try { saved = localStorage.getItem(MINISTRY_KEY) ?? '' } catch { /* ignore */ }
    return managed.find((m) => m.id === saved)?.id ?? (managed.find((m) => m.leaderIds.includes(me.id)) ?? managed[0]).id
  })
  const ministry = managed.find((m) => m.id === ministryId) ?? managed[0]
  const pick = (id: string) => {
    setMinistryId(id)
    try { localStorage.setItem(MINISTRY_KEY, id) } catch { /* ignore */ }
  }
  const [section, setSectionState] = useState<Section>(fromHash)
  const [focusEvent, setFocusEvent] = useState<string | null>(null)
  useEffect(() => {
    const fn = () => setSectionState(fromHash())
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  const go = (s: Section, eventId?: string) => {
    setFocusEvent(eventId ?? null)
    setSectionState(s)
    history.replaceState(null, '', HASH[s] ? `#${HASH[s]}` : location.pathname)
    document.querySelector('.pn-main')?.scrollTo({ top: 0 })
  }
  const arts = ARTS_MINISTRIES.includes(ministry.id)
  const current = section === 'requests' && !arts ? 'overview' : section

  const today = todayISO()
  const attention = useMemo(() => attentionFor(data, ministry.id, today), [data, ministry.id, today])
  const drafts = draftsOf(data, ministry.id).length
  const late = (data.tasks ?? []).filter((t) => t.ministryId === ministry.id && t.status === 'open' && t.dueDate < today).length

  const items: { id: Section; label: string; icon: JSX.Element; badge?: number }[] = [
    { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={20} />, badge: attention.length },
    { id: 'schedule', label: 'Escalas', icon: <CalendarRange size={20} />, badge: drafts },
    { id: 'team', label: 'Equipe', icon: <Users size={20} /> },
    ...(arts ? [{ id: 'requests' as Section, label: 'Pedidos', icon: <Palette size={20} />, badge: late }] : []),
    { id: 'notices', label: 'Avisos', icon: <Megaphone size={20} /> },
  ]

  return (
    <div className="pn">
      <aside className="pn-side">
        <div className="pn-brand"><Logo size={26} /><span className="pn-tag">Painel</span></div>
        <MinistryPicker ministries={managed} current={ministry} onPick={pick} />
        <nav className="pn-nav">
          {items.map((it) => (
            <button key={it.id} className={current === it.id ? 'on' : ''} onClick={() => go(it.id)} title={it.label}>
              {it.icon}
              <span className="pn-nav-label">{it.label}</span>
              {!!it.badge && <i className="pn-badge">{it.badge}</i>}
            </button>
          ))}
        </nav>
        <div className="pn-side-foot">
          <div className="pn-me">
            <Avatar name={me.name} size={34} />
            <div className="grow pn-nav-label">
              <strong>{me.name}</strong>
              <span>{me.access === 'admin' ? 'Coordenação' : `Líder · ${managed.map((m) => m.name).join(', ')}`}</span>
            </div>
          </div>
          <div className="pn-foot-actions">
            <ThemeToggle />
            <a className="icon-btn" href="/" title="Abrir o app do celular" aria-label="Abrir o app do celular"><Smartphone size={19} /></a>
            <button className="icon-btn" onClick={actions.logout} title="Sair" aria-label="Sair"><LogOut size={19} /></button>
          </div>
        </div>
      </aside>
      <main className="pn-main">
        {mode === 'demo' && <div className="pn-demo">Demonstração: os dados são de exemplo e as alterações são desfeitas 10 minutos depois.</div>}
        {current === 'overview' && <Overview ministry={ministry} managed={managed} attention={attention} go={go} pick={pick} />}
        {current === 'schedule' && <ScheduleGrid key={ministry.id} ministry={ministry} focusEvent={focusEvent} />}
        {current === 'team' && <TeamView key={ministry.id} ministry={ministry} />}
        {current === 'requests' && <Requests ministry={ministry} />}
        {current === 'notices' && <Notices ministry={ministry} />}
      </main>
    </div>
  )
}

function MinistryPicker({ ministries, current, onPick }: { ministries: Ministry[]; current: Ministry; onPick: (id: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (ministries.length === 1) {
    return <div className="pn-min static"><MinistryBadge ministry={current} size={30} /><strong className="pn-nav-label">{current.name}</strong></div>
  }
  return (
    <>
      <button className="pn-min" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)} aria-haspopup="menu" title="Trocar de ministério">
        <MinistryBadge ministry={current} size={30} />
        <strong className="grow pn-nav-label">{current.name}</strong>
        <ChevronDown size={16} className="muted pn-nav-label" />
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="pn-menu pn-min-menu" role="menu">
            {ministries.map((m) => (
              <button key={m.id} role="menuitem" className={m.id === current.id ? 'on' : ''} onClick={() => { onPick(m.id); setAnchor(null) }}>
                <MinistryBadge ministry={m} size={24} /> {m.name}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  )
}
