import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Signup } from './screens/Signup'
import { DeviceFrame } from './components/DeviceFrame'
import './styles.css'

// /cadastro/<ministério> → formulário público de cadastro (sem o app)
const signup = location.pathname.match(/^\/cadastro\/([a-z0-9-]+)\/?$/i)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeviceFrame kind={signup ? 'form' : 'app'}>
      {signup ? <Signup ministryId={signup[1].toLowerCase()} /> : <App />}
    </DeviceFrame>
  </StrictMode>,
)

// PWA: registra o service worker só em produção, servido do próprio domínio
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
