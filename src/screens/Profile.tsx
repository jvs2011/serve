import { useState } from 'react'
import { BarChart3, CalendarOff, ChevronRight, History, LogOut, Minus, Plus, RotateCcw, Smartphone } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { levelFor, pointsFor } from '../lib/schedule'
import { managedMinistries, myPast } from '../lib/selectors'
import { todayISO } from '../lib/dates'
import { Avatar, MinistryBadge, Sheet, TopBar } from '../components/ui'

const ACCESS_LABEL = { admin: 'Coordenação geral', leader: 'Líder de ministério', volunteer: 'Voluntário' }

export function Profile() {
  const { data, actions, notify } = useStore()
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
        <span className="muted">{ACCESS_LABEL[me.access]} · {me.phone}</span>
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

      <div className="card menu">
        <button className="menu-item" onClick={() => setInstallOpen(true)}>
          <Smartphone size={20} /><span className="grow">Instalar na tela inicial</span><ChevronRight size={18} className="muted" />
        </button>
        <button className="menu-item" onClick={() => { actions.resetDemo(); notify('Dados de demonstração restaurados') }}>
          <RotateCcw size={20} /><span className="grow">Restaurar dados de demonstração</span>
        </button>
        <button className="menu-item danger" onClick={actions.logout}>
          <LogOut size={20} /><span className="grow">Sair</span>
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
