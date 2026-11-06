/** Notificações no celular (Web Push) — lado do app */

export type PushState =
  | 'unsupported' // navegador sem suporte
  | 'ios-install' // iPhone/iPad: só funciona com o app instalado na tela inicial
  | 'no-sw' // service worker indisponível (ex.: ambiente de desenvolvimento)
  | 'denied' // bloqueado nas configurações
  | 'off' // pode ativar
  | 'on' // ativo neste aparelho

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return navigator.serviceWorker.ready
}

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'ios-install'
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  if (!reg) return 'no-sw'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function post(path: string, token: string, body: unknown) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Não foi possível concluir.')
  return json
}

/** Pede permissão (precisa vir de um toque do usuário), inscreve o aparelho e avisa o servidor */
export async function enablePush(token: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'As notificações foram bloqueadas. Libere nas configurações do celular para este site.'
    : 'Você não permitiu as notificações.')
  const reg = await registration()
  if (!reg) throw new Error('Não foi possível ativar neste navegador.')
  const { publicKey } = await (await fetch('/api/push-key')).json()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) })
  await post('push-subscribe', token, { subscription: sub.toJSON() })
}

export async function disablePush(token: string | null): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  if (token) await post('push-unsubscribe', token, { endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe()
}

/** Reenvia a inscrição deste aparelho (ex.: depois de entrar com outra conta) */
export async function resyncPush(token: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await post('push-subscribe', token, { subscription: sub.toJSON() }).catch(() => {})
}

export const testPush = (token: string) => post('push-test', token, {})
