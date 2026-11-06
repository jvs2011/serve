import { useEffect, useState, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Logo } from './Logo'
import { DESKTOP_QUERY } from '../lib/desktop'

/** Tamanho da tela simulada (pontos de um iPhone Pro Max) e da borda do aparelho */
const SCREEN_W = 440
const SCREEN_H = 956
const BEZEL = 13
const PHONE_W = SCREEN_W + BEZEL * 2
const PHONE_H = SCREEN_H + BEZEL * 2

const DESKTOP = DESKTOP_QUERY

function useDesktop() {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP)
    const fn = () => setOn(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return on
}

function useScale() {
  const calc = () => Math.min(1, (window.innerHeight - 48) / PHONE_H)
  const [scale, setScale] = useState(calc)
  useEffect(() => {
    const fn = () => setScale(calc())
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return scale
}

function useClock() {
  const fmt = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 15_000)
    return () => clearInterval(id)
  }, [])
  return t
}

function QrCode({ text }: { text: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M')
      qr.addData(text)
      qr.make()
      if (alive) setSvg(qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }))
    })
    return () => { alive = false }
  }, [text])
  return <div className="qr" aria-label={`QR code para ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

/**
 * No computador, mostra o app dentro de um celular (estilo iPhone Pro Max preto),
 * com a mensagem de que o Serve é feito para celular. No celular, mostra o app normalmente.
 */
export function DeviceFrame({ children, kind }: { children: ReactNode; kind: 'app' | 'form' }) {
  const desktop = useDesktop()
  const scale = useScale()
  const time = useClock()
  if (!desktop) return <>{children}</>

  const url = location.origin + location.pathname
  const host = location.host + (location.pathname !== '/' ? location.pathname : '')

  return (
    <div className="device-stage">
      <aside className="device-aside">
        <Logo size={44} light />
        <h2>{kind === 'form' ? 'Este formulário foi feito para o celular.' : 'O Serve foi feito para o celular.'}</h2>
        <p>
          {kind === 'form'
            ? 'Você pode preencher aqui mesmo, ou aponte a câmera do celular para o código e abra lá.'
            : 'Aponte a câmera do celular para o código, abra o Serve e adicione à tela inicial para usar como aplicativo.'}
        </p>
        <div className="device-qr">
          <QrCode text={url} />
          <span>{host}</span>
        </div>
      </aside>

      <div className="device-slot" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <button className="device-refresh" onClick={() => location.reload()} title="Recarregar o app (continua na mesma tela)">
          <RotateCw size={20} />
          <span>Recarregar</span>
        </button>
        <div className="phone" style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}>
          <span className="phone-btn phone-btn-action" />
          <span className="phone-btn phone-btn-vol-up" />
          <span className="phone-btn phone-btn-vol-down" />
          <span className="phone-btn phone-btn-power" />
          <span className="phone-btn phone-btn-camera" />
          <div className="phone-screen" style={{ width: SCREEN_W, height: SCREEN_H }}>
            <div className="phone-scroll">{children}</div>
            <div className="phone-status" aria-hidden="true">
              <span className="phone-time">{time}</span>
              <span className="phone-icons">
                <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8 .4 10.6 10.6 0 0 0 .5 3.4l1.3 1.3A8.7 8.7 0 0 1 8 2.2Zm0 3.6c1.4 0 2.7.5 3.6 1.4l1.3-1.3A7 7 0 0 0 8 4a7 7 0 0 0-4.9 1.9l1.3 1.3c1-.9 2.2-1.4 3.6-1.4Zm0 3.6c.5 0 .9.2 1.2.5L8 11.2 6.8 9.9c.3-.3.7-.5 1.2-.5Z" /></svg>
                <svg width="27" height="12" viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="17" height="8" rx="2" /><path d="M24.5 4v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" opacity=".5" /></svg>
              </span>
            </div>
            <div className="phone-island" aria-hidden="true" />
            <div className="phone-home" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  )
}
