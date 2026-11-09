import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function checkPhoneApi(endpoint: string, frontend: string, request = fetch) {
  const base = new URL(endpoint)
  if (base.protocol !== 'https:' || base.username || base.password)
    throw new Error('La API pública debe usar HTTPS sin credenciales en la URL.')
  const origin = new URL(frontend).origin
  const results: string[] = []
  const call = (path: string, init: RequestInit = {}) =>
    request(new URL(`/api${path}`, base), {
      ...init,
      signal: AbortSignal.timeout(15000)
    })
  const health = await call('/health')
  if (!health.ok || !(await health.json()).ok)
    throw new Error('El servicio no responde correctamente en /api/health.')
  results.push('API disponible por HTTPS')
  const options = await call('/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type'
    }
  })
  const allowedHeaders = options.headers.get('access-control-allow-headers')?.toLowerCase() || ''
  if (
    !options.ok ||
    options.headers.get('access-control-allow-origin') !== origin ||
    !allowedHeaders.includes('authorization') ||
    !allowedHeaders.includes('content-type')
  )
    throw new Error(
      'Preflight incompatible: permite el origen exacto de Pages y las cabeceras Authorization y Content-Type. Quita el CORS comodín de Caddy.'
    )
  results.push('Preflight de Pages y Authorization admitidos')
  const snapshot = await call('/snapshot', { headers: { Origin: origin } })
  if (!snapshot.ok || snapshot.headers.get('access-control-allow-origin') !== origin)
    throw new Error('La respuesta de la API no admite el origen de Pages.')
  if (!(await snapshot.json()).auth?.required)
    throw new Error('Activa AERIS_AUTH_REQUIRED=true en el servicio público.')
  results.push('API remota configurada con autenticación')
  const rejected = await call('/health', { headers: { Origin: 'https://untrusted.invalid' } })
  if (rejected.status !== 403)
    throw new Error('El servidor debe rechazar orígenes externos no autorizados.')
  results.push('Orígenes no autorizados rechazados')
  return results
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPhoneApi(
    process.argv[2] || 'https://aeris-phone.136-118-8-128.sslip.io',
    process.argv[3] || 'https://charbelochoa.github.io/000102030405060708090a0b0c0d0e0f/'
  )
    .then((results) => results.forEach((result) => console.log(result)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
