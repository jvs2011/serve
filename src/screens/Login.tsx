import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, PartyPopper } from 'lucide-react'
import { ApiError, useStore } from '../data/store'
import { createSeed, demoProfiles } from '../data/seed'
import { Avatar } from '../components/ui'
import { Logo } from '../components/Logo'
import { PinInput } from '../components/PinInput'
import { isValidPhone, nextPhoneValue } from '../lib/people'

const demoMembers = createSeed().members

export function Login() {
  const { actions } = useStore()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [showDemo, setShowDemo] = useState<boolean | null>(null)
  const [phone, setPhone] = useState('')
  // celular → (já tem PIN) digita o PIN | (primeiro acesso) cria o PIN → repete o PIN
  const [step, setStep] = useState<'phone' | 'pin' | 'create' | 'confirm'>('phone')
  const [setupId, setSetupId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [closedFor, setClosedFor] = useState<string | null>(null) // cadastrado, mas o app ainda não foi liberado

  useEffect(() => {
    fetch('/api/status')
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((r: { configured?: boolean; demo?: boolean }) => { setAvailable(!!r.configured); setShowDemo(!r.configured || r.demo !== false) })
      .catch(() => { setAvailable(false); setShowDemo(true) })
  }, [])

  const restart = (msg = '') => { setStep('phone'); setSetupId(null); setPin(''); setNewPin(''); setError(msg) }
  const handle = (e: unknown) => {
    if (e instanceof ApiError && e.data.closed) { restart(); setClosedFor(String(e.data.firstName ?? '')); return }
    return e instanceof Error ? e.message : 'Não foi possível continuar.'
  }

  const start = async () => {
    if (!isValidPhone(phone)) return setError('Digite o celular com DDD, por exemplo (16) 99999-1234.')
    setBusy(true)
    setError('')
    try {
      const r = await actions.requestLogin(phone)
      if (r.mode === 'pin') setStep('pin')
      else { setSetupId(r.setupId); setStep('create') }
    } catch (e) {
      setError(handle(e) ?? '')
    } finally {
      setBusy(false)
    }
  }

  const enter = async (value: string) => {
    setBusy(true)
    setError('')
    try {
      await actions.pinLogin(phone, value)
    } catch (e) {
      setPin('')
      const msg = handle(e)
      if (msg !== undefined) setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const confirmCreate = async (value: string) => {
    if (!setupId) return
    if (value !== newPin) { setPin(''); setNewPin(''); setStep('create'); setError('Os PINs não são iguais. Crie de novo.'); return }
    setBusy(true)
    setError('')
    try {
      await actions.pinCreate(setupId, value)
    } catch (e) {
      const msg = handle(e)
      if (msg !== undefined) { setPin(''); setNewPin(''); setStep('create'); setError(msg) }
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <button className="icon-btn" onClick={() => restart()} aria-label="Trocar número"><ArrowLeft size={20} /></button>
  )

  return (
    <div className="login">
      <div className="login-hero">
        <Logo size={44} light />
        <h1>Servir é um <em>privilégio.</em></h1>
        <p>Escalas dos ministérios da Lagoinha Franca, na palma da mão.</p>
      </div>

      <div className="login-card">
        {closedFor !== null ? (
          <div className="closed-box">
            <span className="closed-icon"><PartyPopper size={26} /></span>
            <h2>{closedFor ? `Quase lá, ${closedFor}!` : 'Quase lá!'}</h2>
            <p>Seu cadastro já está feito 🙌</p>
            <p className="closed-news">O Serve ainda não foi liberado. Em breve teremos novidades: uma nova forma de gerenciarmos as escalas. Fique de olho no grupo! 😉</p>
            <button className="btn btn-ghost btn-block" onClick={() => { setClosedFor(null); setPhone('') }}>Entendi</button>
          </div>
        ) : available === false ? (
          <p className="notice-box">O acesso com celular ainda está sendo configurado. Enquanto isso, explore a demonstração abaixo.</p>
        ) : step === 'phone' ? (
          <>
            <label className="field">
              <span>Seu celular</span>
              <input
                id="login-phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(16) 99999-9999"
                value={phone}
                type="tel"
                onChange={(e) => { setPhone((p) => nextPhoneValue(p, e.target.value)); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && start()}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary btn-block" onClick={start} disabled={busy || available === null || phone.replace(/\D/g, '').length < 10}>
              {busy ? 'Aguarde…' : <>Continuar <ArrowRight size={18} /></>}
            </button>
          </>
        ) : step === 'pin' ? (
          <>
            <div className="initials-head">
              {back}
              <div>
                <strong>Digite seu PIN</strong>
                <span className="muted small block">{phone}</span>
              </div>
            </div>
            <PinInput value={pin} onChange={(v) => { setPin(v); setError('') }} onComplete={enter} disabled={busy} />
            {error && <p className="error center">{error}</p>}
            <p className="muted small center pin-help">Esqueceu o PIN? Peça para a liderança redefinir.</p>
          </>
        ) : (
          <>
            <div className="initials-head">
              {back}
              <div>
                <strong>{step === 'create' ? 'Primeiro acesso: crie seu PIN' : 'Repita o PIN'}</strong>
                <span className="muted small block">{step === 'create' ? '4 números. Você vai usar sempre para entrar no app.' : 'Para confirmar.'}</span>
              </div>
            </div>
            <PinInput
              key={step}
              id={step === 'create' ? 'pin-new' : 'pin-confirm'}
              value={pin}
              onChange={(v) => { setPin(v); setError('') }}
              onComplete={(v) => { if (step === 'create') { setNewPin(v); setPin(''); setStep('confirm') } else confirmCreate(v) }}
              disabled={busy}
            />
            {error && <p className="error center">{error}</p>}
            <p className="muted small center pin-help">Evite sequências como 1234 ou números repetidos.</p>
          </>
        )}

        {showDemo && <>
        <div className="divider"><span>ou explore a demonstração</span></div>
        <p className="muted small demo-hint">Fique à vontade para testar: as alterações são desfeitas 10 minutos depois.</p>

        <div className="demo-list">
          {demoProfiles.map((p) => {
            const m = demoMembers.find((x) => x.id === p.id)
            if (!m) return null
            return (
              <button key={p.id} className="demo-item" onClick={() => actions.enterDemo(m.id)}>
                <Avatar name={m.name} size={40} />
                <div>
                  <strong>{m.name}</strong>
                  <span>{p.label} · {p.hint}</span>
                </div>
                <ArrowRight size={18} className="muted" />
              </button>
            )
          })}
        </div>
        </>}
      </div>
    </div>
  )
}
