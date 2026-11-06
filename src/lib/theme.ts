/*
 * Tema claro/escuro. Padrão: segue o celular (prefers-color-scheme).
 * Quando a pessoa escolhe no botão, a escolha fica salva neste aparelho em
 * localStorage['serve:theme'] e vira data-theme no <html> (o index.html aplica antes de abrir).
 */
export type Theme = 'light' | 'dark'
const KEY = 'serve:theme'
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')

export const systemTheme = (): Theme => (mq().matches ? 'dark' : 'light')

export function currentTheme(): Theme {
  const t = document.documentElement.getAttribute('data-theme')
  return t === 'dark' || t === 'light' ? t : systemTheme()
}

/** Escolhe um tema; se for igual ao do celular, volta a seguir o celular */
export function setTheme(t: Theme) {
  const root = document.documentElement
  try {
    if (t === systemTheme()) { root.removeAttribute('data-theme'); localStorage.removeItem(KEY) }
    else { root.setAttribute('data-theme', t); localStorage.setItem(KEY, t) }
  } catch {
    root.setAttribute('data-theme', t)
  }
}

export function onSystemThemeChange(fn: () => void) {
  const m = mq()
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}
