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
    id: 'local',
    name: 'Inferencia local',
    ascii: '[L]',
    color: '#cccccc',
    env: 'AERIS_LOCAL_API_KEY',
    endpoint: 'http://127.0.0.1:8089/v1/chat/completions'
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    ascii: '[N]',
    color: '#cccccc',
    env: 'NVIDIA_API_KEY',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions'
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
  cacheWritePrice = inputPrice,
  vision = true
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
  vision,
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
    'gpt-4.1-nano',
    'GPT-4.1 nano',
    'openai',
    'low',
    0.22,
    1.3,
    0.025,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-4.1-mini',
    'GPT-4.1 mini',
    'openai',
    'medium',
    0.8,
    4.6,
    0.1,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-4.1',
    'GPT-4.1',
    'openai',
    'reasoning',
    2.6,
    15.5,
    0.5,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-4o-mini',
    'GPT-4o mini',
    'openai',
    'low',
    0.25,
    1.35,
    0.075,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-4o',
    'GPT-4o',
    'openai',
    'reasoning',
    2.75,
    16,
    1.25,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'o4-mini',
    'OpenAI o4-mini',
    'openai',
    'reasoning',
    2.8,
    16.5,
    0.275,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'o3',
    'OpenAI o3',
    'openai',
    'reasoning',
    10,
    40,
    2.5,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-6',
    'OpenAI 6 (GPT-6)',
    'openai',
    'reasoning',
    3.0,
    18.0,
    0.3,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'open-ai-6',
    'open ai 6',
    'openai',
    'reasoning',
    3.05,
    18.2,
    0.3,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'openai-6',
    'OpenAI 6',
    'openai',
    'reasoning',
    3.1,
    18.5,
    0.3,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-6-luna',
    'OpenAI 6 Luna',
    'openai',
    'reasoning',
    3.2,
    19.0,
    0.32,
    'https://platform.openai.com/docs/models'
  ),
  model(
    '6-luna',
    '6 luna',
    'openai',
    'medium',
    0.9,
    4.8,
    0.09,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'sol-6.1',
    'sol 6.1',
    'openai',
    'reasoning',
    3.4,
    19.5,
    0.34,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'openai-sol-6.1',
    'OpenAI Sol 6.1',
    'openai',
    'reasoning',
    3.5,
    20.0,
    0.35,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-6.1',
    'OpenAI GPT-6.1',
    'openai',
    'reasoning',
    3.6,
    21.0,
    0.36,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-6-mini',
    'OpenAI 6 Mini',
    'openai',
    'medium',
    0.85,
    4.7,
    0.085,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-6-nano',
    'OpenAI 6 Nano',
    'openai',
    'low',
    0.24,
    1.32,
    0.024,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-5',
    'OpenAI GPT-5',
    'openai',
    'reasoning',
    2.9,
    17.0,
    0.29,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-5-mini',
    'OpenAI GPT-5 Mini',
    'openai',
    'medium',
    0.82,
    4.65,
    0.082,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'gpt-5-nano',
    'OpenAI GPT-5 Nano',
    'openai',
    'low',
    0.23,
    1.31,
    0.023,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'o3-pro',
    'OpenAI o3-pro',
    'openai',
    'reasoning',
    15,
    60,
    3.75,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'o3-mini',
    'OpenAI o3-mini',
    'openai',
    'reasoning',
    2.95,
    17.2,
    0.3,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'o1',
    'OpenAI o1',
    'openai',
    'reasoning',
    12,
    48,
    3.0,
    'https://platform.openai.com/docs/models'
  ),
  model(
    'o1-mini',
    'OpenAI o1-mini',
    'openai',
    'medium',
    1.1,
    4.9,
    0.25,
    'https://platform.openai.com/docs/models'
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
    'claude-sonnet-4-6',
    'Claude Sonnet 4.6',
    'anthropic',
    'medium',
    3,
    15,
    0.3,
    'https://platform.claude.com/docs/en/about-claude/pricing',
    3.75
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
    'claude-opus-4-6',
    'Claude Opus 4.6',
    'anthropic',
    'reasoning',
    5,
    25,
    0.5,
    'https://platform.claude.com/docs/en/about-claude/pricing',
    6.25
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
  model(
    'gemini-2.5-flash',
    'Gemini 2.5 Flash',
    'google',
    'low',
    0.3,
    2.5,
    0.03,
    'https://ai.google.dev/gemini-api/docs/pricing'
  ),
  model(
    'gemini-3.1-flash',
    'Gemini 3.1 Flash',
    'google',
    'medium',
    0.5,
    3,
    0.05,
    'https://ai.google.dev/gemini-api/docs/pricing'
  ),
  model(
    'gemini-2.5-pro',
    'Gemini 2.5 Pro',
    'google',
    'high',
    1.25,
    10,
    0.125,
    'https://ai.google.dev/gemini-api/docs/pricing'
  ),
  model(
    'gemini-3.1-pro',
    'Gemini 3.1 Pro',
    'google',
    'reasoning',
    2,
    12,
    0.2,
    'https://ai.google.dev/gemini-api/docs/pricing'
  ),
  model(
    'deepseek-chat',
    'DeepSeek V3.2 Chat',
    'deepseek',
    'medium',
    0.27,
    1.1,
    0.07,
    'https://api-docs.deepseek.com/quick_start/pricing',
    0.27,
    false
  ),
  model(
    'deepseek-reasoner',
    'DeepSeek R1 Reasoner',
    'deepseek',
    'reasoning',
    0.55,
    2.19,
    0.14,
    'https://api-docs.deepseek.com/quick_start/pricing',
    0.55,
    false
  ),
  model(
    'grok-3-mini',
    'Grok 3 Mini',
    'xai',
    'low',
    0.3,
    0.5,
    0.075,
    'https://docs.x.ai/developers/models',
    0.3,
    false
  ),
  model(
    'grok-4-fast',
    'Grok 4 Fast',
    'xai',
    'medium',
    0.8,
    3.2,
    0.2,
    'https://docs.x.ai/developers/models'
  ),
  model('grok-4.7', 'Grok 4.7', 'xai', 'high', 2, 6, 2, 'https://docs.x.ai/developers/models'),
  model(
    'grok-4.7-reasoning',
    'Grok 4.7 Reasoning',
    'xai',
    'reasoning',
    3,
    15,
    0.75,
    'https://docs.x.ai/developers/models'
  ),
  model(
    'meta/llama-3.3-70b-instruct',
    'Llama 3.3 70B',
    'nvidia',
    'medium',
    0,
    0,
    0,
    'https://build.nvidia.com/meta/llama-3_3-70b-instruct',
    0,
    false
  ),
  model(
    'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    'Nemotron Ultra 253B',
    'nvidia',
    'high',
    0,
    0,
    0,
    'https://build.nvidia.com/nvidia/llama-3_1-nemotron-ultra-253b-v1',
    0,
    false
  ),
  model(
    'deepseek-ai/deepseek-r1',
    'DeepSeek R1 (NVIDIA NIM)',
    'nvidia',
    'reasoning',
    0,
    0,
    0,
    'https://build.nvidia.com/deepseek-ai/deepseek-r1',
    0,
    false
  ),
  model(
    'qwen/qwen2.5-coder-32b-instruct',
    'Qwen 2.5 Coder 32B (NIM)',
    'nvidia',
    'medium',
    0,
    0,
    0,
    'https://build.nvidia.com/qwen/qwen2_5-coder-32b-instruct',
    0,
    false
  ),
  model(
    'qwen2.5-0.5b-instruct',
    'Qwen2.5 0.5B',
    'local',
    'low',
    0,
    0,
    0,
    'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    0,
    false
  ),
  model(
    'qwen2.5-coder-7b-instruct',
    'Qwen2.5 Coder 7B (Local)',
    'local',
    'medium',
    0,
    0,
    0,
    'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    0,
    false
  ),
  model(
    'llama-3.2-3b-instruct',
    'Llama 3.2 3B (Local)',
    'local',
    'low',
    0,
    0,
    0,
    'https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct',
    0,
    false
  ),
  model(
    'deepseek-r1-distill-qwen-14b',
    'DeepSeek R1 Distill 14B (Local)',
    'local',
    'reasoning',
    0,
    0,
    0,
    'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
    0,
    false
  )
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
  delivered: 'Resultado entregado',
  target: 'Objetivo alcanzado',
  budget: 'Límite de presupuesto',
  iterations: 'Máximo de iteraciones',
  plateau: 'Sin mejora significativa',
  user: 'Detenida por ti',
  error: 'Error de ejecución',
  recovered: 'Servidor reiniciado',
  timeout: 'Límite de tiempo: 10 minutos'
}
