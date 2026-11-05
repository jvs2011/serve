import { CalendarDays, Home as HomeIcon, Repeat, User, Users } from 'lucide-react'
import { StoreProvider, useStore } from './data/store'
import { NavProvider, useNav, type Tab } from './nav'
import { swapsICanCover, myUpcoming } from './lib/selectors'
import { Login } from './screens/Login'
import { Home } from './screens/Home'
import { Agenda } from './screens/Agenda'
import { Swaps } from './screens/Swaps'
import { Team, MinistryDetail } from './screens/Team'
import { Profile } from './screens/Profile'
import { EventDetail } from './screens/EventDetail'
import { Availability } from './screens/Availability'
import { History } from './screens/History'
import { Dashboard } from './screens/Dashboard'
import { People, PersonForm } from './screens/People'
import { Logo } from './components/Logo'

export default function App() {
  return (
    <StoreProvider>
      <div className="desktop-aside" aria-hidden="true">
        <Logo size={40} />
        <p>O Serve foi feito para o celular.<br />Abra este endereço no seu telefone e adicione à tela inicial.</p>
      </div>
      <div className="app">
        <Shell />
      </div>
    </StoreProvider>
  )
}

function Shell() {
  const { me, toast, mode, loading, loadError, reload, actions } = useStore()
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
  } else body = me ? <NavProvider><Main /></NavProvider> : <Login />
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
      case 'ministry': screen = <MinistryDetail key={top.id} id={top.id} />; break
      case 'availability': screen = <Availability />; break
      case 'history': screen = <History />; break
      case 'dashboard': screen = <Dashboard />; break
      case 'people': screen = <People />; break
      case 'person': screen = <PersonForm key={top.id ?? 'new'} id={top.id} />; break
    }
  } else {
    screen = { home: <Home />, agenda: <Agenda />, swaps: <Swaps />, team: <Team />, profile: <Profile /> }[tab]
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
  const items: { id: Tab; label: string; icon: JSX.Element; badge?: number }[] = [
    { id: 'home', label: 'Início', icon: <HomeIcon size={22} />, badge: pending },
    { id: 'agenda', label: 'Escalas', icon: <CalendarDays size={22} /> },
    { id: 'swaps', label: 'Trocas', icon: <Repeat size={22} />, badge: swaps },
    { id: 'team', label: 'Ministérios', icon: <Users size={22} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={22} /> },
  ]
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <button key={it.id} className={tab === it.id && !stack.length ? 'on' : ''} onClick={() => setTab(it.id)}>
          <span className="tab-icon">{it.icon}{!!it.badge && <i className="badge">{it.badge}</i>}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
