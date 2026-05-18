import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const SOURCE_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const LOCAL_SOURCE = path.resolve('data', 'raw', 'model_prices_and_context_window.json')
const OUTPUT_PATH = path.resolve('public', 'data', 'llm-prices.json')

const preferLocal = process.argv.includes('--prefer-local')
const now = new Date().toISOString()
const FLAGSHIP_MODEL_ALLOWLIST = new Set([
  'gpt-5.5-pro',
  'gpt-5.5',
  'claude-opus-4.7',
  'gemini-3.1-pro',
  'qwen3.6-plus',
  'kimi-k2.5',
  'moonshotai.kimi-k2.5',
  'zai.glm-5',
  'glm-4.7',
])

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function perMillion(value) {
  const numeric = numberOrNull(value)
  return numeric === null ? null : numeric * 1_000_000
}

function stripDateSuffix(value) {
  return value
    .replace(/[-_@/]?(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-2]\d|3[01])(?:[-_]?v\d+)?$/i, '')
    .replace(/[-_@/]?(20\d{2})[-_.]?(0[1-9]|1[0-2])$/i, '')
}

function stripProviderPath(key, provider) {
  const pieces = key.split('/').filter(Boolean)
  const lowerProvider = String(provider || '').toLowerCase()
  const providerAliases = new Set([
    lowerProvider,
    'openai',
    'anthropic',
    'google',
    'deepseek',
    'qwen',
    'meta-llama',
    'mistralai',
    'cohere',
    'x-ai',
    'alibaba',
  ])

  const genericPrefixes = new Set([
    'azure',
    'global',
    'global-standard',
    'eu',
    'us',
    'apac',
    'bedrock',
    'invoke',
    'vertex_ai',
    'gemini',
    'openrouter',
    'vercel_ai_gateway',
    'deepinfra',
    'fireworks_ai',
    'together_ai',
    'groq',
    'cerebras',
    'dashscope',
    'github_copilot',
    'oci',
    'databricks',
    'heroku',
    'snowflake',
  ])

  let candidate = pieces[pieces.length - 1] || key

  if (candidate.includes('.') && !candidate.startsWith('gpt-')) {
    const dotPieces = candidate.split('.')
    candidate = dotPieces[dotPieces.length - 1]
  }

  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const current = pieces[index]
    const lower = current.toLowerCase()
    if (!genericPrefixes.has(lower) && !providerAliases.has(lower) && !/^[-a-z]+-\d+$/.test(lower)) {
      candidate = current
      break
    }
  }

  return candidate
}

function normalizeModelName(key, provider) {
  const rawModel = stripProviderPath(key, provider).toLowerCase()
  let model = rawModel
    .toLowerCase()
    .replace(/^models\//, '')
    .replace(/^model\//, '')
    .replace(/^(anthropic|amazon|meta|mistral|cohere|qwen|google|openai)\./, '')
    .replace(/^(anthropic|google|openai|deepseek|qwen|meta-llama|mistralai)\//, '')
    .replace(/[:@]0$/, '')
    .replace(/-v\d+:?0?$/i, '')
    .replace(/-latest$/i, '')
    .replace(/-preview-tts$/i, '')
    .replace(/-preview$/i, '')
    .replace(/-realtime-preview$/i, '')
    .replace(/-audio-preview$/i, '')
    .replace(/-instruct$/i, '')

  model = stripDateSuffix(model)
    .replace(/[-_.]v\d+$/i, '')
    .replace(/-0\d\d\d$/i, '')
    .replace(/-$/, '')

  const aliases = [
    [/^claude-opus-4[-.]7(?:-.+)?$/, 'claude-opus-4.7'],
    [/^claude-opus-4[-.]6(?:-.+)?$/, 'claude-opus-4.6'],
    [/^claude-opus-4[-.]5(?:-.+)?$/, 'claude-opus-4.5'],
    [/^claude-opus-4[-.]1(?:-.+)?$/, 'claude-opus-4.1'],
    [/^gpt-4o-mini(?:-.+)?$/, 'gpt-4o-mini'],
    [/^gpt-4o(?:-.+)?$/, 'gpt-4o'],
    [/^gpt-4\.1-mini(?:-.+)?$/, 'gpt-4.1-mini'],
    [/^gpt-4\.1(?:-.+)?$/, 'gpt-4.1'],
    [/^o3-mini(?:-.+)?$/, 'o3-mini'],
    [/^o3(?:-.+)?$/, 'o3'],
    [/^o4-mini(?:-.+)?$/, 'o4-mini'],
    [/^claude-3-5-sonnet(?:-.+)?$/, 'claude-3-5-sonnet'],
    [/^claude-3-7-sonnet(?:-.+)?$/, 'claude-3-7-sonnet'],
    [/^claude-sonnet-4(?:-.+)?$/, 'claude-sonnet-4'],
    [/^claude-opus-4(?:-.+)?$/, 'claude-opus-4'],
    [/^gemini-2\.5-pro(?:-.+)?$/, 'gemini-2.5-pro'],
    [/^gemini-2\.5-flash(?:-.+)?$/, 'gemini-2.5-flash'],
    [/^gemini-2\.0-flash(?:-.+)?$/, 'gemini-2.0-flash'],
    [/^deepseek-r1(?:-.+)?$/, 'deepseek-r1'],
    [/^deepseek-chat(?:-.+)?$/, 'deepseek-chat'],
    [/^qwen3-coder(?:-.+)?$/, 'qwen3-coder'],
    [/^qwen3(?:-.+)?$/, 'qwen3'],
    [/^qwen-plus(?:-.+)?$/, 'qwen-plus'],
    [/^qwen-max(?:-.+)?$/, 'qwen-max'],
    [/^llama-3\.3-70b(?:-.+)?$/, 'llama-3.3-70b'],
    [/^llama-3\.1-405b(?:-.+)?$/, 'llama-3.1-405b'],
  ]

  if (rawModel.includes('deepseek-chat')) return 'deepseek-chat'

  for (const [pattern, replacement] of aliases) {
    if (pattern.test(model)) return replacement
  }

  model = model.replace(/-chat$/i, '')

  return model
}

function modelFamily(model) {
  if (/^(gpt|o\d)/.test(model)) return 'OpenAI'
  if (model.startsWith('claude')) return 'Anthropic'
  if (model.startsWith('gemini')) return 'Google'
  if (model.startsWith('deepseek')) return 'DeepSeek'
  if (model.startsWith('qwen')) return 'Qwen'
  if (model.includes('kimi') || model.includes('moonshot')) return 'Moonshot'
  if (model.includes('glm') || model.includes('zai')) return 'ZAI'
  if (model.includes('llama')) return 'Llama'
  if (model.includes('mistral') || model.includes('mixtral')) return 'Mistral'
  if (model.includes('command')) return 'Cohere'
  return 'Other'
}

function providerLabel(provider) {
  const labels = {
    anthropic: 'Anthropic',
    azure: 'Azure OpenAI',
    azure_ai: 'Azure AI',
    bedrock: 'AWS Bedrock',
    bedrock_converse: 'AWS Bedrock',
    cerebras: 'Cerebras',
    dashscope: 'DashScope',
    databricks: 'Databricks',
    deepinfra: 'DeepInfra',
    deepseek: 'DeepSeek',
    fireworks_ai: 'Fireworks',
    gemini: 'Google AI Studio',
    groq: 'Groq',
    heroku: 'Heroku',
    mistral: 'Mistral',
    oci: 'Oracle OCI',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    perplexity: 'Perplexity',
    replicate: 'Replicate',
    together_ai: 'Together AI',
    vertex_ai: 'Google Vertex AI',
    'vertex_ai-anthropic_models': 'Vertex AI Anthropic',
    'vertex_ai-ai21_models': 'Vertex AI AI21',
    'vertex_ai-language-models': 'Vertex AI',
    vercel_ai_gateway: 'Vercel AI Gateway',
    xai: 'xAI',
    zai: 'ZAI',
    ai21: 'AI21',
    cohere_chat: 'Cohere',
  }

  return labels[provider] || String(provider || 'unknown').replaceAll('_', ' ')
}

function average(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function summarizeModel(modelId, entries) {
  const cleanPriced = entries.filter(
    (entry) => entry.blendedPrice !== null && entry.blendedPrice > 0 && !entry.isExtremePrice,
  )
  const priced = cleanPriced.length ? cleanPriced : entries.filter((entry) => entry.blendedPrice !== null)
  const cheapest = priced[0] || null
  const highest = priced[priced.length - 1] || null
  const spreadRatio =
    cheapest && highest && cheapest.blendedPrice > 0 ? highest.blendedPrice / cheapest.blendedPrice : null

  return {
    id: modelId,
    label: modelId,
    family: modelFamily(modelId),
    providerCount: new Set(entries.map((entry) => entry.provider)).size,
    entryCount: entries.length,
    outlierCount: entries.filter((entry) => entry.isExtremePrice || entry.isZeroPrice).length,
    minBlendedPrice: round(cheapest?.blendedPrice ?? null),
    maxBlendedPrice: round(highest?.blendedPrice ?? null),
    spreadRatio: round(spreadRatio, 2),
    medianContext: round(
      average(entries.map((entry) => entry.contextWindow).filter((value) => value !== null)),
      0,
    ),
    cheapestProvider: cheapest?.providerLabel ?? null,
    highestProvider: highest?.providerLabel ?? null,
    entries,
  }
}

async function fetchSource() {
  if (preferLocal && existsSync(LOCAL_SOURCE)) {
    return {
      raw: await readFile(LOCAL_SOURCE, 'utf8'),
      fetchedFrom: LOCAL_SOURCE,
    }
  }

  let response = null
  let lastError = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(SOURCE_URL, {
        headers: {
          'User-Agent': 'just-llmprice-data-builder',
        },
      })
      if (response.ok) break
    } catch (error) {
      lastError = error
    }

    await sleep(attempt * 1200)
  }

  if (!response?.ok) {
    if (existsSync(LOCAL_SOURCE)) {
      return {
        raw: await readFile(LOCAL_SOURCE, 'utf8'),
        fetchedFrom: LOCAL_SOURCE,
      }
    }

    const suffix = response
      ? `${response.status} ${response.statusText}`
      : lastError instanceof Error
        ? lastError.message
        : 'unknown network error'
    throw new Error(`Failed to fetch LiteLLM price data: ${suffix}`)
  }

  const raw = await response.text()
  await mkdir(path.dirname(LOCAL_SOURCE), { recursive: true })
  await writeFile(LOCAL_SOURCE, raw)
  return {
    raw,
    fetchedFrom: SOURCE_URL,
  }
}

const { raw, fetchedFrom } = await fetchSource()
const source = JSON.parse(raw)
const groups = new Map()

for (const [key, item] of Object.entries(source)) {
  if (key === 'sample_spec' || !item || typeof item !== 'object') continue

  const mode = item.mode || 'chat'
  if (!['chat', 'completion', 'responses'].includes(mode)) continue

  const inputPrice = perMillion(item.input_cost_per_token)
  const outputPrice = perMillion(item.output_cost_per_token)
  if (inputPrice === null && outputPrice === null) continue

  const provider = item.litellm_provider || key.split('/')[0] || 'unknown'
  const normalizedModel = normalizeModelName(key, provider)
  if (!normalizedModel || normalizedModel.length < 2) continue

  const blendedPrice = average([inputPrice, outputPrice])
  const isZeroPrice = blendedPrice === 0 || inputPrice === 0 || outputPrice === 0
  const isExtremePrice = blendedPrice !== null && blendedPrice > 500
  const contextWindow = numberOrNull(item.max_input_tokens ?? item.max_tokens)
  const outputWindow = numberOrNull(item.max_output_tokens)

  const entry = {
    sourceKey: key,
    provider,
    providerLabel: providerLabel(provider),
    inputPrice: round(inputPrice),
    outputPrice: round(outputPrice),
    blendedPrice: round(blendedPrice),
    isZeroPrice,
    isExtremePrice,
    contextWindow,
    outputWindow,
    mode,
    supportsVision: Boolean(item.supports_vision),
    supportsFunctionCalling: Boolean(item.supports_function_calling),
    supportsReasoning: Boolean(item.supports_reasoning),
    deprecationDate: item.deprecation_date || null,
  }

  if (!groups.has(normalizedModel)) groups.set(normalizedModel, [])
  groups.get(normalizedModel).push(entry)
}

const models = Array.from(groups.entries()).map(([modelId, entries]) => {
  const dedupedByProvider = new Map()

  for (const entry of entries) {
    const current = dedupedByProvider.get(entry.provider)
    if (
      !current ||
      (entry.blendedPrice !== null && current.blendedPrice !== null && entry.blendedPrice < current.blendedPrice) ||
      (entry.blendedPrice !== null && current.blendedPrice === null)
    ) {
      dedupedByProvider.set(entry.provider, entry)
    }
  }

  const deduped = Array.from(dedupedByProvider.values()).sort((a, b) => {
    if (a.blendedPrice === null) return 1
    if (b.blendedPrice === null) return -1
    return a.blendedPrice - b.blendedPrice
  })

  return summarizeModel(modelId, deduped)
})

const visibleModels = models
  .filter((model) => model.providerCount >= 2 || FLAGSHIP_MODEL_ALLOWLIST.has(model.id))
  .sort((a, b) => {
    const scoreA = (a.spreadRatio || 0) * 4 + a.providerCount
    const scoreB = (b.spreadRatio || 0) * 4 + b.providerCount
    return scoreB - scoreA
  })

const familyCounts = visibleModels.reduce((acc, model) => {
  acc[model.family] = (acc[model.family] || 0) + 1
  return acc
}, {})

const payload = {
  meta: {
    generatedAt: now,
    sourceUrl: SOURCE_URL,
    fetchedFrom,
    rawModelCount: Object.keys(source).length,
    modelCount: visibleModels.length,
    entryCount: visibleModels.reduce((sum, model) => sum + model.entryCount, 0),
  },
  familyCounts,
  leaderboards: {
    priceSpread: visibleModels
      .filter((model) => model.spreadRatio)
      .toSorted((a, b) => (b.spreadRatio || 0) - (a.spreadRatio || 0))
      .slice(0, 12)
      .map(({ id, family, providerCount, minBlendedPrice, maxBlendedPrice, spreadRatio, cheapestProvider, highestProvider }) => ({
        id,
        family,
        providerCount,
        minBlendedPrice,
        maxBlendedPrice,
        spreadRatio,
        cheapestProvider,
        highestProvider,
      })),
    cheapestAverage: visibleModels
      .filter((model) => model.minBlendedPrice)
      .toSorted((a, b) => (a.minBlendedPrice || 0) - (b.minBlendedPrice || 0))
      .slice(0, 12)
      .map(({ id, family, providerCount, minBlendedPrice, cheapestProvider }) => ({
        id,
        family,
        providerCount,
        minBlendedPrice,
        cheapestProvider,
      })),
    mostProviders: visibleModels
      .toSorted((a, b) => b.providerCount - a.providerCount)
      .slice(0, 12)
      .map(({ id, family, providerCount, spreadRatio }) => ({
        id,
        family,
        providerCount,
        spreadRatio,
      })),
  },
  models: visibleModels,
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`)

console.log(
  `Generated ${payload.meta.modelCount} model groups and ${payload.meta.entryCount} ranked provider entries -> ${OUTPUT_PATH}`,
)
