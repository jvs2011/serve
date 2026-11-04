import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, Assignment, AssignmentStatus, Member, Song } from './types'
import { createSeed, DATA_VERSION } from './seed'
import { autoFill, uid } from '../lib/schedule'

/*
 * Armazenamento local (localStorage) para o protótipo.
 * Para produção, troque `load`/`save` por chamadas a um backend
 * (ex.: Supabase/Firebase) — as ações abaixo já isolam todas as mutações.
 */
const KEY = 'serve:data'
const USER_KEY = 'serve:user'

/**
 * Modo demonstração: qualquer alteração fica salva por apenas 10 minutos
 * (contados a partir da primeira alteração); depois os dados voltam ao padrão.
 * Desligue (DEMO_MODE = false) quando o app passar a usar dados reais.
 */
export const DEMO_MODE = true
export const DEMO_TTL_MS = 10 * 60 * 1000

export function demoExpiresAt(data: AppData): number | null {
  return DEMO_MODE && data.modifiedAt ? data.modifiedAt + DEMO_TTL_MS : null
}

function isExpired(data: AppData) {
  const exp = demoExpiresAt(data)
  return exp !== null && Date.now() >= exp
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed.version === DATA_VERSION && !isExpired(parsed)) return parsed
    }
  } catch { /* sem storage disponível */ }
  return createSeed()
}

function save(data: AppData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function loadUser(): string | null {
  try { return localStorage.getItem(USER_KEY) } catch { return null }
}

interface Toast { id: number; text: string }

interface Store {
  data: AppData
  me: Member | null
  toast: Toast | null
  notify: (text: string) => void
  actions: ReturnType<typeof makeActions>
}

const Ctx = createContext<Store | null>(null)

function makeActions(
  mutate: (fn: (d: AppData) => void) => void,
  getMe: () => string | null,
  setUser: (id: string | null) => void,
  replace: (d: AppData) => void,
) {
  const findA = (d: AppData, id: string) => d.assignments.find((a) => a.id === id)
  return {
    login: (id: string) => setUser(id),
    logout: () => setUser(null),
    respond: (assignmentId: string, status: AssignmentStatus) =>
      mutate((d) => {
        const a = findA(d, assignmentId)
        if (a) a.status = status
      }),
    checkIn: (assignmentId: string) =>
      mutate((d) => {
        const a = findA(d, assignmentId)
        if (a) { a.checkedIn = true; a.status = 'confirmed' }
      }),
    feedback: (assignmentId: string, rating: number, comment: string) =>
      mutate((d) => {
        const a = findA(d, assignmentId)
        if (a) a.feedback = { rating, comment }
      }),
    toggleUnavailable: (date: string) =>
      mutate((d) => {
        const me = getMe()
        if (!me) return
        const list = d.unavailability[me] ?? []
        d.unavailability[me] = list.includes(date) ? list.filter((x) => x !== date) : [...list, date].sort()
      }),
    setMaxPerMonth: (n: number) =>
      mutate((d) => {
        const m = d.members.find((x) => x.id === getMe())
        if (m) m.maxPerMonth = n
      }),
    requestSwap: (assignmentId: string, reason: string) =>
      mutate((d) => {
        const me = getMe()
        if (!me) return
        d.swaps = d.swaps.filter((s) => !(s.assignmentId === assignmentId && s.status === 'open'))
        d.swaps.unshift({ id: uid(), assignmentId, fromMemberId: me, reason, createdAt: new Date().toISOString(), status: 'open' })
      }),
    cancelSwap: (swapId: string) =>
      mutate((d) => {
        const s = d.swaps.find((x) => x.id === swapId)
        if (s) s.status = 'cancelled'
      }),
    acceptSwap: (swapId: string) =>
      mutate((d) => {
        const me = getMe()
        const s = d.swaps.find((x) => x.id === swapId)
        if (!me || !s || s.status !== 'open') return
        const a = findA(d, s.assignmentId)
        if (!a) return
        a.memberId = me
        a.status = 'confirmed'
        s.status = 'accepted'
        s.acceptedById = me
      }),
    assign: (eventId: string, ministryId: string, role: string, memberId: string) =>
      mutate((d) => {
        d.assignments.push({ id: uid(), eventId, ministryId, role, memberId, status: 'pending' })
      }),
    unassign: (assignmentId: string) =>
      mutate((d) => {
        d.assignments = d.assignments.filter((a) => a.id !== assignmentId)
        d.swaps = d.swaps.filter((s) => s.assignmentId !== assignmentId)
      }),
    /** Gera a escala automática para os eventos informados; retorna quantas vagas preencheu */
    autoSchedule: (eventIds: string[], ministryId: string): number => {
      let created: Assignment[] = []
      mutate((d) => {
        created = []
        for (const id of eventIds) {
          const ev = d.events.find((e) => e.id === id)
          if (!ev || !ev.ministryIds.includes(ministryId)) continue
          const add = autoFill(d, id, ministryId)
          d.assignments.push(...add)
          created.push(...add)
        }
      })
      return created.length
    },
    addNotice: (ministryId: string | null, title: string, body: string) =>
      mutate((d) => {
        const me = getMe()
        if (!me) return
        d.notices.unshift({ id: uid(), ministryId, authorId: me, title, body, createdAt: new Date().toISOString() })
      }),
    addSong: (eventId: string, song: Omit<Song, 'id'>) =>
      mutate((d) => {
        const ev = d.events.find((e) => e.id === eventId)
        if (ev) ev.setlist.push({ ...song, id: uid() })
      }),
    removeSong: (eventId: string, songId: string) =>
      mutate((d) => {
        const ev = d.events.find((e) => e.id === eventId)
        if (ev) ev.setlist = ev.setlist.filter((s) => s.id !== songId)
      }),
    addEvent: (title: string, date: string, time: string, ministryIds: string[]) =>
      mutate((d) => {
        d.events.push({ id: uid(), title, date, time, ministryIds, setlist: [] })
      }),
    resetDemo: () => replace(createSeed()),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [userId, setUserId] = useState<string | null>(loadUser)
  const [toast, setToast] = useState<Toast | null>(null)
  const dataRef = useRef(data)
  const userRef = useRef(userId)
  userRef.current = userId

  useEffect(() => { save(data) }, [data])

  const mutate = useCallback((fn: (d: AppData) => void) => {
    // mutação síncrona sobre uma cópia; permite que as ações retornem valores
    const base = isExpired(dataRef.current) ? createSeed() : dataRef.current
    const next = structuredClone(base)
    fn(next)
    if (DEMO_MODE && !next.modifiedAt) next.modifiedAt = Date.now()
    dataRef.current = next
    setData(next)
  }, [])

  const replace = useCallback((d: AppData) => { dataRef.current = d; setData(d) }, [])

  const setUser = useCallback((id: string | null) => {
    setUserId(id)
    try { id ? localStorage.setItem(USER_KEY, id) : localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
  }, [])

  const notify = useCallback((text: string) => {
    const id = Date.now()
    setToast({ id, text })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2600)
  }, [])

  // Demonstração: volta aos dados padrão quando o prazo de 10 minutos termina.
  // Também confere ao voltar para o app, pois o celular pausa os timers em segundo plano.
  const expiresAt = demoExpiresAt(data)
  useEffect(() => {
    if (expiresAt === null) return
    const restore = () => {
      if (Date.now() < expiresAt) return
      replace(createSeed())
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
  }, [expiresAt, replace, notify])

  const actions = useMemo(() => makeActions(mutate, () => userRef.current, setUser, replace), [mutate, setUser, replace])
  const me = data.members.find((m) => m.id === userId) ?? null

  return <Ctx.Provider value={{ data, me, toast, notify, actions }}>{children}</Ctx.Provider>
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
