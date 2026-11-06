/*
 * Notificações no celular (Web Push).
 * As chaves VAPID são criadas na primeira vez e guardadas no banco — nada para configurar.
 * Inscrições: uma lista por pessoa (vários aparelhos), com índice reverso por endpoint.
 */
import { createHash } from 'node:crypto'
import webpush from 'web-push'
import type { Store } from './storage.js'

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const VAPID_KEY = 'serve:vapid'
const subsKey = (memberId: string) => `serve:push:${memberId}`
const epKey = (endpoint: string) => `serve:pushep:${createHash('sha256').update(endpoint).digest('hex')}`
const MAX_DEVICES = 5

export async function vapidKeys(store: Store): Promise<{ publicKey: string; privateKey: string }> {
  let raw = await store.get(VAPID_KEY)
  if (!raw) {
    await store.setNX(VAPID_KEY, JSON.stringify(webpush.generateVAPIDKeys()))
    raw = await store.get(VAPID_KEY)
  }
  return JSON.parse(raw!)
}

async function getSubs(store: Store, memberId: string): Promise<PushSub[]> {
  const raw = await store.get(subsKey(memberId))
  return raw ? (JSON.parse(raw) as PushSub[]) : []
}

export function isValidSub(s: unknown): s is PushSub {
  const x = s as PushSub
  return !!x && typeof x.endpoint === 'string' && x.endpoint.startsWith('https://') && typeof x.keys?.p256dh === 'string' && typeof x.keys?.auth === 'string'
}

export async function addSub(store: Store, memberId: string, sub: PushSub) {
  // o mesmo aparelho pode ter sido de outra pessoa (outro login): tira de lá
  const previous = await store.get(epKey(sub.endpoint))
  if (previous && previous !== memberId) await removeSub(store, previous, sub.endpoint)
  const list = (await getSubs(store, memberId)).filter((s) => s.endpoint !== sub.endpoint)
  list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } })
  await store.set(subsKey(memberId), JSON.stringify(list.slice(-MAX_DEVICES)))
  await store.set(epKey(sub.endpoint), memberId)
}

export async function removeSub(store: Store, memberId: string, endpoint: string) {
  const list = await getSubs(store, memberId)
  const next = list.filter((s) => s.endpoint !== endpoint)
  if (next.length !== list.length) await store.set(subsKey(memberId), JSON.stringify(next))
  if ((await store.get(epKey(endpoint))) === memberId) await store.del(epKey(endpoint))
}

export async function hasSubs(store: Store, memberId: string) {
  return (await getSubs(store, memberId)).length > 0
}

/** Envia para todos os aparelhos das pessoas; remove inscrições vencidas. Retorna quantos envios deram certo. */
export async function sendPush(store: Store, memberIds: string[], payload: PushPayload): Promise<number> {
  const ids = [...new Set(memberIds)]
  if (!ids.length) return 0
  const { publicKey, privateKey } = await vapidKeys(store)
  const subject = process.env.VAPID_SUBJECT || 'https://serve.lagoinhafranca.com'
  const body = JSON.stringify(payload)
  let sent = 0
  await Promise.allSettled(
    ids.map(async (memberId) => {
      for (const sub of await getSubs(store, memberId)) {
        try {
          await webpush.sendNotification(sub, body, {
            vapidDetails: { subject, publicKey, privateKey },
            TTL: 12 * 3600,
            timeout: 5000,
          })
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await removeSub(store, memberId, sub.endpoint)
          else console.error('push falhou', status, (e as Error).message)
        }
      }
    }),
  )
  return sent
}
