import { z } from 'zod'
import { analyze, artifact, joinTables, inspect, searchDocument, vehicleModels } from './analysis'
import { planSchema } from '../shared/analysis'
import type { Run } from '../shared/types'
import { event } from './store'

const index = { type: 'integer', minimum: 0, maximum: 9 }
const optionalSheet = { type: 'string' }
export const evidenceDefinitions = [
  {
    name: 'join_tables',
    description:
      'Left join two full tables on an exact key. Right keys must be unique. Adds CSV attachment and reports verified match coverage.',
    parameters: {
      type: 'object',
      properties: {
        file_index: index,
        right_index: index,
        left_key: { type: 'string' },
        right_key: { type: 'string' },
        sheet: optionalSheet,
        right_sheet: optionalSheet
      },
      required: ['file_index', 'right_index', 'left_key', 'right_key']
    }
  },
  {
    name: 'inspect_document',
    description:
      'Inspect the complete attachment structure, columns, coverage, missing values and sheets.',
    parameters: {
      type: 'object',
      properties: { file_index: index, sheet: optionalSheet },
      required: ['file_index']
    }
  },
  {
    name: 'search_document',
    description: 'Find bounded text excerpts with file and page or paragraph citations.',
    parameters: {
      type: 'object',
      properties: { file_index: index, query: { type: 'string' } },
      required: ['file_index', 'query']
    }
  },
  {
    name: 'analyze_table',
    description:
      'Aggregate the full attachment using DuckDB. Verify the results and retain a chartable artifact. For money specify currency_column if present. Choose month for monthly ISO dates.',
    parameters: {
      type: 'object',
      properties: { file_index: index, sheet: optionalSheet, plan: z.toJSONSchema(planSchema) },
      required: ['file_index', 'plan']
    }
  },
  {
    name: 'create_chart',
    description: 'Select a bar or line chart of a verified analysis artifact from this mission.',
    parameters: {
      type: 'object',
      properties: {
        artifact_id: { type: 'string' },
        kind: { type: 'string', enum: ['bar', 'line'] }
      },
      required: ['artifact_id', 'kind']
    }
  },
  {
    name: 'vehicle_models',
    description:
      'Official NHTSA vPIC vehicle model records for one make and year. No prices or dealership inventory.',
    parameters: {
      type: 'object',
      properties: { make: { type: 'string' }, year: { type: 'integer' } },
      required: ['make', 'year']
    }
  }
]
export async function evidenceTool(
  name: string,
  args: Record<string, unknown>,
  run: Run,
  signal?: AbortSignal
) {
  if (name === 'vehicle_models') {
    const source = await vehicleModels(
      z.string().parse(args.make),
      z.number().parse(args.year),
      signal
    )
    const attachment = {
      name: 'NHTSA-' + args.make + '-' + args.year + '.json',
      type: 'application/json',
      data: Buffer.from(JSON.stringify(source.records)).toString('base64')
    }
    if (run.attachments.length >= 10 || attachment.data.length > 6666668)
      throw new Error('Límite de documentos derivados.')
    const file_index = run.attachments.push(attachment) - 1
    event(run.owner, 'source.external', source.source, run.id, {
      file_index,
      count: source.count,
      retrievedAt: source.retrievedAt
    })
    return {
      file_index,
      source: source.source,
      count: source.count,
      retrievedAt: source.retrievedAt,
      columns: ['Make_ID', 'Make_Name', 'Model_ID', 'Model_Name']
    }
  }
  if (name === 'create_chart') {
    const id = z.uuid().parse(args.artifact_id)
    if (!run.artifacts?.includes(id)) throw new Error('Este artefacto no pertenece a la misión.')
    const kind = z.enum(['bar', 'line']).parse(args.kind)
    const a = artifact(run.owner, id)
    ;(run.charts ||= {})[id] = kind
    event(run.owner, 'chart', a.source, run.id, { id, kind })
    return { artifact_id: id, kind, groups: a.points.length }
  }
  const file = run.attachments[z.number().int().min(0).max(9).parse(args.file_index)]
  if (!file) throw new Error('No se encontró el archivo adjunto.')
  const sheet = z.string().max(160).optional().parse(args.sheet)
  if (name === 'join_tables') {
    const right = run.attachments[z.number().int().min(0).max(9).parse(args.right_index)]
    if (!right || run.attachments.length >= 10)
      throw new Error('Documento derecho ausente o límite de documentos.')
    const { data: bytes, ...proof } = await joinTables(
      file,
      right,
      z.string().max(200).parse(args.left_key),
      z.string().max(200).parse(args.right_key),
      sheet,
      z.string().max(160).optional().parse(args.right_sheet),
      signal
    )
    const file_index =
      run.attachments.push({
        name: 'join-' + run.attachments.length + '.csv',
        type: 'text/csv',
        data: bytes
      }) - 1
    event(run.owner, 'join.verified', file.name + ' × ' + right.name, run.id, {
      ...proof,
      file_index
    })
    return { ...proof, file_index }
  }
  if (name === 'inspect_document') return inspect(file, sheet, signal)
  if (name === 'search_document')
    return searchDocument(run.owner, file, z.string().min(1).max(1000).parse(args.query), signal)
  const result = await analyze(run.owner, run.id, file, planSchema.parse(args.plan), sheet, signal)
  ;(run.artifacts ||= []).push(result.id)
  event(run.owner, 'analysis.verified', result.source, run.id, {
    id: result.id,
    sha256: result.sha256,
    rows: result.rowsMatched,
    plan: result.plan
  })
  return { ...result, points: result.points.slice(0, 80), groups: result.points.length }
}
