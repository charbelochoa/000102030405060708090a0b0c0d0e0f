import { providers } from '../shared/catalog'
import type { Attachment, Model, Usage } from '../shared/types'
import { getKey } from './store'
import { normalizeUsage } from './accounting'

export interface ToolCall {
  id: string
  name: string
  arguments: string
}
export interface ChatMessage {
  role: string
  content: any
  tool_call_id?: string
  tool_calls?: any[]
}
export interface Completion {
  text: string
  calls: ToolCall[]
  usage: Usage | null
  raw: any
  actualModel: string
}

export function userContent(text: string, attachments: Attachment[], anthropic: boolean) {
  if (!attachments.length) return text
  const blocks: any[] = [{ type: 'text', text }]
  for (const file of attachments) {
    if (file.type.startsWith('image/')) {
      blocks.push(
        anthropic
          ? { type: 'image', source: { type: 'base64', media_type: file.type, data: file.data } }
          : { type: 'image_url', image_url: { url: `data:${file.type};base64,${file.data}` } }
      )
    } else {
      blocks.push({
        type: 'text',
        text: JSON.stringify({
          attachment: file.name,
          type: file.type,
          file_index: attachments.indexOf(file),
          access:
            'Use inspect_document, search_document or analyze_table. Never infer totals from excerpts.'
        })
      })
    }
  }
  return blocks
}

export async function complete(
  model: Model,
  messages: ChatMessage[],
  options: {
    tools?: any[]
    maxOutput: number
    jsonSchema?: Record<string, unknown>
    signal: AbortSignal
  }
): Promise<Completion> {
  const provider = providers.find((p) => p.id === model.provider)!
  const key = getKey(model.provider)
  if (!key) throw new Error(`Configura la API de ${provider.name} antes de usar ${model.name}.`)
  const anthropic = model.provider === 'anthropic'
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
  const body: Record<string, any> = anthropic
    ? {
        model: model.id,
        system,
        messages: messages.filter((m) => m.role !== 'system'),
        max_tokens: options.maxOutput
      }
    : {
        model: model.id,
        messages,
        ...(model.provider === 'openai'
          ? { max_completion_tokens: options.maxOutput }
          : { max_tokens: options.maxOutput })
      }
  if (model.provider === 'local' && !options.tools?.length) {
    body.temperature = 0
    body.seed = 42
    body.response_format = options.jsonSchema
      ? { type: 'json_schema', json_schema: { name: 'analysis', schema: options.jsonSchema } }
      : { type: 'json_object' }
  }
  if (options.tools?.length)
    body.tools = anthropic
      ? options.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters
        }))
      : options.tools.map((t) => ({ type: 'function', function: t }))
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (anthropic) {
    headers['x-api-key'] = key
    headers['anthropic-version'] = '2023-06-01'
  } else headers.Authorization = `Bearer ${key}`
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.any([options.signal, AbortSignal.timeout(120_000)])
  })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as any
    const error = detail?.error?.type || detail?.error?.code || 'request_failed'
    throw new Error(
      `${provider.name}: HTTP ${response.status} (${String(error).slice(0, 100)}). Revisa la clave, el modelo y la cuota.`
    )
  }
  const raw = (await response.json()) as any
  if (anthropic) {
    return {
      text: (raw.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n'),
      calls: (raw.content || [])
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({ id: b.id, name: b.name, arguments: JSON.stringify(b.input) })),
      usage: normalizeUsage(raw.usage, true),
      raw: raw.content,
      actualModel: raw.model || model.id
    }
  }
  const result = raw.choices?.[0]?.message
  if (!result) throw new Error(`${provider.name} devolvió una respuesta sin mensaje.`)
  return {
    text: result.content || '',
    calls: (result.tool_calls || []).map((t: any) => ({
      id: t.id,
      name: t.function.name,
      arguments: t.function.arguments
    })),
    usage: normalizeUsage(raw.usage),
    raw: result,
    actualModel: raw.model || model.id
  }
}
