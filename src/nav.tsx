import { scrollToTop } from './lib/scroll'
import { isDesktop } from './lib/desktop'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type Tab = 'home' | 'agenda' | 'swaps' | 'team' | 'profile'

export type Route =
  | { name: 'event'; id: string }
  | { name: 'ministry'; id: string; tab?: 'schedule' | 'team' | 'notices' | 'arts' }
  | { name: 'availability' }
  | { name: 'dashboard' }
  | { name: 'history' }
  | { name: 'people' }
  | { name: 'person'; id?: string }

interface Nav {
  tab: Tab
  stack: Route[]
  setTab: (t: Tab) => void
  push: (r: Route) => void
  back: () => void
}

const Ctx = createContext<Nav | null>(null)

// Na prévia de arquivo único (frame restrito) não mexemos no histórico do navegador
const USE_HISTORY = import.meta.env.MODE !== 'single'

const NAV_KEY = 'serve:nav'
interface SavedNav { scope: string; tab: Tab; stack: Route[] }

/** No computador, ao recarregar a página, volta para a mesma aba/tela (mesma conta) */
function restore(scope: string): SavedNav | null {
  if (!isDesktop()) return null
  try {
    const s = JSON.parse(sessionStorage.getItem(NAV_KEY) ?? 'null') as SavedNav | null
    return s && s.scope === scope ? s : null
  } catch { return null }
}

/** Navegação em pilha simples, integrada ao botão "voltar" do celular */
export function NavProvider({ children, scope }: { children: ReactNode; scope: string }) {
  const [saved] = useState(() => restore(scope))
  const [tab, setTabState] = useState<Tab>(saved?.tab ?? 'home')
  const [stack, setStack] = useState<Route[]>(saved?.stack ?? [])

  // telas restauradas: recria as entradas do histórico para o "voltar" continuar funcionando
  const rebuilt = useRef(false)
  useEffect(() => {
    if (!USE_HISTORY || !saved?.stack.length || rebuilt.current) return
    rebuilt.current = true
    for (let i = 0; i < saved.stack.length; i++) { try { history.pushState({ serve: true }, '') } catch { /* ignore */ } }
  }, [saved])

  useEffect(() => {
    if (!isDesktop()) return
    try { sessionStorage.setItem(NAV_KEY, JSON.stringify({ scope, tab, stack } satisfies SavedNav)) } catch { /* ignore */ }
  }, [scope, tab, stack])

  const skipPops = useRef(0)

  useEffect(() => {
    const onPop = () => {
      if (skipPops.current > 0) { skipPops.current -= 1; return }
      setStack((s) => s.slice(0, -1))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const push = useCallback((r: Route) => {
    if (USE_HISTORY) { try { history.pushState({ serve: true }, '') } catch { /* ignore */ } }
    setStack((s) => [...s, r])
    scrollToTop()
  }, [])

  const back = useCallback(() => {
    if (USE_HISTORY) history.back()
    else setStack((s) => s.slice(0, -1))
  }, [])

  const stackRef = useRef(stack)
  stackRef.current = stack

  const setTab = useCallback((t: Tab) => {
    const depth = stackRef.current.length
    if (depth && USE_HISTORY) {
      // descarta as entradas de histórico das telas empilhadas sem disparar o pop delas
      skipPops.current += 1
      try { history.go(-depth) } catch { /* ignore */ }
    }
    setStack([])
    setTabState(t)
    scrollToTop()
  }, [])

  return <Ctx.Provider value={{ tab, stack, setTab, push, back }}>{children}</Ctx.Provider>
}

export function useNav() {
  const n = useContext(Ctx)
  if (!n) throw new Error('useNav fora do NavProvider')
  return n
}
