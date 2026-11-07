import { createContext, useContext, useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'
const Appearance = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {}
})

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  )
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next === 'dark' ? '#080808' : '#f5f5f5')
    try {
      localStorage.setItem('aeris-appearance', next)
    } catch {}
    setTheme(next)
  }
  return <Appearance.Provider value={{ theme, toggle }}>{children}</Appearance.Provider>
}

export function AppearanceSwitch() {
  const { theme, toggle } = useContext(Appearance)
  return (
    <button
      className="appearance-switch"
      onClick={toggle}
      aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
      title={`Modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
