import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type Tab = 'home' | 'agenda' | 'swaps' | 'team' | 'profile'

export type Route =
  | { name: 'event'; id: string }
  | { name: 'ministry'; id: string }
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

/** Navegação em pilha simples, integrada ao botão "voltar" do celular */
export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('home')
  const [stack, setStack] = useState<Route[]>([])

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
    window.scrollTo(0, 0)
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
    window.scrollTo(0, 0)
  }, [])

  return <Ctx.Provider value={{ tab, stack, setTab, push, back }}>{children}</Ctx.Provider>
}

export function useNav() {
  const n = useContext(Ctx)
  if (!n) throw new Error('useNav fora do NavProvider')
  return n
}
