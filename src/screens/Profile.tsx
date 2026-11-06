import { useState } from 'react'
import { BarChart3, CalendarOff, ChevronRight, History, LogOut, Minus, Plus, RotateCcw, Smartphone, Users } from 'lucide-react'
import { formatPhone } from '../lib/people'
import { NotificationSettings } from '../components/Notifications'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { levelFor, pointsFor } from '../lib/schedule'
import { managedMinistries, myPast } from '../lib/selectors'
import { todayISO } from '../lib/dates'
import { Avatar, MinistryBadge, Sheet, TopBar } from '../components/ui'

const ACCESS_LABEL = { admin: 'Coordenação geral', leader: 'Líder de ministério', volunteer: 'Voluntário' }

export function Profile() {
  const { data, actions, notify, mode } = useStore()
  const me = useMe()
  const { push } = useNav()
  const [installOpen, setInstallOpen] = useState(false)
  const pts = pointsFor(data, me.id)
  const level = levelFor(pts)
  const pct = level.next > level.base ? Math.min(100, ((pts - level.base) / (level.next - level.base)) * 100) : 100
  const served = myPast(data, me.id).filter((x) => x.a.checkedIn).length
  const unavailable = (data.unavailability[me.id] ?? []).filter((d) => d >= todayISO()).length
  const isLeader = managedMinistries(data, me).length > 0

  return (
    <div className="screen">
      <TopBar title="Perfil" />
      <div className="profile-head">
        <Avatar name={me.name} size={72} />
        <h2>{me.name}</h2>
        <span className="muted">{ACCESS_LABEL[me.access]}{me.phone && ` · ${formatPhone(me.phone)}`}{mode === 'demo' && ' · demonstração'}</span>
        <div className="chips center">
          {me.ministries.map((mm) => {
            const m = data.ministries.find((x) => x.id === mm.ministryId)
            return m ? <span key={m.id} className="chip static"><MinistryBadge ministry={m} size={20} /> {m.name}</span> : null
          })}
        </div>
      </div>

      <div className="level-card">
        <div className="level-top">
          <div>
            <span className="kicker light">Seu nível</span>
            <h3>{level.name}</h3>
          </div>
          <div className="level-pts"><b>{pts}</b><span>pontos</span></div>
        </div>
        <div className="progress light"><div style={{ width: `${pct}%` }} /></div>
        <div className="level-foot">
          <span>{served} cultos servidos</span>
          <span>{level.next > pts ? `${level.next - pts} pts para o próximo nível` : 'Nível máximo 🌳'}</span>
        </div>
      </div>

      <div className="card menu">
        <button className="menu-item" onClick={() => push({ name: 'availability' })}>
          <CalendarOff size={20} /><span className="grow">Minha disponibilidade</span>
          {unavailable > 0 && <span className="pill pill-pending">{unavailable} {unavailable === 1 ? 'dia' : 'dias'}</span>}
          <ChevronRight size={18} className="muted" />
        </button>
        <button className="menu-item" onClick={() => push({ name: 'history' })}>
          <History size={20} /><span className="grow">Histórico de serviço</span><ChevronRight size={18} className="muted" />
        </button>
        {me.access === 'admin' && (
          <button className="menu-item" onClick={() => push({ name: 'people' })}>
            <Users size={20} /><span className="grow">Pessoas</span>
            <span className="muted small">{data.members.length}</span>
            <ChevronRight size={18} className="muted" />
          </button>
        )}
        {isLeader && (
          <button className="menu-item" onClick={() => push({ name: 'dashboard' })}>
            <BarChart3 size={20} /><span className="grow">Painel do líder</span><ChevronRight size={18} className="muted" />
          </button>
        )}
        <div className="menu-item">
          <div className="grow">
            <span>Quero servir até</span>
            <span className="muted small block">A escala automática respeita esse limite</span>
          </div>
          <div className="stepper">
            <button aria-label="Menos" onClick={() => actions.setMaxPerMonth(Math.max(1, me.maxPerMonth - 1))}><Minus size={16} /></button>
            <b>{me.maxPerMonth}x</b>
            <button aria-label="Mais" onClick={() => actions.setMaxPerMonth(Math.min(12, me.maxPerMonth + 1))}><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {me.access === 'admin' && mode === 'live' && <AccessToggle />}

      <h3 className="form-title">Notificações</h3>
      <div className="card push-card">
        <NotificationSettings />
      </div>

      <div className="card menu">
        <button className="menu-item" onClick={() => setInstallOpen(true)}>
          <Smartphone size={20} /><span className="grow">Instalar na tela inicial</span><ChevronRight size={18} className="muted" />
        </button>
        {mode === 'demo' && (
          <button className="menu-item" onClick={() => { actions.resetDemo(); notify('Dados de demonstração restaurados') }}>
            <RotateCcw size={20} /><span className="grow">Restaurar dados de demonstração</span>
          </button>
        )}
        <button className="menu-item danger" onClick={actions.logout}>
          <LogOut size={20} /><span className="grow">{mode === 'demo' ? 'Sair da demonstração' : 'Sair'}</span>
        </button>
      </div>

      <p className="footer-note">Serve · Lagoinha Franca</p>

      <Sheet open={installOpen} onClose={() => setInstallOpen(false)} title="Instalar o Serve">
        <p><b>iPhone (Safari):</b> toque em Compartilhar <span className="kbd">⬆︎</span> e depois em <b>Adicionar à Tela de Início</b>.</p>
        <p><b>Android (Chrome):</b> toque no menu <span className="kbd">⋮</span> e depois em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>
        <p className="muted small">O Serve abre em tela cheia, como um aplicativo.</p>
      </Sheet>
    </div>
  )
}

/** Liberar o app para todos (enquanto desligado, só administradores entram) */
function AccessToggle() {
  const { data, actions, notify } = useStore()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const open = data.settings?.open === true
  const people = data.members.filter((m) => m.access !== 'admin').length
  const apply = async (value: boolean) => {
    setBusy(true)
    const r = await actions.setOpen(value)
    setBusy(false)
    setConfirm(false)
    notify(r.ok ? (value ? 'App liberado para todos 🎉' : 'Acesso restrito aos administradores') : r.error)
  }
  return (
    <>
      <h3 className="form-title">Acesso ao app</h3>
      <div className="card push-card access-card">
        <label className="switch-row">
          <span>{open ? 'Liberado para todos' : 'Só administradores'}</span>
          <input type="checkbox" checked={open} disabled={busy} onChange={(e) => (e.target.checked ? setConfirm(true) : apply(false))} />
        </label>
        <p className="muted small">
          {open
            ? 'Todas as pessoas cadastradas podem entrar com o celular e as iniciais.'
            : people === 0
              ? 'Fase de cadastros: só administradores entram no app. O formulário de cadastro continua funcionando.'
              : `Fase de cadastros: ${people === 1 ? 'a pessoa cadastrada ainda não entra no app e vê' : `as ${people} pessoas cadastradas ainda não entram no app e veem`} a mensagem “em breve teremos novidades”. O formulário de cadastro continua funcionando.`}
        </p>
        {confirm && (
          <div className="confirm-box access-confirm">
            <p>{people === 1 ? 'Liberar o Serve para a pessoa cadastrada?' : `Liberar o Serve para todas as ${people} pessoas cadastradas?`}</p>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => apply(true)}>Liberar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
