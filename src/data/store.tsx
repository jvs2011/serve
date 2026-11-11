import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, AssignmentStatus, Member, Song, WeeklySlot } from './types'
import { createSeed, DATA_VERSION } from './seed'
import { visibleTo } from '../lib/schedule'
import { ActionError, applyAction, type Action, type ActionResult, type EventPatch, type MemberInput, type MinistryEventInput, type TaskInput } from './actions'
import { disablePush, resyncPush } from '../lib/push'

/*
 * Dois modos:
 * - "live": dados reais no servidor (/api). Login por celular + iniciais.
 * - "demo": dados de exemplo só neste aparelho; alterações duram 10 minutos.
 */
const DEMO_KEY = 'serve:data'
const SESSION_KEY = 'serve:session'
const LEGACY_USER_KEY = 'serve:user'
export const DEMO_TTL_MS = 10 * 60 * 1000
// a cada 30 s (com o app aberto) o app só pergunta se algo mudou; os dados vêm só quando mudaram
const POLL_MS = 30_000

type Session = { mode: 'demo'; userId: string } | { mode: 'live'; token: string }

export function demoExpiresAt(data: AppData): number | null {
  return data.modifiedAt ? data.modifiedAt + DEMO_TTL_MS : null
}
const isExpired = (d: AppData) => { const e = demoExpiresAt(d); return e !== null && Date.now() >= e }

function loadDemo(): AppData {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed.version === DATA_VERSION && !isExpired(parsed)) return parsed
    }
  } catch { /* sem storage */ }
  return createSeed()
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as Session
    const legacy = localStorage.getItem(LEGACY_USER_KEY)
    if (legacy) return { mode: 'demo', userId: legacy }
  } catch { /* ignore */ }
  return null
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LEGACY_USER_KEY)
  } catch { /* ignore */ }
}

async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError('Sem conexão com a internet. Confira sua rede e tente de novo.', 0)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((json as { error?: string }).error ?? 'Algo deu errado. Tente de novo.', res.status, json as Record<string, unknown>)
  return json as T
}

export type LoginStart = { mode: 'pin' } | { mode: 'create'; setupId: string }

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown> = {}) { super(message) }
}

interface Toast { id: number; text: string }

interface Store {
  mode: 'demo' | 'live' | null
  /** logado nos dados reais, mas ainda sem PIN (precisa criar antes de usar) */
  needsPin: boolean
  /** token da sessão real (para notificações) */
  token: string | null
  data: AppData
  me: Member | null
  loading: boolean
  loadError: string | null
  toast: Toast | null
  notify: (text: string) => void
  reload: () => void
  actions: ReturnType<typeof makeActions>
}

const Ctx = createContext<Store | null>(null)

function makeActions(
  dispatch: (a: Action) => ActionResult | null,
  dispatchAsync: (a: Action) => Promise<{ ok: true; result: ActionResult } | { ok: false; error: string }>,
  auth: {
    enterDemo: (id: string) => void
    logout: () => void
    resetDemo: () => void
    requestLogin: (phone: string) => Promise<LoginStart>
    pinCreate: (setupId: string, pin: string) => Promise<void>
    pinLogin: (phone: string, pin: string) => Promise<void>
    pinSet: (pin: string) => Promise<void>
    pinChange: (current: string, pin: string) => Promise<void>
  },
) {
  return {
    ...auth,
    respond: (assignmentId: string, status: AssignmentStatus) => { dispatch({ type: 'respond', assignmentId, status }) },
    checkIn: (assignmentId: string) => { dispatch({ type: 'checkIn', assignmentId }) },
    feedback: (assignmentId: string, rating: number, comment: string) => { dispatch({ type: 'feedback', assignmentId, rating, comment }) },
    toggleUnavailable: (date: string) => { dispatch({ type: 'toggleUnavailable', date }) },
    toggleRecurringOff: (key: string) => { dispatch({ type: 'toggleRecurringOff', key }) },
    setMaxPerMonth: (n: number) => { dispatch({ type: 'setMaxPerMonth', n }) },
    requestSwap: (assignmentId: string, reason: string) => { dispatch({ type: 'requestSwap', assignmentId, reason }) },
    cancelSwap: (swapId: string) => { dispatch({ type: 'cancelSwap', swapId }) },
    acceptSwap: (swapId: string) => { dispatch({ type: 'acceptSwap', swapId }) },
    assign: (eventId: string, ministryId: string, role: string, memberId: string) => { dispatch({ type: 'assign', eventId, ministryId, role, memberId }) },
    unassign: (assignmentId: string) => { dispatch({ type: 'unassign', assignmentId }) },
    saveGroup: (ministryId: string, group: { id?: string; name: string; memberIds: string[] }) => dispatchAsync({ type: 'saveGroup', ministryId, group }),
    removeGroup: (ministryId: string, groupId: string) => { dispatch({ type: 'removeGroup', ministryId, groupId }) },
    assignGroup: (eventId: string, ministryId: string, role: string, groupId: string) => dispatchAsync({ type: 'assignGroup', eventId, ministryId, role, groupId }),
    unassignGroup: (eventId: string, groupId: string) => { dispatch({ type: 'unassignGroup', eventId, groupId }) },
    /** Gera a escala automática; retorna quantas vagas preencheu */
    autoSchedule: (eventIds: string[], ministryId: string): number => dispatch({ type: 'autoSchedule', eventIds, ministryId })?.created ?? 0,
    publishDrafts: (ministryId: string, eventId?: string): number => dispatch({ type: 'publishDrafts', ministryId, eventId })?.created ?? 0,
    discardDrafts: (ministryId: string, eventId?: string): number => dispatch({ type: 'discardDrafts', ministryId, eventId })?.created ?? 0,
    addNotice: (ministryId: string | null, title: string, body: string, until?: string) => dispatchAsync({ type: 'addNotice', ministryId, title, body, until }),
    archiveNotice: (noticeId: string, archived: boolean, until?: string) => dispatchAsync({ type: 'archiveNotice', noticeId, archived, until }),
    removeNotice: (noticeId: string) => dispatchAsync({ type: 'removeNotice', noticeId }),
    addSong: (eventId: string, song: Omit<Song, 'id'>) => { dispatch({ type: 'addSong', eventId, song }) },
    removeSong: (eventId: string, songId: string) => { dispatch({ type: 'removeSong', eventId, songId }) },
    editSong: (eventId: string, songId: string, song: Omit<Song, 'id'>) => { dispatch({ type: 'editSong', eventId, songId, song }) },
    moveSong: (eventId: string, songId: string, dir: -1 | 1) => { dispatch({ type: 'moveSong', eventId, songId, dir }) },
    addEvent: (title: string, date: string, time: string, ministryIds: string[]) => { dispatch({ type: 'addEvent', title, date, time, ministryIds }) },
    setOpen: (open: boolean) => dispatchAsync({ type: 'setOpen', open }),
    setDemo: (show: boolean) => dispatchAsync({ type: 'setDemo', show }),
    resetPin: (memberId: string) => dispatchAsync({ type: 'resetPin', memberId }),
    saveTask: (task: TaskInput) => dispatchAsync({ type: 'saveTask', task }),
    createTeamSession: (sessionId: string, date: string, time: string, place?: string, note?: string) =>
      dispatchAsync({ type: 'createTeamSession', sessionId, date, time, place, note }),
    removeEvent: (eventId: string) => dispatchAsync({ type: 'removeEvent', eventId }),
    addMinistryEvent: (event: MinistryEventInput) => dispatchAsync({ type: 'addMinistryEvent', event }),
    editEvent: (eventId: string, patch: EventPatch) => dispatchAsync({ type: 'editEvent', eventId, patch }),
    saveWeekly: (slot: WeeklySlot) => dispatchAsync({ type: 'saveWeekly', slot }),
    removeWeekly: (slotId: string) => dispatchAsync({ type: 'removeWeekly', slotId }),
    sendSetlist: (eventId: string) => dispatchAsync({ type: 'sendSetlist', eventId }),
    deliverMaterial: (assignmentId: string, link: string) => dispatchAsync({ type: 'deliverMaterial', assignmentId, link }),
    removeTask: (taskId: string) => { dispatch({ type: 'removeTask', taskId }) },
    setTaskDone: (taskId: string, done: boolean, link?: string) => { dispatch({ type: 'setTaskDone', taskId, done, link }) },
    saveMember: (member: MemberInput) => dispatchAsync({ type: 'saveMember', member }),
    setMemberRoles: (memberId: string, ministryId: string, roles: string[]) => dispatchAsync({ type: 'setMemberRoles', memberId, ministryId, roles }),
    removeMember: (memberId: string) => dispatchAsync({ type: 'removeMember', memberId }),
  }
}

const emptyLive: AppData = { version: 0, ministries: [], members: [], events: [], assignments: [], unavailability: {}, swaps: [], notices: [] }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(loadSession)
  const [demoData, setDemoData] = useState<AppData>(loadDemo)
  const [liveData, setLiveData] = useState<AppData | null>(null)
  const [liveMeId, setLiveMeId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsPin, setNeedsPin] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const demoRef = useRef(demoData)
  const liveRef = useRef(liveData)
  const sessionRef = useRef(session)
  sessionRef.current = session
  liveRef.current = liveData

  const notify = useCallback((text: string) => {
    const id = Date.now()
    setToast({ id, text })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), Math.min(8000, Math.max(3200, text.length * 55)))
  }, [])

  const setSession = useCallback((s: Session | null) => {
    saveSession(s)
    setSessionState(s)
    if (!s || s.mode === 'demo') { setLiveData(null); setLiveMeId(null) }
  }, [])

  // ---------- demonstração ----------
  useEffect(() => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoData)) } catch { /* ignore */ } }, [demoData])
  const replaceDemo = useCallback((d: AppData) => { demoRef.current = d; setDemoData(d) }, [])

  const expiresAt = session?.mode === 'demo' ? demoExpiresAt(demoData) : null
  useEffect(() => {
    if (expiresAt === null) return
    const restore = () => {
      if (Date.now() < expiresAt) return
      replaceDemo(createSeed())
      notify('Demonstração restaurada aos dados padrão')
    }
    const t = setTimeout(restore, Math.max(0, expiresAt - Date.now()))
    const onVisible = () => document.visibilityState === 'visible' && restore()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [expiresAt, replaceDemo, notify])

  // ---------- dados reais ----------
  const versionRef = useRef(0)
  const fetchLive = useCallback(async (opts?: { quick?: boolean }) => {
    const s = sessionRef.current
    if (s?.mode !== 'live') return
    try {
      const since = opts?.quick && versionRef.current ? `?since=${versionRef.current}` : ''
      const r = await api<{ data: AppData; meId: string; needsPin?: boolean; version?: number; unchanged?: boolean }>(`data${since}`, { token: s.token })
      if (r.unchanged) return
      versionRef.current = r.version ?? 0
      setLiveData(r.data)
      setLiveMeId(r.meId)
      setNeedsPin(!!r.needsPin)
      setLoadError(null)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { setSession(null); notify(e.message) }
      else setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar.')
    }
  }, [notify, setSession])

  useEffect(() => {
    if (session?.mode !== 'live') return
    fetchLive()
    const t = setInterval(() => document.visibilityState === 'visible' && fetchLive({ quick: true }), POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && fetchLive({ quick: true })
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [session, fetchLive])

  // ---------- alterações ----------
  const meId = session?.mode === 'demo' ? session.userId : liveMeId

  const sendLive = useCallback(async (action: Action) => {
    const s = sessionRef.current
    if (s?.mode !== 'live') throw new ApiError('Entre novamente.', 401)
    const r = await api<{ data: AppData; meId: string; result: ActionResult; version?: number }>('action', { body: { action }, token: s.token })
    versionRef.current = r.version ?? 0
    setLiveData(r.data)
    setLiveMeId(r.meId)
    return r.result
  }, [])

  /** Aplica na hora (otimista) e, nos dados reais, confirma com o servidor */
  const dispatch = useCallback((action: Action): ActionResult | null => {
    const s = sessionRef.current
    if (!s) return null
    const actor = s.mode === 'demo' ? s.userId : liveMeId
    const base = s.mode === 'demo' ? (isExpired(demoRef.current) ? createSeed() : demoRef.current) : liveRef.current
    if (!base || !actor) return null
    const next = structuredClone(base)
    let result: ActionResult
    try {
      result = applyAction(next, action, actor)
    } catch (e) {
      notify(e instanceof ActionError ? e.message : 'Não foi possível fazer isso.')
      return null
    }
    if (s.mode === 'demo') {
      if (!next.modifiedAt) next.modifiedAt = Date.now()
      replaceDemo(next)
    } else {
      setLiveData(next)
      sendLive(action).catch((e) => {
        notify(e instanceof Error ? e.message : 'Não foi possível salvar.')
        fetchLive()
      })
    }
    return result
  }, [liveMeId, notify, replaceDemo, sendLive, fetchLive])

  /** Para formulários: espera a resposta do servidor e devolve o erro para mostrar na tela */
  const dispatchAsync = useCallback(async (action: Action) => {
    const s = sessionRef.current
    if (s?.mode === 'live') {
      try { return { ok: true as const, result: await sendLive(action) } }
      catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Não foi possível salvar.' } }
    }
    if (!s) return { ok: false as const, error: 'Entre novamente.' }
    const next = structuredClone(isExpired(demoRef.current) ? createSeed() : demoRef.current)
    try {
      const result = applyAction(next, action, s.userId)
      if (!next.modifiedAt) next.modifiedAt = Date.now()
      replaceDemo(next)
      return { ok: true as const, result }
    } catch (e) {
      return { ok: false as const, error: e instanceof ActionError ? e.message : 'Não foi possível salvar.' }
    }
  }, [replaceDemo, sendLive])

  const actions = useMemo(() => makeActions(dispatch, dispatchAsync, {
    enterDemo: (id) => setSession({ mode: 'demo', userId: id }),
    logout: () => {
      const s = sessionRef.current
      if (s?.mode === 'live') {
        // este aparelho deixa de receber as notificações dessa conta
        disablePush(s.token).catch(() => {}).finally(() => api('logout', { method: 'POST', token: s.token }).catch(() => {}))
      }
      setSession(null)
    },
    resetDemo: () => replaceDemo(createSeed()),
    requestLogin: (phone) => api<LoginStart>('login', { body: { phone } }),
    pinCreate: async (setupId, pin) => {
      const r = await api<{ token: string }>('pin-create', { body: { setupId, pin } })
      setSession({ mode: 'live', token: r.token })
      resyncPush(r.token).catch(() => {})
    },
    pinLogin: async (phone, pin) => {
      const r = await api<{ token: string }>('pin', { body: { phone, pin } })
      setSession({ mode: 'live', token: r.token })
      resyncPush(r.token).catch(() => {})
    },
    pinSet: async (pin) => {
      const s = sessionRef.current
      if (s?.mode !== 'live') return
      await api('pin-set', { body: { pin }, token: s.token })
      setNeedsPin(false)
    },
    pinChange: async (current, pin) => {
      const s = sessionRef.current
      if (s?.mode !== 'live') return
      await api('pin-change', { body: { current, pin }, token: s.token })
    },
  }), [dispatch, dispatchAsync, setSession, replaceDemo])

  const reload = useCallback(() => { fetchLive({ quick: true }) }, [fetchLive])
  const mode = session?.mode ?? null
  // na demonstração, cada perfil vê o mesmo que veria nos dados reais (rascunhos só para líderes)
  const demoView = useMemo(() => (meId ? visibleTo(demoData, meId) : demoData), [demoData, meId])
  const data = mode === 'live' ? liveData ?? emptyLive : demoView
  const me = meId ? data.members.find((m) => m.id === meId) ?? null : null
  const loading = mode === 'live' && !liveData

  // conta inexistente (removida pelo admin, ou dados de exemplo mudaram) → volta ao login
  useEffect(() => {
    if ((mode === 'demo' || (mode === 'live' && liveData)) && !me) setSession(null)
  }, [mode, me, liveData, setSession])

  return (
    <Ctx.Provider value={{ mode, needsPin: mode === 'live' && needsPin, token: session?.mode === 'live' ? session.token : null, data, me, loading, loadError, toast, notify, reload, actions }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

/** Para telas que só aparecem logado */
export function useMe(): Member {
  const { me } = useStore()
  if (!me) throw new Error('usuário não logado')
  return me
}
