import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react'
import { useStore } from '../data/store'
import { disablePush, enablePush, pushState, testPush, type PushState } from '../lib/push'

const DISMISS_KEY = 'serve:push-dismissed'
const DISMISS_DAYS = 7

function usePush() {
  const { mode, token, notify } = useStore()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => { pushState().then(setState).catch(() => setState('unsupported')) }, [])
  useEffect(() => { refresh() }, [refresh])

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    try {
      await fn()
      if (done) notify(done)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setBusy(false)
      refresh()
    }
  }
  return {
    mode, state, busy,
    enable: () => token && run(() => enablePush(token), 'Notificações ativadas 🔔'),
    disable: () => run(() => disablePush(token), 'Notificações desativadas neste aparelho'),
    test: () => token && run(() => testPush(token), 'Notificação de teste enviada'),
  }
}

const HELP: Record<Exclude<PushState, 'on' | 'off'>, string> = {
  'ios-install': 'No iPhone, as notificações só funcionam com o Serve instalado: toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra pelo ícone e ative aqui.',
  denied: 'As notificações estão bloqueadas para este site. Libere nas configurações do celular (notificações do navegador ou do app Serve) e volte aqui.',
  unsupported: 'Este navegador não recebe notificações. No Android use o Chrome; no iPhone, instale o Serve na tela inicial pelo Safari.',
  'no-sw': 'As notificações ficam disponíveis no app publicado (serve.lagoinhafranca.com).',
}

/** Seção completa (Perfil) */
export function NotificationSettings() {
  const { mode, state, busy, enable, disable, test } = usePush()
  if (mode !== 'live') {
    return <p className="muted small">As notificações funcionam quando você entra com o seu celular (fora da demonstração).</p>
  }
  if (!state) return <p className="muted small">Verificando…</p>
  if (state === 'on') {
    return (
      <div className="push-box">
        <p className="push-status on"><BellRing size={18} /> Ativas neste aparelho</p>
        <p className="muted small">Você recebe aviso de nova escala, pedidos de troca, avisos do ministério e um lembrete às 18h da véspera.</p>
        <div className="btn-row">
          <button className="btn btn-soft" disabled={busy} onClick={test}>Enviar teste</button>
          <button className="btn btn-ghost" disabled={busy} onClick={disable}><BellOff size={16} /> Desativar</button>
        </div>
      </div>
    )
  }
  if (state === 'off') {
    return (
      <div className="push-box">
        <p className="muted small">Receba um aviso quando for escalado, quando alguém pedir troca e um lembrete na véspera.</p>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={enable}><Bell size={18} /> Ativar notificações</button>
      </div>
    )
  }
  return (
    <div className="push-box">
      <p className="push-status">{state === 'ios-install' ? <Smartphone size={18} /> : <BellOff size={18} />} {state === 'denied' ? 'Bloqueadas' : 'Indisponíveis aqui'}</p>
      <p className="muted small">{HELP[state]}</p>
    </div>
  )
}

/** Convite na tela inicial (some depois de ativar ou de “Agora não” por 7 dias) */
export function NotificationsPrompt() {
  const { mode, state, busy, enable } = usePush()
  const [dismissed, setDismissed] = useState(() => {
    try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_DAYS * 86_400_000 } catch { return false }
  })
  if (mode !== 'live' || dismissed || (state !== 'off' && state !== 'ios-install')) return null
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setDismissed(true)
  }
  return (
    <div className="card push-prompt">
      <div className="push-prompt-icon"><Bell size={20} /></div>
      <div className="grow">
        <strong>Saiba na hora quando for escalado</strong>
        <p className="muted small">{state === 'ios-install' ? HELP['ios-install'] : 'Ative as notificações neste celular.'}</p>
        <div className="push-prompt-actions">
          {state === 'off' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={enable}>Ativar</button>}
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>Agora não</button>
        </div>
      </div>
    </div>
  )
}

/** Passo do guia de primeiro acesso */
export function NotificationsStep() {
  const { mode, state, busy, enable } = usePush()
  if (mode !== 'live') return <p className="muted small">Na demonstração as notificações ficam desligadas.</p>
  if (state === 'on') return <p className="push-status on"><BellRing size={18} /> Notificações ativas neste aparelho</p>
  if (state === 'off') return <button className="btn btn-primary btn-block" disabled={busy} onClick={enable}><Bell size={18} /> Ativar notificações</button>
  if (!state) return null
  return <p className="muted small">{HELP[state]}</p>
}
