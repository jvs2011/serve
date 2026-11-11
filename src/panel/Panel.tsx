import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarClock, CalendarDays, CalendarRange, CalendarSync, ChevronDown, LayoutDashboard, LogOut, Megaphone, MonitorSmartphone, Music2, Palette, Settings, Smartphone, UserCog, Users, UsersRound } from 'lucide-react'
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
import { EventsView } from './EventsView'
import { SetlistView } from './SetlistView'
import { GroupsView } from './GroupsView'
import { PeopleView } from './PeopleView'
import { CalendarView, ChurchView, SettingsView, WeeklyView } from './Coordination'
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

export type Section = 'overview' | 'schedule' | 'events' | 'setlist' | 'groups' | 'team' | 'requests' | 'notices'
  | 'church' | 'calendar' | 'weekly' | 'people' | 'settings'
const HASH: Record<Section, string> = {
  overview: '', schedule: 'escalas', events: 'eventos', setlist: 'repertorio', groups: 'grupos', team: 'equipe', requests: 'pedidos', notices: 'avisos',
  church: 'igreja', calendar: 'agenda', weekly: 'cultos-da-semana', people: 'pessoas', settings: 'configuracoes',
}
/** Seções só da coordenação */
const COORD: Section[] = ['church', 'calendar', 'weekly', 'people', 'settings']
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
        <div className="pn-login-wrap">
          <section className="pn-login-brand">
            <div className="pn-brand"><Logo size={34} light /><span className="pn-tag">Painel</span></div>
            <h1>Painel do <em>líder.</em></h1>
            <p className="pn-login-lead">Escalas, eventos, equipe e pedidos do seu ministério numa tela grande. Para líderes e coordenação da Lagoinha Franca.</p>
            <ul className="pn-login-features">
              <li><span><CalendarRange size={20} /></span><div><strong>Escalas em grade</strong><small>Cultos e funções numa tela só, com escala automática e rascunho</small></div></li>
              <li><span><LayoutDashboard size={20} /></span><div><strong>O que precisa da sua atenção</strong><small>Vagas abertas, trocas, quem não confirmou e material atrasado</small></div></li>
              <li><span><Users size={20} /></span><div><strong>Equipe e eventos</strong><small>Funções, grupos, repertório e gravações</small></div></li>
              <li><span><Building2 size={20} /></span><div><strong>Coordenação</strong><small>Agenda da igreja, cultos da semana e cadastro de pessoas</small></div></li>
            </ul>
            <p className="pn-login-foot">Voluntário? Use o app no celular: <a href="/">serve.lagoinhafranca.com</a></p>
          </section>
          <section className="pn-login-card">
            <h2>Entrar</h2>
            <p className="pn-login-sub">Com o mesmo celular e PIN do app.</p>
            <Login bare profiles={PANEL_DEMO} />
          </section>
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
  const admin = me.access === 'admin'
  const hasGroups = ministry.roles.some((r) => r.group)
  const louvor = ministry.id === 'louvor'
  // seção que não existe para este ministério (ou para quem não é da coordenação) volta para a visão geral
  const current: Section = (section === 'requests' && !arts) || (section === 'groups' && !hasGroups) || (section === 'setlist' && !louvor) || (COORD.includes(section) && !admin) ? 'overview' : section

  const today = todayISO()
  const attention = useMemo(() => attentionFor(data, ministry.id, today), [data, ministry.id, today])
  const drafts = draftsOf(data, ministry.id).length
  const late = (data.tasks ?? []).filter((t) => t.ministryId === ministry.id && t.status === 'open' && t.dueDate < today).length

  const setlistsDue = louvor ? attention.filter((x) => x.kind === 'setlist').length : 0
  type Item = { id: Section; label: string; icon: JSX.Element; badge?: number }
  const items: Item[] = [
    { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={20} />, badge: attention.length },
    { id: 'schedule', label: 'Escalas', icon: <CalendarRange size={20} />, badge: drafts },
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20} /> },
    ...(louvor ? [{ id: 'setlist' as Section, label: 'Repertório', icon: <Music2 size={20} />, badge: setlistsDue }] : []),
    ...(hasGroups ? [{ id: 'groups' as Section, label: 'Grupos', icon: <UsersRound size={20} /> }] : []),
    { id: 'team', label: 'Equipe', icon: <Users size={20} /> },
    ...(arts ? [{ id: 'requests' as Section, label: 'Pedidos', icon: <Palette size={20} />, badge: late }] : []),
    { id: 'notices', label: 'Avisos', icon: <Megaphone size={20} /> },
  ]
  const coord: Item[] = admin ? [
    { id: 'church', label: 'Visão da igreja', icon: <Building2 size={20} /> },
    { id: 'calendar', label: 'Agenda da igreja', icon: <CalendarClock size={20} /> },
    { id: 'weekly', label: 'Cultos da semana', icon: <CalendarSync size={20} /> },
    { id: 'people', label: 'Pessoas', icon: <UserCog size={20} /> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
  ] : []
  const navButton = (it: Item) => (
    <button key={it.id} className={current === it.id ? 'on' : ''} onClick={() => go(it.id)} title={it.label}>
      {it.icon}
      <span className="pn-nav-label">{it.label}</span>
      {!!it.badge && <i className="pn-badge">{it.badge}</i>}
    </button>
  )

  return (
    <div className="pn">
      <aside className="pn-side">
        <div className="pn-brand"><Logo size={26} /><span className="pn-tag">Painel</span></div>
        <nav className="pn-nav">
          <span className="pn-nav-group pn-nav-label">Ministério</span>
          <MinistryPicker ministries={managed} current={ministry} onPick={pick} />
          {items.map(navButton)}
          {coord.length > 0 && <span className="pn-nav-group pn-nav-label">Coordenação</span>}
          {coord.length > 0 && <span className="pn-nav-sep" aria-hidden="true" />}
          {coord.map(navButton)}
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
        {current === 'schedule' && <ScheduleGrid key={`${ministry.id}-${focusEvent}`} ministry={ministry} focusEvent={focusEvent} />}
        {current === 'events' && <EventsView key={ministry.id} ministry={ministry} go={go} />}
        {current === 'setlist' && <SetlistView ministry={ministry} />}
        {current === 'groups' && <GroupsView ministry={ministry} />}
        {current === 'team' && <TeamView key={ministry.id} ministry={ministry} />}
        {current === 'requests' && <Requests ministry={ministry} />}
        {current === 'notices' && <Notices ministry={ministry} />}
        {current === 'church' && <ChurchView go={go} pick={pick} />}
        {current === 'calendar' && <CalendarView go={go} pick={pick} />}
        {current === 'weekly' && <WeeklyView />}
        {current === 'people' && <PeopleView />}
        {current === 'settings' && <SettingsView />}
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
