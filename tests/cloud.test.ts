import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = await mkdtemp(join(tmpdir(), 'aeris-cloud-'))
process.env.AERIS_WORKSPACE = root
process.env.AERIS_DATA_DIR = root
process.env.AERIS_EMBEDDED = 'true'
process.env.AERIS_FIREBASE_URL = ''
const { discoverModels, providerFetch } = await import('../server/providers')
const { setKey } = await import('../server/store')
const { firebaseWrite } = await import('../server/realtime')
after(() => rm(root, { recursive: true, force: true }))

test('model discovery follows pagination and never publishes credentials', async () => {
  delete process.env.ANTHROPIC_API_KEY
  setKey('anthropic', 'test-secret')
  const original = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = async (url, init) => {
    urls.push(String(url))
    assert.equal((init?.headers as Record<string, string>)['x-api-key'], 'test-secret')
    return Response.json(
      urls.length === 1
        ? { data: [{ id: 'model-a', display_name: 'A' }], has_more: true, last_id: 'model-a' }
        : { data: [{ id: 'model-b' }], has_more: false }
    )
  }
  try {
    assert.deepEqual(await discoverModels('anthropic'), [
      { id: 'model-a', name: 'A' },
      { id: 'model-b', name: 'model-b' }
    ])
    assert.match(urls[1], /after_id=model-a/)
  } finally {
    globalThis.fetch = original
  }
})

test('provider network errors explain access failure without exposing the request', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'EACCES' } })
  }
  try {
    await assert.rejects(providerFetch('openai', 'https://api.openai.com', {}), /EACCES/)
  } finally {
    globalThis.fetch = original
  }
})

test('Firebase replica uses authenticated HTTPS and keeps the snapshot encrypted', async () => {
  await assert.rejects(firebaseWrite('encrypted', 'http://example.com', 'secret'), /no válida/)
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://test.firebaseio.com/aeris/snapshot.json')
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer secret')
    assert.equal(JSON.parse(String(init?.body)).encrypted, 'iv:tag:ciphertext')
    return Response.json(null)
  }
  try {
    await firebaseWrite('iv:tag:ciphertext', 'https://test.firebaseio.com', 'secret')
  } finally {
    globalThis.fetch = original
  }
})
