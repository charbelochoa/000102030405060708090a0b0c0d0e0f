import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPhoneApi } from '../scripts/check-phone-api'

const api = 'https://phone.example.com'
const frontend = 'https://example.github.io/aeris/'
function responses(wildcard = false, required = true): typeof fetch {
  return async (url, init) => {
    const headers = {
      'Access-Control-Allow-Origin': wildcard ? '*' : 'https://example.github.io',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type'
    }
    if ((init?.headers as Record<string, string>)?.Origin === 'https://untrusted.invalid')
      return new Response(null, { status: 403 })
    if (init?.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    return Response.json(String(url).endsWith('/health') ? { ok: true } : { auth: { required } }, {
      headers
    })
  }
}
test('phone deployment check accepts the Pages origin with protected API', async () => {
  assert.equal((await checkPhoneApi(api, frontend, responses())).length, 4)
})
test('phone deployment check rejects HTTP, wildcard CORS and unauthenticated public access', async () => {
  await assert.rejects(checkPhoneApi('http://phone.example.com', frontend, responses()), /HTTPS/)
  await assert.rejects(checkPhoneApi(api, frontend, responses(true)), /Preflight/)
  await assert.rejects(checkPhoneApi(api, frontend, responses(false, false)), /AERIS_AUTH_REQUIRED/)
})
