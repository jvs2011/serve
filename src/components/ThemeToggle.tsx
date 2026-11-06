import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { currentTheme, onSystemThemeChange, setTheme, type Theme } from '../lib/theme'

/** Sol/lua: alterna claro e escuro (o padrão segue o celular) */
export function ThemeToggle() {
  const [theme, set] = useState<Theme>(currentTheme)
  useEffect(() => onSystemThemeChange(() => set(currentTheme())), [])
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="icon-btn theme-toggle"
      onClick={() => { setTheme(next); set(currentTheme()) }}
      aria-label={next === 'dark' ? 'Usar tema escuro' : 'Usar tema claro'}
      title={next === 'dark' ? 'Tema escuro' : 'Tema claro'}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
