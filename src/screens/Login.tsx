import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../data/store'
import { demoProfiles } from '../data/seed'
import { Avatar } from '../components/ui'
import { Logo } from '../components/Logo'

export function Login() {
  const { data, actions } = useStore()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const digits = (s: string) => s.replace(/\D/g, '')
  const submit = () => {
    const m = data.members.find((x) => digits(x.phone) === digits(phone))
    if (m) actions.login(m.id)
    else setError('Não encontramos esse número. Fale com o líder do seu ministério para ser cadastrado.')
  }

  return (
    <div className="login">
      <div className="login-hero">
        <Logo size={44} light />
        <h1>Servir é um <em>privilégio.</em></h1>
        <p>Escalas dos ministérios da Lagoinha Franca, na palma da mão.</p>
      </div>

      <div className="login-card">
        <label className="field">
          <span>Seu celular</span>
          <input
            inputMode="tel"
            placeholder="(16) 99999-9999"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" onClick={submit} disabled={digits(phone).length < 10}>
          Entrar <ArrowRight size={18} />
        </button>

        <div className="divider"><span>ou explore a demonstração</span></div>
        <p className="muted small demo-hint">Fique à vontade para testar: as alterações são desfeitas 10 minutos depois.</p>

        <div className="demo-list">
          {demoProfiles.map((p) => {
            const m = data.members.find((x) => x.id === p.id)
            if (!m) return null
            return (
              <button key={p.id} className="demo-item" onClick={() => actions.login(m.id)}>
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
