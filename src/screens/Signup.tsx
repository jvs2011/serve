import { useEffect, useState, type FormEvent } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { Logo } from '../components/Logo'
import { formatPhone, isValidPhone, tidyName } from '../lib/people'

interface Info { id: string; name: string; description: string; color: string; teams: string[] }

/**
 * Formulário público de cadastro de um ministério (ex.: /cadastro/follow).
 * Para mandar no grupo do WhatsApp: cria o usuário no Serve sem a pessoa precisar conhecer o app.
 */
export function Signup({ ministryId }: { ministryId: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [teams, setTeams] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [noInterest, setNoInterest] = useState(false)
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // armadilha para robôs (campo invisível)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | 'created' | 'exists'>(null)

  useEffect(() => {
    fetch(`/api/signup-info?m=${encodeURIComponent(ministryId)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error ?? 'Formulário indisponível.')
        setInfo(j as Info)
        document.title = `Cadastro ${(j as Info).name} · Serve`
      })
      .catch((e) => setLoadError(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'Não foi possível abrir o formulário. Confira sua internet e tente de novo.'))
  }, [ministryId])

  const toggle = (t: string) => {
    setTeams((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))
    setInterests((s) => s.filter((x) => x !== t)) // quem já serve na equipe não precisa marcar interesse
  }
  const toggleInterest = (t: string) => {
    setNoInterest(false)
    setInterests((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))
  }
  const fullName = name.trim().split(/\s+/).length >= 2

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName) return setError('Escreva seu nome completo (nome e sobrenome).')
    if (!isValidPhone(phone)) return setError('Escreva seu celular com DDD, por exemplo (16) 99999-1234.')
    if (!teams.length) return setError('Selecione pelo menos uma equipe.')
    if (!consent) return setError('Marque a autorização para podermos usar seus dados nas escalas.')
    setSending(true)
    setError('')
    try {
      const r = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ministryId, name, phone, roles: teams, interests: noInterest ? [] : interests.filter((t) => !teams.includes(t)), consent, website }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'Não foi possível enviar.')
      setDone(j.status === 'exists' ? 'exists' : 'created')
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sem conexão. Confira sua internet e tente de novo.')
    } finally {
      setSending(false)
    }
  }

  const reset = () => { setName(''); setPhone(''); setTeams([]); setInterests([]); setNoInterest(false); setConsent(false); setDone(null) }
  const color = info?.color ?? 'var(--accent)'

  return (
    <div className="signup">
      <header className="signup-hero" style={{ ['--m' as string]: color }}>
        <div className="signup-brand"><Logo size={26} light /><span>Lagoinha Franca</span></div>
        {info && !done && (
          <>
            <span className="signup-kicker">Cadastro de voluntários</span>
            <h1>{info.name}</h1>
            <p>{info.description}</p>
          </>
        )}
      </header>

      <main className="signup-body">
        {loadError ? (
          <div className="card signup-card"><p>{loadError}</p></div>
        ) : !info ? (
          <div className="card signup-card signup-loading"><div className="spinner" aria-label="Carregando" /></div>
        ) : done ? (
          <div className="card signup-card signup-done">
            <CheckCircle2 size={56} style={{ color }} />
            <h2>{done === 'exists' ? 'Você já estava cadastrado(a)!' : `Obrigado, ${tidyName(name).split(' ')[0]}! 🙌`}</h2>
            <p>{done === 'exists'
              ? 'Esse número já está na nossa lista, então não precisa fazer mais nada.'
              : `Seu cadastro no ${info.name} foi recebido.`}</p>
            <p className="signup-news">Em breve teremos novidades: uma nova forma de gerenciarmos as escalas. Fique de olho no grupo! 😉</p>
            <button className="link" onClick={reset}>Enviar outro cadastro</button>
          </div>
        ) : (
          <form className="card signup-card" onSubmit={submit} noValidate>
            <label className="field">
              <span>Nome completo</span>
              <input id="su-name" name="name" autoComplete="name" autoCapitalize="words" value={name}
                onChange={(e) => { setName(e.target.value); setError('') }} placeholder="Ex.: Maria das Graças Souza" />
            </label>
            <label className="field">
              <span>Celular (WhatsApp)</span>
              <input id="su-phone" name="phone" inputMode="tel" autoComplete="tel" value={phone}
                onChange={(e) => { setPhone(e.target.value); setError('') }}
                onBlur={() => isValidPhone(phone) && setPhone(formatPhone(phone))} placeholder="(16) 99999-9999" />
            </label>

            <fieldset className="signup-teams">
              <legend>Em quais equipes do {info.name} você serve?</legend>
              <span className="muted small">Pode marcar mais de uma.</span>
              <div className="signup-team-grid">
                {info.teams.map((t) => {
                  const on = teams.includes(t)
                  return (
                    <button type="button" key={t} className={`signup-team${on ? ' on' : ''}`} aria-pressed={on} onClick={() => { toggle(t); setError('') }}
                      style={on ? { borderColor: color } : undefined}>
                      <span className="signup-check" style={on ? { background: color, borderColor: color } : undefined}>{on && <Check size={14} />}</span>
                      {t}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {teams.length > 0 && info.teams.some((t) => !teams.includes(t)) && (
              <fieldset className="signup-teams">
                <legend>Tem outra equipe do {info.name} que você teria interesse em participar?</legend>
                <span className="muted small">Opcional. Pode marcar mais de uma.</span>
                <div className="signup-team-grid">
                  {info.teams.filter((t) => !teams.includes(t)).map((t) => {
                    const on = interests.includes(t) && !noInterest
                    return (
                      <button type="button" key={t} className={`signup-team${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleInterest(t)}
                        style={on ? { borderColor: color } : undefined}>
                        <span className="signup-check" style={on ? { background: color, borderColor: color } : undefined}>{on && <Check size={14} />}</span>
                        {t}
                      </button>
                    )
                  })}
                  <button type="button" className={`signup-team${noInterest ? ' on' : ''}`} aria-pressed={noInterest}
                    onClick={() => { setNoInterest((v) => !v); setInterests([]) }} style={noInterest ? { borderColor: color } : undefined}>
                    <span className="signup-check" style={noInterest ? { background: color, borderColor: color } : undefined}>{noInterest && <Check size={14} />}</span>
                    Não, por enquanto
                  </button>
                </div>
              </fieldset>
            )}

            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />

            <label className="signup-consent">
              <input id="su-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError('') }} />
              <span>Autorizo a Lagoinha Franca a usar meu nome e celular para organizar as escalas de voluntários.</span>
            </label>

            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={sending} style={{ background: color }}>
              {sending ? 'Enviando…' : 'Enviar cadastro'}
            </button>
          </form>
        )}
        <p className="signup-foot">Serve · escalas de voluntários da Lagoinha Franca</p>
      </main>
    </div>
  )
}
