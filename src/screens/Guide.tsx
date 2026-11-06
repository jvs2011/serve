import { useState, type ReactNode } from 'react'
import { BellRing, CalendarCheck, CalendarX2, Crown, HandHeart, Repeat } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { managedMinistries, firstName } from '../lib/selectors'
import { NotificationsStep } from '../components/Notifications'

const key = (mode: string | null, id: string) => `serve:guide:${mode}:${id}`

/** A pessoa já viu o guia de primeiro acesso neste aparelho? */
export function guideSeen(mode: string | null, id: string): boolean {
  try { return localStorage.getItem(key(mode, id)) === '1' } catch { return true }
}

/** Abre o guia de novo (Perfil → Como usar o Serve) */
export const openGuide = () => window.dispatchEvent(new Event('serve:guide'))

interface Step { icon: ReactNode; title: string; text: ReactNode; extra?: ReactNode; color: string }

/** Guia de primeiro acesso: poucas telas explicando o essencial */
export function Guide({ onDone }: { onDone: () => void }) {
  const { data, mode } = useStore()
  const me = useMe()
  const [i, setI] = useState(0)
  const led = managedMinistries(data, me)
  const ledNames = led.length > 3 ? 'dos ministérios' : led.map((m) => m.name).join(', ')
  const hasGroups = led.some((m) => m.roles.some((r) => r.group))

  const steps: Step[] = [
    {
      icon: <HandHeart size={34} />, color: 'var(--accent)',
      title: `Que bom ter você aqui, ${firstName(me.name)}!`,
      text: 'No Serve você vê quando vai servir, confirma a sua escala e combina trocas com a equipe. Leva menos de um minuto para entender.',
    },
    {
      icon: <CalendarCheck size={34} />, color: 'var(--ok)',
      title: 'Confirme sua escala',
      text: <>Quando o líder te escalar, a escala aparece na tela <b>Início</b>. Toque em <b>Confirmar</b> ou, se não puder, em <b>Não posso</b>, assim o líder chama outra pessoa a tempo.</>,
    },
    {
      icon: <CalendarX2 size={34} />, color: 'var(--info)',
      title: 'Avise quando não pode',
      text: <>Em <b>Perfil → Disponibilidade</b>, marque os cultos da semana e os dias em que você não pode servir. A escala já respeita isso.</>,
    },
    {
      icon: <Repeat size={34} />, color: 'var(--warn)',
      title: 'Surgiu um imprevisto?',
      text: <>Na sua escala, toque em <b>Pedir troca</b>. Quem tem a mesma função recebe o pedido e pode assumir no seu lugar.</>,
    },
    ...(led.length ? [{
      icon: <Crown size={34} />, color: 'var(--accent-strong)',
      title: me.access === 'admin' ? 'Você é da coordenação' : `Você é líder ${led.length > 1 ? 'de ' : 'do '}${ledNames}`,
      text: <>Monte a escala à mão ou com a <b>escala automática</b>{hasGroups ? ' (no Louvor, por grupos de voz)' : ''}. Ela fica em <b>rascunho</b>: confira e toque em <b>Publicar</b>. Só então a equipe é avisada para confirmar.</>,
    }] : []),
    {
      icon: <BellRing size={34} />, color: 'var(--accent)',
      title: 'Ative as notificações',
      text: 'Receba um aviso quando for escalado, quando alguém pedir troca e um lembrete na véspera.',
      extra: <NotificationsStep />,
    },
  ]
  const step = steps[i]
  const last = i === steps.length - 1
  const finish = () => {
    try { localStorage.setItem(key(mode, me.id), '1') } catch { /* ignore */ }
    onDone()
  }

  return (
    <div className="guide" role="dialog" aria-label="Como usar o Serve">
      <button className="link guide-skip" onClick={finish}>{last ? '' : 'Pular'}</button>
      <div className="guide-body" key={i}>
        <span className="guide-icon" style={{ color: step.color, background: `color-mix(in srgb, ${step.color} 14%, transparent)` }}>{step.icon}</span>
        <h1>{step.title}</h1>
        <p>{step.text}</p>
        {step.extra && <div className="guide-extra">{step.extra}</div>}
      </div>
      <div className="guide-dots" aria-hidden>
        {steps.map((_, n) => <span key={n} className={n === i ? 'on' : ''} />)}
      </div>
      <div className="guide-actions">
        {i > 0 ? <button className="btn btn-ghost" onClick={() => setI(i - 1)}>Voltar</button> : <span />}
        <button className="btn btn-primary" onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Começar' : 'Próximo'}</button>
      </div>
    </div>
  )
}
