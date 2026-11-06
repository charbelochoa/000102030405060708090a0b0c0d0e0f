import type { Model, ProviderId, Settings, Usage } from './types'

export const providers: {
  id: ProviderId
  name: string
  ascii: string
  color: string
  env: string
  endpoint: string
}[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    ascii: '{*}',
    color: '#b9cfc0',
    env: 'OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    ascii: '\\|/',
    color: '#d49a7b',
    env: 'ANTHROPIC_API_KEY',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    ascii: '<+>',
    color: '#a3b4e0',
    env: 'GOOGLE_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
  },
  {
    id: 'xai',
    name: 'xAI',
    ascii: '/x/',
    color: '#d1d1d1',
    env: 'XAI_API_KEY',
    endpoint: 'https://api.x.ai/v1/chat/completions'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    ascii: '~v~',
    color: '#819ddb',
    env: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/chat/completions'
  }
]

const model = (
  id: string,
  name: string,
  provider: ProviderId,
  tier: Model['tier'],
  inputPrice: number,
  outputPrice: number,
  cachedPrice: number,
  source: string,
  cacheWritePrice = inputPrice
): Model => ({
  id,
  name,
  provider,
  tier,
  inputPrice,
  outputPrice,
  cachedPrice,
  cacheWritePrice,
  source,
  vision: true,
  checkedAt: '2026-11-06'
})

export const catalog: Model[] = [
  model(
    'gpt-5.4-nano',
    'GPT-5.4 nano',
    'openai',
    'low',
    0.2,
    1.25,
    0.02,
    'https://developers.openai.com/api/docs/models/gpt-5.4-mini'
  ),
  model(
    'gpt-5.4-mini',
    'GPT-5.4 mini',
    'openai',
    'medium',
    0.75,
    4.5,
    0.075,
    'https://developers.openai.com/api/docs/models/gpt-5.4-mini'
  ),
  model(
    'gpt-5.4',
    'GPT-5.4',
    'openai',
    'reasoning',
    2.5,
    15,
    0.25,
    'https://developers.openai.com/api/docs/models/gpt-5.4-mini'
  ),
  model(
    'claude-haiku-4-5',
    'Claude Haiku 4.5',
    'anthropic',
    'low',
    1,
    5,
    0.1,
    'https://platform.claude.com/docs/en/about-claude/pricing',
    1.25
  ),
  model(
    'claude-sonnet-5-5',
    'Claude Sonnet 5.5',
    'anthropic',
    'high',
    2,
    10,
    0.1,
    'https://platform.claude.com/docs/en/about-claude/pricing',
    2.5
  ),
  model(
    'gemini-3.1-flash-lite',
    'Gemini 3.1 Flash-Lite',
    'google',
    'low',
    0.25,
    1.5,
    0.025,
    'https://ai.google.dev/gemini-api/docs/pricing'
  ),
  model('grok-4.7', 'Grok 4.7', 'xai', 'high', 2, 6, 2, 'https://docs.x.ai/developers/models')
]

export const defaults: Settings = {
  router: true,
  routerModel: 'gpt-5.4-nano',
  optimizer: true,
  quietThreshold: 0.7,
  budget: 0.5,
  maxIterations: 8,
  target: 90,
  patience: 3,
  minDelta: 1,
  allowWrites: false,
  allowCommands: false,
  providers: providers.map((p) => ({ id: p.id, enabled: true, hasKey: false, freeTier: false })),
  models: catalog
}

export const emptyUsage = (): Usage => ({
  input: 0,
  output: 0,
  cached: 0,
  cacheWrite: 0,
  reasoning: 0
})
export const usd = (nano: string) => Number(BigInt(nano)) / 1e9
export const money = (nano: string, digits = 4) => `$${usd(nano).toFixed(digits)}`
export const stopLabels: Record<string, string> = {
  target: 'Objetivo alcanzado',
  budget: 'Límite de presupuesto',
  iterations: 'Máximo de iteraciones',
  plateau: 'Sin mejora significativa',
  user: 'Detenida por ti',
  error: 'Error del proveedor',
  recovered: 'Servidor reiniciado',
  timeout: 'Límite de tiempo: 10 minutos'
}
