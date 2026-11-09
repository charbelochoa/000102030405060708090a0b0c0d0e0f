let pending: string | undefined
let running = false
let failure: string | undefined
let updatedAt: string | undefined

export const databaseStatus = () => ({
  configured: Boolean(process.env.AERIS_FIREBASE_URL),
  pending: running || pending !== undefined,
  updatedAt,
  error: failure
})

export async function firebaseWrite(value: string, url: string, token: string) {
  const target = new URL(url)
  if (
    target.protocol !== 'https:' ||
    !/\.(firebaseio\.com|firebasedatabase\.app)$/.test(target.hostname)
  )
    throw new Error('URL de Firebase no válida.')
  target.pathname = target.pathname.replace(/\/$/, '') + '/aeris/snapshot.json'
  const response = await fetch(target, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted: value, updatedAt: new Date().toISOString() }),
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) throw new Error(`Firebase HTTP ${response.status}`)
}

export function replicate(value: string) {
  if (!process.env.AERIS_FIREBASE_URL) return
  pending = value
  if (running) return
  running = true
  void (async () => {
    try {
      while (pending !== undefined) {
        const current = pending
        pending = undefined
        const response = await fetch(
          'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
          { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) }
        )
        if (!response.ok) throw new Error('Credencial GCP no disponible para Firebase.')
        const token = (await response.json()) as { access_token: string }
        await firebaseWrite(current, process.env.AERIS_FIREBASE_URL!, token.access_token)
        failure = undefined
        updatedAt = new Date().toISOString()
      }
    } catch (error) {
      failure = (error as Error).message
      console.error('Réplica Firebase:', failure)
    } finally {
      running = false
    }
  })()
}
