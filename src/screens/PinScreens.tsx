import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useStore } from '../data/store'
import { PinInput } from '../components/PinInput'
import { Logo } from '../components/Logo'

/** Quem já está logado mas ainda não tem PIN precisa criar antes de continuar */
export function CreatePinGate() {
  const { actions, me } = useStore()
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const finish = async (v: string) => {
    if (v !== first) { setStep('create'); setPin(''); setFirst(''); setError('Os PINs não são iguais. Crie de novo.'); return }
    setBusy(true)
    try {
      await actions.pinSet(v)
    } catch (e) {
      setStep('create'); setPin(''); setFirst('')
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o PIN.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pin-gate">
      <Logo size={32} />
      <span className="closed-icon"><KeyRound size={26} /></span>
      <h2>{step === 'create' ? `${me ? `${me.name.split(' ')[0]}, crie` : 'Crie'} seu PIN` : 'Repita o PIN'}</h2>
      <p className="muted">{step === 'create' ? 'Agora o Serve usa celular + PIN de 4 números para entrar.' : 'Para confirmar.'}</p>
      <PinInput key={step} id={`gate-${step}`} value={pin} onChange={(v) => { setPin(v); setError('') }} disabled={busy}
        onComplete={(v) => { if (step === 'create') { setFirst(v); setPin(''); setStep('confirm') } else finish(v) }} />
      {error && <p className="error center">{error}</p>}
      <p className="muted small center">Evite sequências como 1234 ou números repetidos.</p>
      <button className="link" onClick={actions.logout}>Sair</button>
    </div>
  )
}

/** Perfil → Alterar PIN */
export function ChangePinForm({ onDone }: { onDone: () => void }) {
  const { actions, notify } = useStore()
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const labels = { current: 'Digite o PIN atual', new: 'Digite o novo PIN', confirm: 'Repita o novo PIN' }

  const complete = async (v: string) => {
    if (step === 'current') { setCurrent(v); setPin(''); setStep('new'); return }
    if (step === 'new') { setNext(v); setPin(''); setStep('confirm'); return }
    if (v !== next) { setNext(''); setPin(''); setStep('new'); setError('Os PINs novos não são iguais. Digite de novo.'); return }
    setBusy(true)
    try {
      await actions.pinChange(current, v)
      notify('PIN alterado 🔒')
      onDone()
    } catch (e) {
      setCurrent(''); setNext(''); setPin(''); setStep('current')
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o PIN.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="center"><strong>{labels[step]}</strong></p>
      <PinInput key={step} id={`change-${step}`} value={pin} onChange={(v) => { setPin(v); setError('') }} onComplete={complete} disabled={busy} />
      {error && <p className="error center">{error}</p>}
    </>
  )
}
