import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { data, cliToken, save } from './store'
import type { User } from '../shared/types'

export const required = process.env.AERIS_AUTH_REQUIRED === 'true'
export const publicUrl = (process.env.AERIS_PUBLIC_URL || 'http://localhost:5173').replace(
  /\/$/,
  ''
)
const secure = publicUrl.startsWith('https:')
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
export const cookieValue = (req: Request, name: string) =>
  req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
    ?.slice(name.length + 1)
export const safeUser = (u: User): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  provider: u.provider
})
export const localUser: User = {
  id: 'local',
  name: 'Mi espacio',
  email: 'local@aeris',
  provider: 'local'
}

export function identity(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.replace(/^Bearer /, '')
  if (
    bearer &&
    bearer.length === cliToken.length &&
    timingSafeEqual(Buffer.from(bearer), Buffer.from(cliToken))
  ) {
    req.aerisUser = localUser
    next()
    return
  }
  const cookie = cookieValue(req, 'aeris_session')
  if (cookie) {
    const session = data.sessions.find((s) => s.hash === digest(cookie) && s.expires > Date.now())
    const user =
      session &&
      (session.userId === 'local' && !required
        ? localUser
        : data.users.find((u) => u.id === session.userId))
    if (user) req.aerisUser = safeUser(user)
  }
  next()
}

declare global {
  namespace Express {
    interface Request {
      aerisUser?: User
    }
  }
}

export function login(res: Response, user: User) {
  const token = randomBytes(32).toString('hex')
  data.sessions = data.sessions.filter((s) => s.expires > Date.now())
  data.sessions.push({ hash: digest(token), userId: user.id, expires: Date.now() + 7 * 86_400_000 })
  save()
  res.cookie('aeris_session', token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86_400_000
  })
}

export function logout(req: Request, res: Response) {
  const cookie = cookieValue(req, 'aeris_session')
  if (cookie) data.sessions = data.sessions.filter((s) => s.hash !== digest(cookie))
  save()
  res.clearCookie('aeris_session', { path: '/' })
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.aerisUser) {
    res.status(401).json({ error: 'Inicia sesión para continuar.' })
    return
  }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.aerisUser || (req.aerisUser.id !== 'local' && req.aerisUser.id !== data.users[0]?.id)) {
    res.status(403).json({ error: 'Esta acción requiere la cuenta administradora del espacio.' })
    return
  }
  next()
}

export function register(email: string, password: string, name: string) {
  if (data.users.some((u) => u.email === email.toLowerCase() && u.provider === 'email'))
    throw new Error('Ya existe una cuenta con este correo.')
  const salt = randomBytes(16).toString('hex')
  const user = {
    id: randomUUID(),
    email: email.toLowerCase(),
    name,
    provider: 'email',
    salt,
    hash: scryptSync(password, salt, 64).toString('hex')
  }
  data.users.push(user)
  save()
  return safeUser(user)
}

export function authenticate(email: string, password: string) {
  const user = data.users.find((u) => u.email === email.toLowerCase() && u.provider === 'email')
  const hash = scryptSync(password, user?.salt || 'aeris-invalid', 64)
  if (!user?.hash || !timingSafeEqual(Buffer.from(user.hash, 'hex'), hash))
    throw new Error('Correo o contraseña incorrectos.')
  return safeUser(user)
}

const states = new Map<string, { provider: string; expires: number }>()

export function oauthStart(provider: string, res: Response) {
  const google = provider === 'google'
  if (!google && provider !== 'github') throw new Error('Proveedor desconocido.')
  const client = process.env[google ? 'GOOGLE_CLIENT_ID' : 'GITHUB_CLIENT_ID']
  const secret = process.env[google ? 'GOOGLE_CLIENT_SECRET' : 'GITHUB_CLIENT_SECRET']
  if (!client || !secret)
    throw new Error(`Configura las credenciales OAuth de ${provider} en el servidor.`)
  const state = randomBytes(32).toString('hex')
  for (const [key, value] of states) if (value.expires < Date.now()) states.delete(key)
  states.set(state, { provider, expires: Date.now() + 600_000 })
  res.cookie('aeris_oauth', state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 600_000
  })
  const url = new URL(
    google
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://github.com/login/oauth/authorize'
  )
  url.search = new URLSearchParams({
    client_id: client,
    redirect_uri: `${publicUrl}/api/auth/${provider}/callback`,
    response_type: 'code',
    scope: google ? 'openid email profile' : 'read:user user:email',
    state
  }).toString()
  res.redirect(url.toString())
}

export async function oauthCallback(provider: string, req: Request, res: Response) {
  const state = String(req.query.state || '')
  const entry = states.get(state)
  states.delete(state)
  if (
    !entry ||
    entry.provider !== provider ||
    entry.expires < Date.now() ||
    cookieValue(req, 'aeris_oauth') !== state ||
    typeof req.query.code !== 'string'
  )
    throw new Error('La sesión OAuth caducó. Vuelve a iniciar sesión.')
  const google = provider === 'google'
  const response = await fetch(
    google ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env[google ? 'GOOGLE_CLIENT_ID' : 'GITHUB_CLIENT_ID']!,
        client_secret: process.env[google ? 'GOOGLE_CLIENT_SECRET' : 'GITHUB_CLIENT_SECRET']!,
        code: req.query.code,
        grant_type: 'authorization_code',
        redirect_uri: `${publicUrl}/api/auth/${provider}/callback`
      }),
      signal: AbortSignal.timeout(20_000)
    }
  )
  const token = (await response.json()) as any
  if (!response.ok || !token.access_token) throw new Error('El proveedor no autorizó el acceso.')
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    'User-Agent': 'AERIS',
    Accept: 'application/json'
  }
  const profileResponse = await fetch(
    google ? 'https://openidconnect.googleapis.com/v1/userinfo' : 'https://api.github.com/user',
    { headers, signal: AbortSignal.timeout(20_000) }
  )
  if (!profileResponse.ok) throw new Error('No se pudo obtener el perfil.')
  const profile = (await profileResponse.json()) as any
  let email = profile.email
  if (google && profile.email_verified !== true)
    throw new Error('Google no confirmó el correo de la cuenta.')
  if (!google) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers,
      signal: AbortSignal.timeout(20_000)
    })
    const emails = (await emailsResponse.json()) as any
    email = Array.isArray(emails)
      ? emails.find((e: any) => e.primary && e.verified)?.email
      : undefined
  }
  if (!email) throw new Error('El proveedor no devolvió un correo verificado.')
  const id = `${provider}:${profile.sub || profile.id}`
  let user = data.users.find((u) => u.id === id)
  if (!user) {
    user = { id, email, name: profile.name || profile.login || email.split('@')[0], provider }
    data.users.push(user)
  }
  login(res, user)
  res.clearCookie('aeris_oauth', { path: '/api/auth' })
  res.redirect(`${publicUrl}/app`)
}
