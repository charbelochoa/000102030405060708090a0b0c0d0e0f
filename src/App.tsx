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
import { Evolution } from './Evolution'
import { ContextBrain } from './ContextBrain'
import { money } from '../shared/catalog'
import type { Run } from '../shared/types'

const repository = 'https://github.com/charbelochoa/000102030405060708090a0b0c0d0e0f'
const navigation = [
  { id: 'overview', label: 'Vista general', icon: Boxes },
  { id: 'missions', label: 'Misiones', icon: Layers3 },
  { id: 'agents', label: 'Agentes', icon: Users },
  { id: 'metrics', label: 'Métricas y progreso', icon: Activity },
  { id: 'evolution', label: 'Evolución del sistema', icon: GitBranch },
  { id: 'factory', label: 'La fábrica', icon: FactoryIcon },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'files', label: 'Archivos', icon: FileCode2 },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'context', label: 'Cerebro de contexto', icon: GitBranch },
  { id: 'router', label: 'Router de modelos', icon: Route },
  { id: 'providers', label: 'Proveedores y APIs', icon: KeyRound },
  { id: 'settings', label: 'Configuración', icon: Settings2 }
]

export function App() {
  const engine = useEngine()
  const { snapshot, refresh, notify } = engine
  const [page, setPage] = useState(
    location.pathname.startsWith('/app')
      ? 'app'
      : location.pathname === '/login'
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
      target === 'app' ? `/app#${view}` : target === 'login' ? '/login' : '/'
    )
    window.scrollTo(0, 0)
  }
  const navigate = (target: string) => {
    const next = navigation.some((n) => n.id === target) ? target : 'overview'
    setView(next)
    setMobileNav(false)
    history.replaceState({}, '', `/app#${next}`)
  }
  useEffect(() => {
    if (page !== 'app' || !snapshot || snapshot.user || starting.current) return
    starting.current = true
    api(snapshot.auth.required ? '/auth/demo' : '/auth/local', {})
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
        location.pathname.startsWith('/app')
          ? 'app'
          : location.pathname === '/login'
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
        <Login onSuccess={() => go('app')} onBack={() => go('landing')} onDemo={() => go('app')} />
      ) : !snapshot ? (
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
              href="/"
              onClick={(e) => {
                e.preventDefault()
                go('landing')
              }}
            >
              <AerisMark />
              <span>AERIS</span>
              <span className="brand-beta">BETA</span>
            </a>
            <button
              className="workspace-selector"
              onClick={() => notify('Estás en el espacio local de AERIS.')}
            >
              <span className="workspace-avatar">a</span>
              <span>
                <strong>Mi espacio de trabajo</strong>
                <small>Personal workspace</small>
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
                  {item.id === 'factory' && <span className="nav-new">NUEVO</span>}
                </button>
              ))}
              <div className="nav-section-label second">HERRAMIENTAS</div>
              {navigation.slice(6, 12).map((item) => (
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
                <p>
                  Mejores resultados.
                  <br />
                  Menos recursos.
                </p>
                <div className="optimizer-line">
                  <i />
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
              <div>
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
              <div>
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
              {snapshot.runs.some((r) => r.mode === 'demo') && (
                <div className="demo-banner">
                  <span>
                    <span className="demo-badge">DEMO</span>Un vistazo a lo que puedes construir.
                    <span className="demo-banner-detail">
                      Las métricas de ejemplo están identificadas y no generan cargos.
                    </span>
                  </span>
                  <button onClick={() => navigate('providers')}>
                    Conectar mis modelos
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
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
              {view === 'settings' && <Configuration />}
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
        <a className="brand" href="/">
          <AerisMark />
          <span>AERIS</span>
        </a>
        <nav>
          <a href="#principios">El sistema</a>
          <a href="#progreso">Progreso visible</a>
          <a href={repository} target="_blank" rel="noreferrer">
            Código abierto
            <ArrowUpRight size={12} />
          </a>
        </nav>
        <div>
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
          <div className="release-note">
            <span>INTRODUCING AERIS</span>
            <i />
            Intelligence, in progress.
            <ArrowUpRight size={12} />
          </div>
          <h1>
            Un buen equipo
            <br />
            se vuelve <em>mejor.</em>
          </h1>
          <p>
            Un espacio para agentes que resuelven, colaboran
            <br className="desktop-break" /> y aprenden de cada resultado. Con cada recurso a la
            vista.
          </p>
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
          <span className="hero-subnote">Tu terminal. Tu navegador. Tu escritorio.</span>
          <div className="hero-workspace">
            <div className="hero-window-bar">
              <AerisMark small />
              <span>AERIS / EL TRABAJO EVOLUCIONA</span>
              <i />
              <span>WORKSPACE 01</span>
            </div>
            <div className="hero-mini-sidebar">
              <span className="mini-nav active">
                <Boxes size={13} />
                Vista general
              </span>
              <span className="mini-nav">
                <Users size={13} />
                Agentes
              </span>
              <span className="mini-nav">
                <Activity size={13} />
                Métricas
              </span>
              <span className="mini-nav">
                <Terminal size={13} />
                Terminal
              </span>
              <div>
                <Zap size={13} />
                Optimizador activo
              </div>
            </div>
            <div className="hero-demo-main">
              <span className="eyebrow">CADA ITERACIÓN CUENTA</span>
              <h2>El siguiente paso es mejor.</h2>
              <div className="hero-demo-stats">
                <span>
                  Calidad evaluada
                  <strong>
                    93.2<small>/100</small>
                  </strong>
                </span>
                <span>
                  Iteraciones
                  <strong>
                    07<small>de 08</small>
                  </strong>
                </span>
                <span>
                  Coste simulado<strong>$0.014</strong>
                </span>
              </div>
              <svg viewBox="0 0 680 180" aria-label="Ilustración del progreso de evaluación">
                <defs>
                  <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#99bd9d" stopOpacity=".18" />
                    <stop offset="1" stopColor="#99bd9d" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[35, 85, 135].map((y) => (
                  <path key={y} d={`M0 ${y}H680`} stroke="#2b302b" strokeDasharray="3 5" />
                ))}
                <path
                  d="M0 157C75 153 60 130 120 126S190 126 220 92 280 84 325 70 390 78 435 48 525 53 555 23 630 26 680 8V180H0Z"
                  fill="url(#hero-area)"
                />
                <path
                  d="M0 157C75 153 60 130 120 126S190 126 220 92 280 84 325 70 390 78 435 48 525 53 555 23 630 26 680 8"
                  stroke="#a6c9ae"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="680" cy="8" r="4" fill="#b2d2b7" />
              </svg>
              <div className="hero-demo-footer">
                <span>
                  <i className="subtle-dot positive-dot" />
                  Objetivo alcanzado
                </span>
                <span>Demostración · sin consumo real</span>
              </div>
            </div>
          </div>
        </section>
        <section className="landing-principles" id="principios">
          <div>
            <span className="eyebrow">DISEÑADO PARA HACER MÁS CON MENOS</span>
            <h2>Inteligencia con criterio.</h2>
          </div>
          <article>
            <GitBranch size={22} />
            <h3>Juntos, llegan más lejos.</h3>
            <p>
              Agentes que comparten hallazgos, revisan su trabajo y se coordinan entre terminales.
            </p>
          </article>
          <article>
            <Activity size={22} />
            <h3>Cada mejora tiene evidencia.</h3>
            <p>
              Construcción, evaluación y refinamiento. Una curva de progreso y una razón para
              detenerse.
            </p>
          </article>
          <article>
            <Zap size={22} />
            <h3>Cada token tiene un propósito.</h3>
            <p>
              El modelo adecuado, instrucciones compactas y presupuestos explícitos en cada misión.
            </p>
          </article>
        </section>
        <section className="landing-closing" id="progreso">
          <span className="eyebrow">MENOS CAJA NEGRA. MÁS PERSPECTIVA.</span>
          <h2>
            No solo veas el resultado.
            <br />
            <span>Entiende cómo llegó hasta ahí.</span>
          </h2>
          <button className="button primary" onClick={onEnter}>
            Abrir mi espacio
            <ArrowUpRight size={15} />
          </button>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="brand" href="/">
          <AerisMark small />
          <span>AERIS</span>
        </a>
        <span>Intelligence, in progress.</span>
        <a href={repository} target="_blank" rel="noreferrer">
          Construido en abierto
          <ArrowUpRight size={12} />
        </a>
        <span>2026</span>
      </footer>
    </div>
  )
}

function Login({
  onSuccess,
  onBack,
  onDemo
}: {
  onSuccess: () => void
  onBack: () => void
  onDemo: () => void
}) {
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
      <div className="login-aside">
        <span className="eyebrow">INTELLIGENCE, IN PROGRESS.</span>
        <h1>
          El siguiente gran paso
          <br />
          lo damos <em>en equipo.</em>
        </h1>
        <div className="login-orbit">
          <div />
          <div />
          <div />
          <AerisMark />
        </div>
        <p>Un espacio para construir, medir y evolucionar.</p>
      </div>
      <main className="login-main">
        <form onSubmit={submit}>
          <span className="eyebrow">TU ESPACIO DE INTELIGENCIA</span>
          <h2>{registering ? 'Empieza algo mejor.' : 'Bienvenido de vuelta.'}</h2>
          <p>
            {registering
              ? 'Crea una cuenta personal o con el correo de tu empresa.'
              : 'Retoma tus misiones. Tu equipo te está esperando.'}
          </p>
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
          <button type="button" className="login-demo" onClick={onDemo}>
            Explorar la demostración
            <ArrowUpRight size={13} />
          </button>
        </form>
        <div className="login-bottom">
          <Shield size={12} />
          Tu espacio. Tus modelos. Tus decisiones.
        </div>
      </main>
    </div>
  )
}
