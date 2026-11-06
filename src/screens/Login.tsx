import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useStore } from '../data/store'
import { createSeed, demoProfiles } from '../data/seed'
import { Avatar } from '../components/ui'
import { Logo } from '../components/Logo'
import { isValidPhone, nextPhoneValue, spaced } from '../lib/people'

const demoMembers = createSeed().members

export function Login() {
  const { actions } = useStore()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'phone' | 'initials'>('phone')
  const [challenge, setChallenge] = useState<{ challengeId: string; options: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/status')
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((r: { configured?: boolean }) => setAvailable(!!r.configured))
      .catch(() => setAvailable(false))
  }, [])

  const askInitials = async () => {
    if (!isValidPhone(phone)) return setError('Digite o celular com DDD, por exemplo (16) 99999-1234.')
    setBusy(true)
    setError('')
    try {
      setChallenge(await actions.requestLogin(phone))
      setStep('initials')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível continuar.')
    } finally {
      setBusy(false)
    }
  }

  const choose = async (answer: string) => {
    if (!challenge) return
    setBusy(true)
    setError('')
    try {
      await actions.verifyLogin(challenge.challengeId, answer)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.')
      setStep('phone')
      setChallenge(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-hero">
        <Logo size={44} light />
        <h1>Servir é um <em>privilégio.</em></h1>
        <p>Escalas dos ministérios da Lagoinha Franca, na palma da mão.</p>
      </div>

      <div className="login-card">
        {available === false ? (
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
                onKeyDown={(e) => e.key === 'Enter' && askInitials()}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary btn-block" onClick={askInitials} disabled={busy || available === null || phone.replace(/\D/g, '').length < 10}>
              {busy ? 'Aguarde…' : <>Continuar <ArrowRight size={18} /></>}
            </button>
          </>
        ) : (
          <>
            <div className="initials-head">
              <button className="icon-btn" onClick={() => { setStep('phone'); setError('') }} aria-label="Trocar número"><ArrowLeft size={20} /></button>
              <div>
                <strong>Toque nas iniciais do seu nome</strong>
                <span className="muted small block">Exemplo: João Victor da Silva → J V S</span>
              </div>
            </div>
            <div className="initials-grid">
              {challenge?.options.map((o) => (
                <button key={o} className="initials-option" disabled={busy} onClick={() => choose(o)}>{spaced(o)}</button>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
          </>
        )}

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
      </div>
    </div>
  )
}
