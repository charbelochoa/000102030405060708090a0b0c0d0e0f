import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { dataDir } from './store'
import {
  fileSchema,
  planSchema,
  type AnalysisArtifact,
  type AnalysisPlan,
  type Profile
} from '../shared/analysis'
import type { Attachment } from '../shared/types'

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
function directory(owner: string) {
  const path = join(dataDir, 'evidence', sha(owner))
  mkdirSync(path, { recursive: true })
  return path
}
let jobs = 0
async function worker<T>(input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (jobs >= 4) throw new Error('El motor de datos está ocupado.')
  const frozen = process.env.AERIS_ANALYSIS_WORKER
  const devPython = resolve(
    'build/python-tools',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
  )
  const interpreter =
    frozen || process.env.AERIS_PYTHON || (existsSync(devPython) ? devPython : 'python')
  const args = frozen ? [] : ['-I', resolve('tools/analysis_worker.py')]
  jobs++
  try {
    return await new Promise<T>((done, reject) => {
      const child = execFile(
        interpreter,
        args,
        {
          timeout: 45000,
          windowsHide: true,
          signal,
          maxBuffer: input.action === 'index' ? 40_000_000 : 8_000_000,
          env: {
            SYSTEMROOT: process.env.SYSTEMROOT,
            PATH: process.env.PATH,
            TEMP: process.env.TEMP,
            TMP: process.env.TMP,
            LANG: 'C.UTF-8',
            PYTHONUTF8: '1'
          }
        },
        (err, stdout) => {
          try {
            const result = JSON.parse(stdout)
            if (err || result.error) throw new Error(result.error || 'Falló el análisis.')
            done(result)
          } catch (e) {
            reject(stdout ? e : new Error('Motor de documentos no disponible o tiempo agotado.'))
          }
        }
      )
      child.stdin?.on('error', () => {})
      child.stdin?.end(JSON.stringify(input))
    })
  } finally {
    jobs--
  }
}
export function storeFile(owner: string, input: Attachment) {
  const file = fileSchema.parse(input)
  const raw = Buffer.from(file.data, 'base64')
  if (!raw.length || raw.length > 5_000_000) throw new Error('Archivo vacío o superior a 5 MB.')
  const id = sha(raw)
  const path = join(directory(owner), id + '.bin')
  if (!existsSync(path)) writeFileSync(path, raw, { mode: 0o600 })
  return id
}
export function recoverFile(owner: string, id: string, name: string, type: string): Attachment {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Documento inválido.')
  return { name, type, data: readFileSync(join(directory(owner), id + '.bin')).toString('base64') }
}
export async function inspect(file: Attachment, sheet?: string, signal?: AbortSignal) {
  return worker<Profile>({ action: 'inspect', file, sheet }, signal)
}
type Passage = { location: string; offset: number; text: string }
type DocumentIndex = {
  sha256: string
  warnings: string[]
  chunks: Passage[]
  terms: Record<string, number[]>
}
function words(text: string) {
  return [
    ...new Set(
      text
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .match(/[\p{L}\p{N}]{2,}/gu) || []
    )
  ]
}
export async function searchDocument(
  owner: string,
  file: Attachment,
  query: string,
  signal?: AbortSignal
) {
  const key = sha(Buffer.from(file.data, 'base64'))
  const path = join(directory(owner), sha('index-v1:' + key + ':' + file.type) + '.index.json')
  let index: DocumentIndex
  if (existsSync(path)) index = JSON.parse(readFileSync(path, 'utf8'))
  else {
    const extracted = await worker<Omit<DocumentIndex, 'terms'>>({ action: 'index', file }, signal)
    const terms: Record<string, number[]> = Object.create(null)
    extracted.chunks.forEach((p, i) => {
      for (const word of words(p.text)) (terms[word] ||= []).push(i)
    })
    index = {
      sha256: extracted.sha256,
      warnings: extracted.warnings,
      chunks: extracted.chunks,
      terms
    }
    const temp = path + '.' + randomUUID() + '.tmp'
    writeFileSync(temp, JSON.stringify(index), { mode: 0o600 })
    renameSync(temp, path)
  }
  const scores = new Map<number, number>()
  for (const w of words(query)) {
    const matches = Object.hasOwn(index.terms, w) ? index.terms[w] : []
    for (const i of matches)
      scores.set(i, (scores.get(i) || 0) + Math.log1p(index.chunks.length / matches.length))
  }
  const hits = [...scores]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 4)
    .map(([i]) => index.chunks[i])
  return { source: file.name, sha256: index.sha256, hits, warnings: index.warnings }
}
export async function analyze(
  owner: string,
  runId: string,
  file: Attachment,
  plan: AnalysisPlan,
  sheet?: string,
  signal?: AbortSignal
) {
  const normalized = planSchema.parse(plan)
  const result = await worker<Omit<AnalysisArtifact, 'id' | 'runId' | 'plan'>>(
    { action: 'analyze', file, plan: normalized, sheet },
    signal
  )
  const artifact: AnalysisArtifact = { ...result, id: randomUUID(), runId, plan: normalized }
  writeFileSync(join(directory(owner), artifact.id + '.json'), JSON.stringify(artifact), {
    mode: 0o600
  })
  return artifact
}
export function artifact(owner: string, id: string): AnalysisArtifact {
  const path = join(directory(owner), z.uuid().parse(id) + '.json')
  if (!existsSync(path)) throw new Error('Artefacto no encontrado.')
  return JSON.parse(readFileSync(path, 'utf8'))
}
export async function vehicleModels(make: string, year: number, signal?: AbortSignal) {
  z.string()
    .regex(/^[\p{L}\d .-]{1,60}$/u)
    .parse(make)
  z.number()
    .int()
    .min(1981)
    .max(new Date().getFullYear() + 1)
    .parse(year)
  const url =
    'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/' +
    encodeURIComponent(make) +
    '/modelyear/' +
    year +
    '?format=json'
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])])
  })
  if (!response.ok) throw new Error('NHTSA: HTTP ' + response.status)
  const result = z
    .object({
      Count: z.number().int(),
      Results: z
        .array(
          z.object({
            Make_ID: z.number(),
            Make_Name: z.string(),
            Model_ID: z.number(),
            Model_Name: z.string()
          })
        )
        .max(10000)
    })
    .parse(await response.json())
  if (result.Count !== result.Results.length) throw new Error('Conteo de NHTSA inconsistente.')
  return {
    source: url,
    retrievedAt: new Date().toISOString(),
    count: result.Count,
    records: result.Results
  }
}

export function joinTables(
  file: Attachment,
  right: Attachment,
  left_key: string,
  right_key: string,
  sheet?: string,
  right_sheet?: string,
  signal?: AbortSignal
) {
  return worker<{
    data: string
    rowsTotal: number
    matched: number
    sha256: string
    rightSha256: string
    warnings: string[]
  }>({ action: 'join', file, right, left_key, right_key, sheet, right_sheet }, signal)
}
