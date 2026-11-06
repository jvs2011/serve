import { CalendarDays, Home as HomeIcon, Repeat, User, Users } from 'lucide-react'
import { StoreProvider, useStore } from './data/store'
import { NavProvider, useNav, type Tab } from './nav'
import { ledMinistries, swapsICanCover, myUpcoming } from './lib/selectors'
import { MinistryIcon } from './components/ui'
import { Login } from './screens/Login'
import { Home } from './screens/Home'
import { Agenda } from './screens/Agenda'
import { Swaps } from './screens/Swaps'
import { Team, MinistryDetail, LeaderMinistryTab } from './screens/Team'
import { Profile } from './screens/Profile'
import { EventDetail } from './screens/EventDetail'
import { Availability } from './screens/Availability'
import { History } from './screens/History'
import { Dashboard } from './screens/Dashboard'
import { People, PersonForm } from './screens/People'
import { CreatePinGate } from './screens/PinScreens'
import { Logo } from './components/Logo'

export default function App() {
  return (
    <StoreProvider>
      <div className="app">
        <Shell />
      </div>
    </StoreProvider>
  )
}

function Shell() {
  const { me, toast, mode, loading, loadError, reload, actions, needsPin } = useStore()
  let body
  if (mode === 'live' && loading) {
    body = (
      <div className="loading-screen">
        <Logo size={36} />
        {loadError ? (
          <>
            <p className="muted">{loadError}</p>
            <button className="btn btn-primary" onClick={reload}>Tentar de novo</button>
            <button className="link" onClick={actions.logout}>Sair</button>
          </>
        ) : <div className="spinner" aria-label="Carregando" />}
      </div>
    )
  } else if (me && needsPin) body = <CreatePinGate />
  else body = me ? <NavProvider scope={`${mode}:${me.id}`}><Main /></NavProvider> : <Login />
  return (
    <>
      {body}
      {toast && <div key={toast.id} className="toast" role="status">{toast.text}</div>}
    </>
  )
}

function Main() {
  const { tab, stack } = useNav()
  const top = stack[stack.length - 1]
  let screen
  if (top) {
    switch (top.name) {
      case 'event': screen = <EventDetail key={top.id} id={top.id} />; break
      case 'ministry': screen = <MinistryDetail key={top.id} id={top.id} initialTab={top.tab} />; break
      case 'availability': screen = <Availability />; break
      case 'history': screen = <History />; break
      case 'dashboard': screen = <Dashboard />; break
      case 'people': screen = <People />; break
      case 'person': screen = <PersonForm key={top.id ?? 'new'} id={top.id} />; break
    }
  } else {
    screen = { home: <Home />, agenda: <Agenda />, swaps: <Swaps />, team: <LeaderOrTeam />, profile: <Profile /> }[tab]
  }
  return (
    <>
      <main className="content">{screen}</main>
      <TabBar />
    </>
  )
}

function TabBar() {
  const { tab, setTab, stack } = useNav()
  const { data, me } = useStore()
  const swaps = me ? swapsICanCover(data, me).length : 0
  const pending = me ? myUpcoming(data, me.id).filter((x) => x.a.status === 'pending').length : 0
  const led = me ? ledMinistries(data, me) : []
  const items: { id: Tab; label: string; icon: JSX.Element; badge?: number }[] = [
    { id: 'home', label: 'Início', icon: <HomeIcon size={22} />, badge: pending },
    { id: 'agenda', label: led.length ? 'Escala pessoal' : 'Escalas', icon: <CalendarDays size={22} /> },
    { id: 'swaps', label: 'Trocas', icon: <Repeat size={22} />, badge: swaps },
    led.length
      ? { id: 'team', label: led.length === 1 ? led[0].name : 'Meus ministérios', icon: led.length === 1 ? <MinistryIcon ministry={led[0]} size={22} /> : <Users size={22} /> }
      : { id: 'team', label: 'Ministérios', icon: <Users size={22} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={22} /> },
  ]
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <button key={it.id} className={tab === it.id && !stack.length ? 'on' : ''} onClick={() => setTab(it.id)}
          style={it.label.length >= 13 ? { flexGrow: 1.4 } : undefined}>
          <span className="tab-icon">{it.icon}{!!it.badge && <i className="badge">{it.badge}</i>}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}

/** Aba de ministérios: o líder vai direto para o(s) ministério(s) dele */
function LeaderOrTeam() {
  const { data, me } = useStore()
  return me && ledMinistries(data, me).length ? <LeaderMinistryTab /> : <Team />
}
