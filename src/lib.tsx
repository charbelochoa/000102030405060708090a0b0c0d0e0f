import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Snapshot } from '../shared/types'

export const apiUrl = (path: string) =>
  `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api${path}`
const remoteApi = Boolean(import.meta.env.VITE_API_URL)

export async function apiFile(path: string) {
  const token = sessionStorage.getItem('aeris-session')
  const response = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`No se pudo descargar el archivo (${response.status}).`)
  return response.blob()
}

export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST'
): Promise<T> {
  const token = sessionStorage.getItem('aeris-session')
  const response = await fetch(apiUrl(path), {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(
      path.startsWith('/lab/') ||
        /^\/providers\/[^/]+\/models$/.test(path) ||
        path.startsWith('/benchmarks') ||
        path.startsWith('/evolution/cases')
        ? 150000
        : 15000
    )
  })
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('El motor todavía no está disponible. Reintentando la conexión.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Error ${response.status}`)
  if (result.sessionToken) sessionStorage.setItem('aeris-session', result.sessionToken)
  if (path === '/auth/logout') sessionStorage.removeItem('aeris-session')
  return result as T
}

interface WorkspaceContext {
  snapshot: Snapshot | null
  refresh: () => Promise<void>
  notify: (message: string, error?: boolean) => void
  connected: boolean
}
export const Workspace = createContext<WorkspaceContext>({
  snapshot: null,
  refresh: async () => {},
  notify: () => {},
  connected: false
})
export const useWorkspace = () => useContext(Workspace)

export function useEngine() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const initialized = useRef(false)
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [])
  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api<Snapshot>('/snapshot'))
      initialized.current = true
    } catch (e) {
      notify((e as Error).message, true)
    }
  }, [notify])
  useEffect(() => {
    void refresh()
    const retry = setInterval(() => {
      if (!initialized.current) void refresh()
    }, 3000)
    return () => {
      clearInterval(retry)
      clearTimeout(timer.current)
    }
  }, [refresh])
  useEffect(() => {
    if (!snapshot?.user) return
    if (remoteApi) {
      const controller = new AbortController()
      let retry: ReturnType<typeof setTimeout>
      const listen = async () => {
        try {
          const token = sessionStorage.getItem('aeris-session')
          const response = await fetch(apiUrl('/events'), {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal
          })
          if (!response.ok || !response.body) throw new Error('Eventos no disponibles')
          setConnected(true)
          const reader = response.body.getReader()
          try {
            while (!controller.signal.aborted) {
              const chunk = await reader.read()
              if (chunk.done) break
              void refresh()
            }
          } finally {
            reader.releaseLock()
          }
        } catch {
          setConnected(false)
        }
        if (!controller.signal.aborted) retry = setTimeout(() => void listen(), 3000)
      }
      void listen()
      return () => {
        controller.abort()
        clearTimeout(retry)
        setConnected(false)
      }
    }
    const events = new EventSource('/api/events')
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    events.onopen = () => {
      setConnected(true)
      void refresh()
    }
    events.onerror = () => setConnected(false)
    events.onmessage = () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refresh(), 100)
    }
    return () => {
      events.close()
      clearTimeout(refreshTimer)
    }
  }, [snapshot?.user?.id, refresh])
  useEffect(() => {
    if (!snapshot?.user) return
    const reconcile = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const interval = setInterval(reconcile, 2000)
    window.addEventListener('focus', reconcile)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', reconcile)
    }
  }, [snapshot?.user?.id, refresh])
  return { snapshot, connected, refresh, toast, notify }
}

export const formatTokens = (value: number) =>
  value >= 1e6
    ? `${(value / 1e6).toFixed(2)} M`
    : value >= 1000
      ? `${(value / 1000).toFixed(1)} k`
      : value.toLocaleString('es-MX')
export const shortTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
