import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Command,
  Factory as FactoryIcon,
  FileCode2,
  GitBranch,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Route,
  Search,
  Settings2,
  Shield,
  Smartphone,
  Sparkles,
  Terminal,
  Users,
  X,
  Zap
} from 'lucide-react'
import { Dashboard } from './Dashboard'
import { AerisMark, ExternalLink, Modal } from './components'
import { api, useEngine, Workspace } from './lib'
import { NewMission, MissionDetail, Missions } from './Missions'
import { Factory } from './Factory'
import { Configuration, Models, Skills } from './Configuration'
import { Agents, Files, TerminalView } from './WorkspaceViews'
import { Lab } from './Lab'
import { Phone } from './Phone'
import { PixelStudio } from './Factory'
import { Evolution } from './Evolution'
import { ContextBrain } from './ContextBrain'
import { AppearanceSwitch } from './Appearance'
import { DynamicIsland } from './DynamicIsland'
import { money } from '../shared/catalog'
import type { Run } from '../shared/types'

const repository = 'https://github.com/charbelochoa/000102030405060708090a0b0c0d0e0f'
const navigation = [
  { id: 'overview', label: 'Vista general', icon: Boxes },
  { id: 'missions', label: 'Misiones', icon: Layers3 },
  { id: 'agents', label: 'Agentes', icon: Users },
  { id: 'metrics', label: 'Métricas y progreso', icon: Activity },
  { id: 'evolution', label: 'Evolución del sistema', icon: GitBranch },
  { id: 'factory', label: 'Estudio de agentes', icon: FactoryIcon },
  { id: 'phone', label: 'Teléfono de clientes', icon: Smartphone },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'files', label: 'Archivos', icon: FileCode2 },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'context', label: 'Cerebro de contexto', icon: GitBranch },
  { id: 'lab', label: 'Análisis de archivos', icon: Activity },
  { id: 'router', label: 'Router de modelos', icon: Route },
  { id: 'providers', label: 'Proveedores y APIs', icon: KeyRound },
  { id: 'settings', label: 'Configuración', icon: Settings2 }
]

export function App() {
  const engine = useEngine()
  const { snapshot, refresh, notify } = engine
  const [page, setPage] = useState(
    new URLSearchParams(location.search).get('page') === 'app' ||
      location.pathname.startsWith('/app')
      ? 'app'
      : new URLSearchParams(location.search).get('page') === 'login' ||
          location.pathname === '/login'
        ? 'login'
        : 'landing'
  )
  const [view, setView] = useState(location.hash.slice(1) || 'overview')
  const [newMission, setNewMission] = useState(false)
  const [selected, setSelected] = useState<Run | null>(null)
  const [command, setCommand] = useState(false)
  const [query, setQuery] = useState('')
  const [notifications, setNotifications] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const starting = useRef(false)
  const prefix = useRef('')
  const go = (target: string) => {
    setPage(target)
    history.pushState(
      {},
      '',
      `${import.meta.env.BASE_URL}${target === 'app' ? `?page=app#${view}` : target === 'login' ? '?page=login' : ''}`
    )
    window.scrollTo(0, 0)
  }
  const navigate = (target: string) => {
    const next = navigation.some((n) => n.id === target) ? target : 'overview'
    setView(next)
    setMobileNav(false)
    history.replaceState({}, '', `${import.meta.env.BASE_URL}?page=app#${next}`)
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    if (page !== 'app' || !snapshot || snapshot.user || starting.current) return
    if (snapshot.auth.required) {
      go('login')
      return
    }
    starting.current = true
    api('/auth/local', {})
      .then(refresh)
      .catch((e) => {
        notify(e.message, true)
        setPage('login')
      })
      .finally(() => {
        starting.current = false
      })
  }, [page, snapshot, refresh, notify])
  useEffect(() => {
    const listener = () => {
      setPage(
        new URLSearchParams(location.search).get('page') === 'app' ||
          location.pathname.startsWith('/app')
          ? 'app'
          : new URLSearchParams(location.search).get('page') === 'login' ||
              location.pathname === '/login'
            ? 'login'
            : 'landing'
      )
      setView(location.hash.slice(1) || 'overview')
    }
    window.addEventListener('popstate', listener)
    return () => window.removeEventListener('popstate', listener)
  }, [])
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommand((value) => !value)
        return
      }
      if (
        (e.target as HTMLElement)?.matches('input, textarea, select, [contenteditable]') ||
        page !== 'app'
      )
        return
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) setNewMission(true)
      if (prefix.current === 'g' && e.key === 't') navigate('terminal')
      prefix.current = e.key
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [page])
  const active = snapshot?.runs.filter((r) => r.status === 'running').length || 0
  const actualCost =
    snapshot?.runs
      .filter((r) => r.mode === 'live')
      .reduce((s, r) => s + BigInt(r.costNano), 0n)
      .toString() || '0'
  const context = { ...engine }
  async function signout() {
    await api('/auth/logout', {})
    await refresh()
    go('landing')
  }
  return (
    <Workspace.Provider value={context}>
      {page === 'landing' ? (
        <Landing onEnter={() => go('app')} onLogin={() => go('login')} />
      ) : page === 'login' ? (
        <Login onSuccess={() => go('app')} onBack={() => go('landing')} />
      ) : !snapshot?.user ? (
        <div className="app-loading">
          <AerisMark />
          <span>Preparando tu espacio…</span>
          <Loader2 className="spin" size={17} />
        </div>
      ) : (
        <div className={`app-shell ${mobileNav ? 'nav-open' : ''}`}>
          <aside className="sidebar">
            <a
              className="brand"
              href={import.meta.env.BASE_URL}
              onClick={(e) => {
                e.preventDefault()
                go('landing')
              }}
            >
              <AerisMark />
              <span>AERIS</span>
            </a>
            <button
              className="workspace-selector"
              onClick={() => notify('Estás en el espacio local de AERIS.')}
            >
              <span className="workspace-avatar">a</span>
              <span>
                <strong>Mi espacio</strong>
                <small>Espacio personal</small>
              </span>
              <ChevronsUpDown size={12} />
            </button>
            <button className="sidebar-search" onClick={() => setCommand(true)}>
              <Search size={14} />
              <span>Buscar en AERIS</span>
              <kbd>Ctrl K</kbd>
            </button>
            <nav aria-label="Navegación principal">
              <div className="nav-section-label">ESPACIO DE TRABAJO</div>
              {navigation.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                  {item.id === 'missions' && active > 0 && (
                    <span className="nav-count">{active}</span>
                  )}
                </button>
              ))}
              <div className="nav-section-label second">HERRAMIENTAS</div>
              {navigation.slice(6, -1).map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                  {item.id === 'terminal' && <span className="nav-shortcut">&gt;_</span>}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button className="optimizer-card" onClick={() => navigate('settings')}>
                <div>
                  <span>
                    <Zap size={13} />
                    Optimizador {snapshot.settings.optimizer ? 'activo' : 'inactivo'}
                  </span>
                  <i
                    className={`subtle-dot ${snapshot.settings.optimizer ? 'positive-dot' : ''}`}
                  />
                </div>
                <span>
                  {money(actualCost)}
                  <small>USD · consumo real</small>
                </span>
              </button>
              <a
                className="sidebar-bottom-link"
                href={`${repository}#readme`}
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen size={15} />
                Documentación
                <ArrowUpRight size={12} />
              </a>
              <button
                className={`nav-item ${view === 'settings' ? 'active' : ''}`}
                onClick={() => navigate('settings')}
              >
                <Settings2 size={15} />
                <span>Configuración</span>
              </button>
              <div className="account-row">
                <span className="account-avatar">
                  {snapshot.user?.name.slice(0, 2).toUpperCase() || 'AE'}
                </span>
                <span>
                  <strong>{snapshot.user?.name || 'Mi espacio'}</strong>
                  <small>
                    {snapshot.user?.provider === 'local'
                      ? 'Sesión local'
                      : snapshot.user?.email || 'Explorando AERIS'}
                  </small>
                </span>
                <button
                  className="icon-button"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  onClick={() => void signout()}
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </aside>
          {mobileNav && (
            <button
              className="nav-scrim"
              aria-label="Cerrar navegación"
              onClick={() => setMobileNav(false)}
            />
          )}
          <main className="main-shell">
            <header className="app-topbar">
              <div className="topbar-breadcrumb">
                <button
                  className="icon-button mobile-menu"
                  aria-label="Abrir navegación"
                  onClick={() => setMobileNav(true)}
                >
                  <Menu size={17} />
                </button>
                <span className="breadcrumb-mark">
                  <Boxes size={13} />
                </span>
                <span>Workspace</span>
                <ChevronRight size={12} />
                <strong>{navigation.find((n) => n.id === view)?.label || 'Vista general'}</strong>
              </div>
              <DynamicIsland
                onSelect={setSelected}
                onNew={() => setNewMission(true)}
                onActivity={() => setNotifications(true)}
              />
              <div className="topbar-actions">
                <AppearanceSwitch />
                <span className="topbar-local">
                  <i className="subtle-dot positive-dot" />
                  Local workspace
                </span>
                <span className="topbar-divider" />
                <button
                  className="icon-button notification-button"
                  aria-label="Ver actividad"
                  onClick={() => setNotifications(true)}
                >
                  <Bell size={15} />
                  {active > 0 && <i />}
                </button>
                <a
                  className="icon-button"
                  aria-label="Abrir documentación"
                  href={`${repository}#readme`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <CircleHelp size={16} />
                </a>
              </div>
            </header>
            <div className="app-content">
              {view === 'lab' && <Lab />}
              {view === 'phone' && <Phone />}
              {view === 'overview' && (
                <Dashboard
                  onNew={() => setNewMission(true)}
                  onSelect={setSelected}
                  navigate={navigate}
                />
              )}
              {view === 'metrics' && (
                <Dashboard
                  onNew={() => setNewMission(true)}
                  onSelect={setSelected}
                  navigate={navigate}
                  metrics
                />
              )}
              {view === 'missions' && (
                <Missions onNew={() => setNewMission(true)} onSelect={setSelected} />
              )}
              {view === 'agents' && <Agents onSelect={setSelected} />}
              {view === 'factory' && <Factory onNew={() => setNewMission(true)} />}
              {view === 'terminal' && <TerminalView />}
              {view === 'files' && <Files />}
              {view === 'skills' && <Skills />}
              {view === 'router' && <Models router />}
              {view === 'providers' && <Models />}
              {view === 'context' && <ContextBrain />}
              {view === 'evolution' && <Evolution />}
              {view === 'settings' && <Configuration onProviders={() => navigate('providers')} />}
            </div>
          </main>
        </div>
      )}
      <NewMission open={newMission} onOpenChange={setNewMission} onCreated={setSelected} />
      <MissionDetail run={selected} onClose={() => setSelected(null)} />
      <Modal open={command} onOpenChange={setCommand} title="¿A dónde vamos?" command>
        <div className="command-search">
          <Search size={17} />
          <input
            autoFocus
            placeholder="Buscar secciones y misiones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en AERIS"
          />
        </div>
        <div className="command-results">
          {navigation
            .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
            .map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setPage('app')
                  navigate(item.id)
                  setCommand(false)
                  setQuery('')
                }}
              >
                <item.icon size={16} />
                {item.label}
                <ArrowRight size={13} />
              </button>
            ))}
          {query &&
            snapshot?.runs
              .filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 5)
              .map((run) => (
                <button
                  key={run.id}
                  onClick={() => {
                    setSelected(run)
                    setCommand(false)
                  }}
                >
                  <Layers3 size={16} />
                  {run.title}
                  <ArrowUpRight size={13} />
                </button>
              ))}
        </div>
        <div className="command-footer">
          <kbd>Esc</kbd> para cerrar<span>AERIS / Búsqueda</span>
        </div>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Actividad del espacio"
        description="Los últimos eventos del motor."
      >
        <div className="notification-list">
          {snapshot?.events
            .slice(-20)
            .reverse()
            .map((e) => (
              <div key={e.id}>
                <span className="subtle-dot positive-dot" />
                <p>
                  {e.text}
                  <small>{new Date(e.createdAt).toLocaleString('es-MX')}</small>
                </p>
              </div>
            ))}
        </div>
      </Modal>
      {engine.toast && (
        <div
          className={`toast ${engine.toast.error ? 'error' : ''}`}
          role={engine.toast.error ? 'alert' : 'status'}
        >
          {engine.toast.error ? <X size={15} /> : <Check size={15} />}
          <span>{engine.toast.message}</span>
          <button aria-label="Cerrar aviso" onClick={() => notify('')}>
            <X size={13} />
          </button>
        </div>
      )}
    </Workspace.Provider>
  )
}

function Landing({ onEnter, onLogin }: { onEnter: () => void; onLogin: () => void }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <AerisMark />
          <span>AERIS</span>
        </a>
        <nav>
          <a href={repository} target="_blank" rel="noreferrer">
            Código abierto
            <ArrowUpRight size={12} />
          </a>
        </nav>
        <div>
          <AppearanceSwitch />
          <button className="link-button" onClick={onLogin}>
            Iniciar sesión
          </button>
          <button className="button" onClick={onEnter}>
            Entrar al espacio
            <ArrowUpRight size={14} />
          </button>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <h1>
            Tu espacio de
            <br />
            <em>agentes.</em>
          </h1>
          <p>Analiza archivos, coordina modelos y verifica resultados.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={onEnter}>
              Explorar AERIS
              <ArrowUpRight size={15} />
            </button>
            <button className="button transparent" onClick={onLogin}>
              Crear mi cuenta
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="landing-studio" id="principios">
            <PixelStudio compact working={[false, false, false, false]} />
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <AerisMark small />
          <span>AERIS</span>
        </a>

        <a href={repository} target="_blank" rel="noreferrer">
          Construido en abierto
          <ArrowUpRight size={12} />
        </a>
        <span>2026</span>
      </footer>
    </div>
  )
}

function Login({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const { snapshot, refresh, notify } = useEngine()
  const [registering, setRegistering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(e.currentTarget)
    try {
      await api(registering ? '/auth/register' : '/auth/login', {
        email: form.get('email'),
        password: form.get('password'),
        ...(registering ? { name: form.get('name') } : {})
      })
      await refresh()
      onSuccess()
      location.reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="login-page">
      <button className="login-brand brand" onClick={onBack}>
        <AerisMark />
        <span>AERIS</span>
      </button>
      <div className="login-appearance">
        <AppearanceSwitch />
      </div>
      <div className="login-aside">
        <div className="login-orbit">
          <div />
          <div />
          <div />
          <AerisMark />
        </div>
      </div>
      <main className="login-main">
        <form onSubmit={submit}>
          <h2>{registering ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
          <div className="oauth-buttons">
            <a
              className={`button ${snapshot?.auth.google ? '' : 'unavailable'}`}
              href={snapshot?.auth.google ? '/api/auth/google' : undefined}
              aria-disabled={!snapshot?.auth.google}
              onClick={(e) => {
                if (!snapshot?.auth.google) {
                  e.preventDefault()
                  setError('Google estará disponible cuando se conecte al espacio de trabajo.')
                }
              }}
            >
              <span className="google-letter">G</span>Continuar con Google
            </a>
            <a
              className={`button ${snapshot?.auth.github ? '' : 'unavailable'}`}
              href={snapshot?.auth.github ? '/api/auth/github' : undefined}
              aria-disabled={!snapshot?.auth.github}
              onClick={(e) => {
                if (!snapshot?.auth.github) {
                  e.preventDefault()
                  setError('GitHub estará disponible cuando se conecte al espacio de trabajo.')
                }
              }}
            >
              <GitBranch size={17} />
              Continuar con GitHub
            </a>
          </div>
          <div className="login-divider">
            <span />o con tu correo
            <span />
          </div>
          {registering && (
            <label>
              Tu nombre
              <input
                name="name"
                placeholder="Cómo te llamas"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              placeholder="tu@empresa.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              placeholder={registering ? 'Al menos 10 caracteres' : 'Tu contraseña'}
              minLength={registering ? 10 : 1}
              maxLength={256}
              required
              autoComplete={registering ? 'new-password' : 'current-password'}
            />
          </label>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary login-submit" disabled={busy}>
            {busy ? <Loader2 className="spin" size={15} /> : null}
            {registering ? 'Crear cuenta' : 'Entrar a AERIS'}
            <ArrowRight size={15} />
          </button>
          <div className="login-switch">
            {registering ? '¿Ya tienes una cuenta?' : '¿Primera vez aquí?'}
            <button
              type="button"
              onClick={() => {
                setRegistering((v) => !v)
                setError('')
              }}
            >
              {registering ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
