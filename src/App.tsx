import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  Database,
  Flame,
  GitBranch,
  Radar,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import './App.css'

type PriceMetric = 'blendedPrice' | 'inputPrice' | 'outputPrice'
type Currency = 'USD' | 'CNY'
type BenchmarkMode = 'aa' | 'overall' | 'coding' | 'math' | 'agent'

type PriceEntry = {
  sourceKey: string
  provider: string
  providerLabel: string
  inputPrice: number | null
  outputPrice: number | null
  blendedPrice: number | null
  contextWindow: number | null
  outputWindow: number | null
  mode: string
  supportsVision: boolean
  supportsFunctionCalling: boolean
  supportsReasoning: boolean
  isZeroPrice: boolean
  isExtremePrice: boolean
  deprecationDate: string | null
}

type ModelSummary = {
  id: string
  label: string
  family: string
  providerCount: number
  entryCount: number
  outlierCount: number
  minBlendedPrice: number | null
  maxBlendedPrice: number | null
  spreadRatio: number | null
  medianContext: number | null
  cheapestProvider: string | null
  highestProvider: string | null
  entries: PriceEntry[]
}

type LeaderboardItem = {
  id: string
  family: string
  providerCount: number
  minBlendedPrice?: number | null
  maxBlendedPrice?: number | null
  spreadRatio?: number | null
  cheapestProvider?: string | null
  highestProvider?: string | null
}

type RadarAxis = {
  label: string
  value: number
}

type PlatformInsight = {
  provider: string
  label: string
  modelCount: number
  comparisons: number
  wins: number
  topThree: number
  avgRelative: number
  score: number
  bestModels: Array<{
    id: string
    family: string
    price: number | null
  }>
}

type BrandMeta = {
  initials: string
  logoUrl?: string
}

type PlatformLogoMeta = BrandMeta

type BenchmarkModel = {
  modelName: string
  modelCode: string | null
  organization: string | null
  aaScore: number | null
  aaRank: number | null
  arenaScore: number | null
  arenaRank: number | null
  benchmarks: Record<string, number>
  categoryScores: Record<string, number | null>
  compositeScore: number | null
  matchKeys: string[]
}

type BenchmarkData = {
  meta: {
    generatedAt: string
    sourceName: string
    sourceUrl: string
    fetchedFrom: string
    license: string
    extractedRowCount: number
    modelCount: number
    note: string
  }
  benchmarkKeys: string[]
  categories: Record<string, string[]>
  models: BenchmarkModel[]
}

type AbilityValueItem = {
  model: ModelSummary
  benchmark: BenchmarkModel
  matchedKey: string
  score: number
  price: number
  pricePerPoint: number
  valueScore: number
}

type PriceData = {
  meta: {
    generatedAt: string
    sourceUrl: string
    rawModelCount: number
    modelCount: number
    entryCount: number
  }
  familyCounts: Record<string, number>
  leaderboards: {
    priceSpread: LeaderboardItem[]
    cheapestAverage: LeaderboardItem[]
    mostProviders: LeaderboardItem[]
  }
  models: ModelSummary[]
}

const metricLabels: Record<PriceMetric, string> = {
  blendedPrice: '综合价',
  inputPrice: '输入价',
  outputPrice: '输出价',
}

const benchmarkModeLabels: Record<BenchmarkMode, string> = {
  aa: 'AA 综合',
  overall: '综合基准',
  coding: '编程',
  math: '数学',
  agent: 'Agent',
}

const litellmSourceUrl = 'https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json'

const familyOrder = [
  '全部',
  'OpenAI',
  'Anthropic',
  'Google',
  'DeepSeek',
  'Qwen',
  'Moonshot',
  'ZAI',
  'Llama',
  'Mistral',
  'Cohere',
  'Other',
]
const defaultModelCandidates = ['gpt-5.5-pro', 'gpt-5.5', 'gpt-5.4-pro', 'gpt-5', 'gpt-4o-mini']
const flagshipModelIds = [
  'gpt-5.5-pro',
  'gpt-5.5',
  'claude-opus-4.7',
  'gemini-3.1-pro',
  'qwen3.6-plus',
  'kimi-k2.5',
  'zai.glm-5',
  'glm-4.7',
  'deepseek-r1',
  'qwen3',
  'gpt-oss-120b',
  'claude-sonnet-4',
  'gemini-3-pro',
  'qwen3-coder',
]
const fallbackHotModelIds = ['deepseek-r1', 'qwen3', 'gpt-4o-mini', 'claude-sonnet-4', 'gemini-2.5-pro', 'gpt-oss-120b']
const localLogo = (file: string) => `${import.meta.env.BASE_URL}logos/${file}`
const brandMeta: Record<string, BrandMeta> = {
  OpenAI: { initials: 'OA', logoUrl: localLogo('brand-openai.svg') },
  Anthropic: { initials: 'A', logoUrl: localLogo('brand-anthropic.svg') },
  Google: { initials: 'G', logoUrl: localLogo('brand-google.svg') },
  DeepSeek: { initials: 'D', logoUrl: localLogo('brand-deepseek.svg') },
  Qwen: { initials: 'Q', logoUrl: localLogo('brand-qwen.svg') },
  Moonshot: { initials: 'K', logoUrl: localLogo('brand-moonshot.svg') },
  ZAI: { initials: 'Z', logoUrl: localLogo('brand-zai.ico') },
  Llama: { initials: 'M', logoUrl: localLogo('brand-meta.svg') },
  Mistral: { initials: 'M', logoUrl: localLogo('brand-mistral.svg') },
  Cohere: { initials: 'C', logoUrl: localLogo('brand-cohere.ico') },
  Other: { initials: 'AI' },
}
const platformLogoMeta: Record<string, PlatformLogoMeta> = {
  openai: { initials: 'OA', logoUrl: localLogo('platform-openai.png') },
  azure: { initials: 'AZ', logoUrl: localLogo('platform-azure.png') },
  azure_ai: { initials: 'AI', logoUrl: localLogo('platform-azure.png') },
  vertex_ai: { initials: 'G', logoUrl: localLogo('platform-google-cloud.svg') },
  'vertex_ai-language-models': { initials: 'VE', logoUrl: localLogo('platform-google-cloud.svg') },
  'vertex_ai-anthropic_models': { initials: 'VA', logoUrl: localLogo('platform-google-cloud.svg') },
  gemini: { initials: 'G', logoUrl: localLogo('platform-gemini.svg') },
  anthropic: { initials: 'A', logoUrl: localLogo('platform-anthropic.svg') },
  bedrock: { initials: 'AWS', logoUrl: localLogo('platform-aws.png') },
  bedrock_converse: { initials: 'AWS', logoUrl: localLogo('platform-aws.png') },
  openrouter: { initials: 'OR', logoUrl: localLogo('platform-openrouter.ico') },
  vercel_ai_gateway: { initials: 'V', logoUrl: localLogo('platform-vercel.svg') },
  deepinfra: { initials: 'DI', logoUrl: localLogo('platform-deepinfra.ico') },
  fireworks_ai: { initials: 'FW', logoUrl: localLogo('platform-fireworks.ico') },
  together_ai: { initials: 'TG', logoUrl: localLogo('platform-together.png') },
  xai: { initials: 'xAI', logoUrl: localLogo('platform-xai.ico') },
  ai21: { initials: '21', logoUrl: localLogo('platform-ai21.png') },
  'vertex_ai-ai21_models': { initials: '21', logoUrl: localLogo('platform-ai21.png') },
  zai: { initials: 'Z', logoUrl: localLogo('platform-zai.ico') },
  deepseek: { initials: 'DS', logoUrl: localLogo('platform-deepseek.svg') },
  groq: { initials: 'GR', logoUrl: localLogo('platform-groq.ico') },
  cerebras: { initials: 'CB', logoUrl: localLogo('platform-cerebras.png') },
  baseten: { initials: 'B', logoUrl: localLogo('platform-baseten.ico') },
  novita: { initials: 'N', logoUrl: localLogo('platform-novita.ico') },
  replicate: { initials: 'R', logoUrl: localLogo('platform-replicate.svg') },
  perplexity: { initials: 'P', logoUrl: localLogo('platform-perplexity.svg') },
  mistral: { initials: 'M', logoUrl: localLogo('platform-mistral.svg') },
  oci: { initials: 'OCI', logoUrl: localLogo('platform-oracle.png') },
  cohere_chat: { initials: 'C', logoUrl: localLogo('platform-cohere.ico') },
}
const cnyRate = 7.2

function formatPrice(value: number | null | undefined, currency: Currency) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  const converted = currency === 'CNY' ? value * cnyRate : value
  const prefix = currency === 'CNY' ? '¥' : '$'
  if (converted === 0) return `${prefix}0`
  if (converted < 0.01) return `${prefix}${converted.toFixed(4)}`
  if (converted < 1) return `${prefix}${converted.toFixed(3)}`
  if (converted < 100) return `${prefix}${converted.toFixed(2)}`
  return `${prefix}${Math.round(converted).toLocaleString()}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return value.toLocaleString()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function cleanEntries(entries: PriceEntry[], includeZero: boolean, includeExtreme: boolean, metric: PriceMetric) {
  return entries
    .filter((entry) => includeZero || !entry.isZeroPrice)
    .filter((entry) => includeExtreme || !entry.isExtremePrice)
    .filter((entry) => entry[metric] !== null)
    .toSorted((a, b) => (a[metric] ?? Number.POSITIVE_INFINITY) - (b[metric] ?? Number.POSITIVE_INFINITY))
}

function familyClass(family: string) {
  return `family family-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max)
}

function lowerPriceScore(value: number | null | undefined) {
  if (!value || value <= 0) return 0
  const low = Math.log10(0.02)
  const high = Math.log10(20)
  return clamp(((high - Math.log10(Math.max(value, 0.02))) / (high - low)) * 100)
}

function spreadOpportunityScore(value: number | null | undefined) {
  if (!value || value <= 1) return 12
  return clamp((Math.log10(Math.min(value, 300)) / Math.log10(300)) * 100)
}

function capabilityScore(model: ModelSummary) {
  const entries = model.entries.filter((entry) => !entry.isExtremePrice)
  const hasReasoning = entries.some((entry) => entry.supportsReasoning)
  const hasVision = entries.some((entry) => entry.supportsVision)
  const hasTools = entries.some((entry) => entry.supportsFunctionCalling)
  return clamp(24 + (hasReasoning ? 24 : 0) + (hasVision ? 22 : 0) + (hasTools ? 22 : 0) + Math.min(model.providerCount, 8))
}

function radarAxes(model: ModelSummary): RadarAxis[] {
  return [
    { label: '低价', value: lowerPriceScore(model.minBlendedPrice) },
    { label: '平台', value: clamp((model.providerCount / 20) * 100) },
    { label: '窗口', value: clamp(((model.medianContext ?? 0) / 1_000_000) * 100) },
    { label: '价差', value: spreadOpportunityScore(model.spreadRatio) },
    { label: '能力', value: capabilityScore(model) },
  ]
}

function resolveDefaultModel(models: ModelSummary[]) {
  for (const id of defaultModelCandidates) {
    if (models.some((model) => model.id === id)) return id
  }
  return models[0]?.id ?? ''
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function buildPlatformInsights(models: ModelSummary[]): PlatformInsight[] {
  const buckets = new Map<
    string,
    {
      provider: string
      label: string
      modelIds: Set<string>
      comparisons: number
      wins: number
      topThree: number
      relativeSum: number
      bestModels: PlatformInsight['bestModels']
    }
  >()

  for (const model of models) {
    const entries = cleanEntries(model.entries, false, false, 'blendedPrice')
    const cheapestPrice = entries[0]?.blendedPrice
    if (!cheapestPrice || cheapestPrice <= 0) continue

    entries.forEach((entry, index) => {
      if (!entry.blendedPrice || entry.blendedPrice <= 0) return
      const key = entry.provider
      const current =
        buckets.get(key) ??
        {
          provider: entry.provider,
          label: entry.providerLabel,
          modelIds: new Set<string>(),
          comparisons: 0,
          wins: 0,
          topThree: 0,
          relativeSum: 0,
          bestModels: [],
        }

      const relative = entry.blendedPrice / cheapestPrice
      current.modelIds.add(model.id)
      current.comparisons += 1
      current.relativeSum += relative
      if (relative <= 1.02) {
        current.wins += 1
        current.bestModels.push({ id: model.id, family: model.family, price: entry.blendedPrice })
      }
      if (index < 3) current.topThree += 1
      buckets.set(key, current)
    })
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const modelCount = bucket.modelIds.size
      const avgRelative = bucket.relativeSum / bucket.comparisons
      const winRate = bucket.wins / bucket.comparisons
      const topThreeRate = bucket.topThree / bucket.comparisons
      const coverageScore = clamp((Math.log2(modelCount + 1) / Math.log2(42)) * 100)
      const priceScore = clamp(((2.4 - avgRelative) / 1.4) * 100)
      const score = coverageScore * 0.28 + winRate * 100 * 0.34 + topThreeRate * 100 * 0.24 + priceScore * 0.14

      return {
        provider: bucket.provider,
        label: bucket.label,
        modelCount,
        comparisons: bucket.comparisons,
        wins: bucket.wins,
        topThree: bucket.topThree,
        avgRelative,
        score,
        bestModels: bucket.bestModels
          .toSorted((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))
          .slice(0, 3),
      }
    })
    .filter((item) => item.modelCount >= 5)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 8)
}

function normalizeBenchmarkKey(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/preview/g, '')
    .replace(/instruct/g, '')
    .replace(/thinking/g, '')
    .replace(/xhigh|high|medium|low|max/g, '')
    .replace(/[_./]+/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function benchmarkStrength(model: BenchmarkModel) {
  return model.aaScore ?? model.compositeScore ?? model.arenaScore ?? 0
}

function buildBenchmarkIndex(models: BenchmarkModel[]) {
  const index = new Map<string, BenchmarkModel>()

  models.forEach((model) => {
    model.matchKeys.forEach((key) => {
      const normalized = normalizeBenchmarkKey(key)
      if (!normalized) return
      const current = index.get(normalized)
      if (!current || benchmarkStrength(model) > benchmarkStrength(current)) {
        index.set(normalized, model)
      }
    })
  })

  return index
}

function addBenchmarkKeyVariant(keys: Set<string>, value: string | null | undefined) {
  const normalized = normalizeBenchmarkKey(value)
  if (!normalized) return
  keys.add(normalized)

  const suffixes = ['-chat-latest', '-chat', '-latest', '-default', '-v1']
  suffixes.forEach((suffix) => {
    if (normalized.endsWith(suffix)) keys.add(normalized.slice(0, -suffix.length))
  })

  const vendorPrefixes = ['openai-', 'anthropic-', 'google-', 'moonshotai-', 'zai-', 'qwen-', 'meta-', 'mistral-']
  vendorPrefixes.forEach((prefix) => {
    if (normalized.startsWith(prefix)) keys.add(normalized.slice(prefix.length))
  })
}

function benchmarkKeysForModel(model: ModelSummary) {
  const keys = new Set<string>()
  addBenchmarkKeyVariant(keys, model.id)
  addBenchmarkKeyVariant(keys, model.label)

  model.entries.forEach((entry) => {
    addBenchmarkKeyVariant(keys, entry.sourceKey)
    const sourceParts = entry.sourceKey.split(/[/:@]+/).filter(Boolean)
    sourceParts.slice(-3).forEach((part) => addBenchmarkKeyVariant(keys, part))
  })

  return Array.from(keys)
}

function findBenchmarkMatch(model: ModelSummary, index: Map<string, BenchmarkModel>) {
  for (const key of benchmarkKeysForModel(model)) {
    const benchmark = index.get(key)
    if (benchmark) return { benchmark, matchedKey: key }
  }
  return null
}

function scoreForBenchmark(model: BenchmarkModel, mode: BenchmarkMode) {
  const value =
    mode === 'aa'
      ? model.aaScore ?? model.compositeScore
      : model.categoryScores[mode] ?? model.aaScore ?? model.compositeScore
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function formatBenchmarkScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(value >= 10 ? 1 : 2)
}

function benchmarkRadarAxes(model: BenchmarkModel): RadarAxis[] {
  return [
    { label: 'AA', value: model.aaScore ?? model.compositeScore ?? 0 },
    { label: '综合', value: model.categoryScores.overall ?? 0 },
    { label: '编程', value: model.categoryScores.coding ?? 0 },
    { label: '数学', value: model.categoryScores.math ?? 0 },
    { label: 'Agent', value: model.categoryScores.agent ?? 0 },
  ]
}

function buildAbilityValueItems(
  models: ModelSummary[],
  benchmarkIndex: Map<string, BenchmarkModel>,
  mode: BenchmarkMode,
) {
  return models
    .map<AbilityValueItem | null>((model) => {
      const match = findBenchmarkMatch(model, benchmarkIndex)
      if (!match) return null
      const score = scoreForBenchmark(match.benchmark, mode)
      const entries = cleanEntries(model.entries, false, false, 'blendedPrice')
      const price = entries[0]?.blendedPrice ?? model.minBlendedPrice
      if (!score || !price || price <= 0) return null

      return {
        model,
        benchmark: match.benchmark,
        matchedKey: match.matchedKey,
        score,
        price,
        pricePerPoint: price / score,
        valueScore: score / price,
      }
    })
    .filter((item): item is AbilityValueItem => item !== null)
    .toSorted((a, b) => b.valueScore - a.valueScore || b.score - a.score)
}

function buildUnmatchedBenchmarkHighlights(
  benchmarkModels: BenchmarkModel[],
  priceModels: ModelSummary[],
  benchmarkIndex: Map<string, BenchmarkModel>,
  mode: BenchmarkMode,
) {
  const matched = new Set<BenchmarkModel>()

  priceModels.forEach((model) => {
    const match = findBenchmarkMatch(model, benchmarkIndex)
    if (match) matched.add(match.benchmark)
  })

  return benchmarkModels
    .filter((model) => !matched.has(model))
    .filter((model) => {
      if (mode === 'aa') return model.aaScore !== null
      return typeof model.categoryScores[mode] === 'number'
    })
    .map((model) => ({ model, score: scoreForBenchmark(model, mode) ?? 0 }))
    .filter((item) => item.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 5)
}

function App() {
  const analysisRef = useRef<HTMLElement | null>(null)
  const [data, setData] = useState<PriceData | null>(null)
  const [selectedModelId, setSelectedModelId] = useState(defaultModelCandidates[0])
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('全部')
  const [metric, setMetric] = useState<PriceMetric>('blendedPrice')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [includeZero, setIncludeZero] = useState(false)
  const [includeExtreme, setIncludeExtreme] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null)
  const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>('aa')
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/llm-prices.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<PriceData>
      })
      .then((payload) => {
        setData(payload)
        setSelectedModelId((current) => {
          if (payload.models.some((model) => model.id === current)) return current
          return resolveDefaultModel(payload.models)
        })
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : '数据加载失败'))
  }, [])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/model-benchmarks.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<BenchmarkData>
      })
      .then((payload) => {
        setBenchmarkData(payload)
        setBenchmarkError(null)
      })
      .catch((error) => setBenchmarkError(error instanceof Error ? error.message : '能力榜数据加载失败'))
  }, [])

  const families = useMemo(() => {
    if (!data) return ['全部']
    const known = new Set(Object.keys(data.familyCounts))
    return familyOrder.filter((item) => item === '全部' || known.has(item))
  }, [data])

  const filteredModels = useMemo(() => {
    if (!data) return []
    const keyword = query.trim().toLowerCase()
    return data.models
      .filter((model) => family === '全部' || model.family === family)
      .filter((model) => {
        if (!keyword) return true
        return (
          model.id.toLowerCase().includes(keyword) ||
          model.cheapestProvider?.toLowerCase().includes(keyword) ||
          model.highestProvider?.toLowerCase().includes(keyword) ||
          model.entries.some(
            (entry) =>
              entry.provider.toLowerCase().includes(keyword) || entry.providerLabel.toLowerCase().includes(keyword),
          )
        )
      })
      .slice(0, 80)
  }, [data, family, query])

  const selectedModel = useMemo(() => {
    if (!data) return null
    const selected = data.models.find((model) => model.id === selectedModelId) ?? null
    const filterActive = query.trim() !== '' || family !== '全部'
    const selectedInFiltered = selected ? filteredModels.some((model) => model.id === selected.id) : false

    if (!filterActive || selectedInFiltered) return selected ?? filteredModels[0] ?? data.models[0] ?? null
    return filteredModels[0] ?? selected ?? data.models[0] ?? null
  }, [data, family, filteredModels, query, selectedModelId])

  const hotModels = useMemo(() => {
    if (!data) return []
    const byId = new Map(data.models.map((model) => [model.id, model]))
    const picked = new Map<string, ModelSummary>()

    for (const id of flagshipModelIds) {
      const model = byId.get(id)
      if (model) picked.set(model.id, model)
    }

    for (const id of fallbackHotModelIds) {
      const model = byId.get(id)
      if (model) picked.set(model.id, model)
    }

    for (const item of data.leaderboards.priceSpread) {
      const model = byId.get(item.id)
      if (model) picked.set(model.id, model)
      if (picked.size >= 14) break
    }

    return Array.from(picked.values()).slice(0, 14)
  }, [data])

  const platformInsights = useMemo(() => (data ? buildPlatformInsights(data.models) : []), [data])
  const benchmarkIndex = useMemo(
    () => (benchmarkData ? buildBenchmarkIndex(benchmarkData.models) : new Map<string, BenchmarkModel>()),
    [benchmarkData],
  )
  const abilityValueItems = useMemo(
    () => (data && benchmarkData ? buildAbilityValueItems(data.models, benchmarkIndex, benchmarkMode) : []),
    [benchmarkData, benchmarkIndex, benchmarkMode, data],
  )
  const unmatchedBenchmarkHighlights = useMemo(
    () =>
      data && benchmarkData
        ? buildUnmatchedBenchmarkHighlights(benchmarkData.models, data.models, benchmarkIndex, benchmarkMode)
        : [],
    [benchmarkData, benchmarkIndex, benchmarkMode, data],
  )

  const visibleEntries = useMemo(() => {
    if (!selectedModel) return []
    return cleanEntries(selectedModel.entries, includeZero, includeExtreme, metric)
  }, [includeExtreme, includeZero, metric, selectedModel])

  const maxPrice = useMemo(() => {
    return Math.max(...visibleEntries.map((entry) => entry[metric] ?? 0), 0.001)
  }, [metric, visibleEntries])

  const cheapest = visibleEntries[0] ?? null
  const highest = visibleEntries[visibleEntries.length - 1] ?? null
  const spread =
    cheapest?.[metric] && highest?.[metric] && cheapest[metric] > 0 ? (highest[metric] ?? 0) / cheapest[metric] : null

  const selectModelAndFocus = (modelId: string) => {
    setSelectedModelId(modelId)
    analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectPlatformAndFocus = (providerLabel: string) => {
    setFamily('全部')
    setQuery(providerLabel)
    analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loadError) {
    return (
      <main className="error-state">
        <Database size={28} />
        <h1>价格数据没有加载成功</h1>
        <p>{loadError}</p>
      </main>
    )
  }

  if (!data || !selectedModel) {
    return (
      <main className="loading-state">
        <Sparkles size={28} />
        <p>正在载入 LiteLLM 价格索引...</p>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setSelectedModelId(resolveDefaultModel(data.models))}>
          <span className="brand-mark">jl</span>
          <span>
            <strong>just-llmprice</strong>
            <small>按模型比较平台价格</small>
          </span>
        </button>

        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型或平台，例如 gpt-4o、claude、openrouter"
          />
        </label>

        <div className="top-actions" aria-label="全局设置">
          <div className="segmented" aria-label="货币">
            {(['USD', 'CNY'] as const).map((item) => (
              <button
                className={currency === item ? 'active' : ''}
                key={item}
                type="button"
                onClick={() => setCurrency(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <a className="icon-link" href="https://github.com/BerriAI/litellm" rel="noreferrer" target="_blank" title="LiteLLM 数据源">
            <GitBranch size={18} aria-hidden="true" />
          </a>
        </div>
      </header>

      <section className="hot-hero" aria-label="热门模型价格雷达">
        <div className="hot-copy">
          <span className="radar-mark">
            <Radar size={28} aria-hidden="true" />
          </span>
          <span className="hot-label">
            <Flame size={16} aria-hidden="true" />
            旗舰与热门模型价格雷达
          </span>
          <h1>
            同一个模型
            <br />
            平台价差很离谱。
          </h1>
          <p>
            先看 GPT、Claude、Gemini、Qwen、Kimi、GLM 等旗舰模型的最低价、最高价和价差，再进入下方分析台做模型族筛选、平台排行和价格分布对比。
          </p>
          <div className="hot-actions">
            <button type="button" onClick={() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              进入完整分析台
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <span>
              <Activity size={15} aria-hidden="true" />
              {hotModels.length} 个模型 · 每 1M tokens · 来自 LiteLLM
            </span>
          </div>
        </div>

        <div className="hot-grid">
          {hotModels.map((model) => (
            <HotModelCard
              currency={currency}
              key={model.id}
              model={model}
              onSelect={() => selectModelAndFocus(model.id)}
            />
          ))}
        </div>

        <section className="radar-showcase" aria-label="热门模型多维雷达矩阵">
          <div className="radar-showcase-head">
            <span>
              <Radar size={17} aria-hidden="true" />
              多维雷达矩阵
            </span>
            <small>低价 / 平台 / 窗口 / 价差 / 能力</small>
          </div>
          <div className="radar-cards">
            {hotModels.slice(0, 6).map((model) => (
              <button className="radar-card" key={`radar-${model.id}`} type="button" onClick={() => selectModelAndFocus(model.id)}>
                <RadarChart axes={radarAxes(model)} showLabels size={148} />
                <span>
                  <strong>{model.label}</strong>
                  <small>
                    {formatPrice(model.minBlendedPrice, currency)} 起 · {model.providerCount} 平台
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <section className="platform-section" aria-label="平台优势分析">
        <div className="platform-head">
          <div>
            <span>
              <BarChart3 size={17} aria-hidden="true" />
              平台优势分析
            </span>
            <h2>哪些平台不是偶尔便宜，而是经常便宜？</h2>
          </div>
          <p>
            综合每个平台在全部可比模型里的最低价命中、Top 3 命中、覆盖模型数和平均溢价倍数，筛出更像“全方位优势”的平台。
          </p>
        </div>
        <div className="platform-grid">
          {platformInsights.map((platform) => (
            <button
              className="platform-card"
              key={platform.provider}
              type="button"
              onClick={() => selectPlatformAndFocus(platform.label)}
            >
              <div className="platform-card-head">
                <PlatformLogo label={platform.label} provider={platform.provider} />
                <span>
                  <strong>{platform.label}</strong>
                  <small>{platform.modelCount} 个模型可比</small>
                </span>
                <em>{Math.round(platform.score)}</em>
              </div>
              <div className="platform-bars">
                <MetricBar label="最低价命中" value={(platform.wins / platform.comparisons) * 100} />
                <MetricBar label="Top 3 命中" value={(platform.topThree / platform.comparisons) * 100} />
              </div>
              <div className="platform-foot">
                <span>均价约为最低价 {platform.avgRelative.toFixed(2)}x</span>
                <small>{platform.bestModels.map((model) => model.id).join(' · ') || '等待更多命中'}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="value-section" aria-label="能力价比 Beta">
        <div className="value-head">
          <div>
            <span>
              <Sparkles size={17} aria-hidden="true" />
              能力价比 Beta
            </span>
            <h2>把能力榜分数除以真实 API 最低价。</h2>
          </div>
          <div>
            <p>
              价格只取 LiteLLM JSON 里的每 1M tokens 报价；能力分来自 DataLearner 榜单。这里只做标准化别名匹配，
              未能同名匹配的强模型会单独列出，避免把近似型号混成同一个模型。
            </p>
            <div className="source-links" aria-label="数据来源">
              <a href={litellmSourceUrl} rel="noreferrer" target="_blank">
                价格源：LiteLLM model_prices_and_context_window.json
              </a>
              <a
                href={benchmarkData?.meta.sourceUrl ?? 'https://www.datalearner.com/leaderboards'}
                rel="noreferrer"
                target="_blank"
              >
                能力源：DataLearner Leaderboards
              </a>
            </div>
          </div>
        </div>

        <div className="value-toolbar">
          <div className="segmented value-tabs" aria-label="能力口径">
            {(Object.keys(benchmarkModeLabels) as BenchmarkMode[]).map((item) => (
              <button
                className={benchmarkMode === item ? 'active' : ''}
                key={item}
                type="button"
                onClick={() => setBenchmarkMode(item)}
              >
                {benchmarkModeLabels[item]}
              </button>
            ))}
          </div>
          <span>
            {benchmarkData
              ? `${benchmarkData.meta.modelCount} 个 DataLearner 模型 · ${abilityValueItems.length} 个已匹配价格`
              : benchmarkError
                ? `DataLearner 加载失败：${benchmarkError}`
                : '正在载入 DataLearner 能力榜...'}
          </span>
        </div>

        {benchmarkData && (
          <>
            <div className="value-grid">
              {abilityValueItems.slice(0, 8).map((item, index) => (
                <AbilityValueCard
                  currency={currency}
                  item={item}
                  key={`${benchmarkMode}-${item.model.id}`}
                  mode={benchmarkMode}
                  onSelect={() => selectModelAndFocus(item.model.id)}
                  rank={index + 1}
                />
              ))}
            </div>

            <div className="benchmark-note-strip">
              <div>
                <strong>能力强，但暂无同名 LiteLLM 可比价</strong>
                <small>这些卡片只来自 DataLearner，不参与价格排行；适合提醒后续手动确认 LiteLLM 是否新增了同名模型。</small>
              </div>
              <div className="benchmark-ghost-list">
                {unmatchedBenchmarkHighlights.map(({ model, score }) => (
                  <span key={`${benchmarkMode}-${model.modelName}`}>
                    <strong>{model.modelName}</strong>
                    <em>{formatBenchmarkScore(score)}</em>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="status-strip" aria-label="数据摘要">
        <div>
          <span>模型组</span>
          <strong>{data.meta.modelCount}</strong>
        </div>
        <div>
          <span>平台报价</span>
          <strong>{data.meta.entryCount}</strong>
        </div>
        <div>
          <span>源条目</span>
          <strong>{data.meta.rawModelCount}</strong>
        </div>
        <div>
          <span>更新</span>
          <strong>{formatDate(data.meta.generatedAt)}</strong>
        </div>
      </section>

      <div className="workspace" id="analysis">
        <aside className="sidebar" aria-label="模型筛选">
          <div className="panel-title">
            <SlidersHorizontal size={16} aria-hidden="true" />
            模型族
          </div>
          <div className="family-list">
            {families.map((item) => (
              <button
                className={family === item ? 'active' : ''}
                key={item}
                type="button"
                onClick={() => setFamily(item)}
              >
                <span>
                  {item !== '全部' && <BrandLogo family={item} />}
                  {item}
                </span>
                <strong>{item === '全部' ? data.meta.modelCount : data.familyCounts[item]}</strong>
              </button>
            ))}
          </div>

          <div className="panel-title model-title">
            <ArrowDownUp size={16} aria-hidden="true" />
            模型列表
          </div>
          <div className="model-list">
            {filteredModels.map((model) => (
              <button
                className={selectedModel.id === model.id ? 'selected' : ''}
                key={model.id}
                type="button"
                onClick={() => setSelectedModelId(model.id)}
              >
                <span>
                  <strong>{model.label}</strong>
                  <small>{model.providerCount} 个平台</small>
                </span>
                <em>{model.spreadRatio ? `${model.spreadRatio}x` : '-'}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="main-panel" ref={analysisRef}>
          <div className="model-header">
            <div>
              <FamilyBadge family={selectedModel.family} />
              <h1>{selectedModel.label}</h1>
              <p>
                每 1M tokens 计价。综合价为输入和输出价格的平均值，默认隐藏 0 价和异常高价。
              </p>
            </div>
            <div className="model-stats">
              <div>
                <span>最低</span>
                <strong>{formatPrice(cheapest?.[metric], currency)}</strong>
                <small>{cheapest?.providerLabel ?? '-'}</small>
              </div>
              <div>
                <span>最高</span>
                <strong>{formatPrice(highest?.[metric], currency)}</strong>
                <small>{highest?.providerLabel ?? '-'}</small>
              </div>
              <div>
                <span>价差</span>
                <strong>{spread ? `${spread.toFixed(spread > 10 ? 1 : 2)}x` : '-'}</strong>
                <small>{visibleEntries.length} 条可比报价</small>
              </div>
            </div>
          </div>

          <div className="controls-row">
            <div className="segmented metric-tabs" aria-label="价格口径">
              {(['blendedPrice', 'inputPrice', 'outputPrice'] as const).map((item) => (
                <button
                  className={metric === item ? 'active' : ''}
                  key={item}
                  type="button"
                  onClick={() => setMetric(item)}
                >
                  {metricLabels[item]}
                </button>
              ))}
            </div>
            <label className="toggle">
              <input checked={includeZero} onChange={(event) => setIncludeZero(event.target.checked)} type="checkbox" />
              显示 0 价
            </label>
            <label className="toggle">
              <input
                checked={includeExtreme}
                onChange={(event) => setIncludeExtreme(event.target.checked)}
                type="checkbox"
              />
              显示异常价
            </label>
          </div>

          <div className="content-grid">
            <div className="table-panel">
              <div className="table-head">
                <h2>平台价格排行</h2>
                <span>{metricLabels[metric]}从低到高</span>
              </div>
              <div className="price-table" role="table" aria-label={`${selectedModel.label} 平台价格排行`}>
                <div className="price-row price-row-head" role="row">
                  <span>排名</span>
                  <span>平台</span>
                  <span>输入</span>
                  <span>输出</span>
                  <span>上下文</span>
                  <span>状态</span>
                </div>
                {visibleEntries.map((entry, index) => (
                  <button className="price-row" key={`${entry.provider}-${entry.sourceKey}`} type="button">
                    <span className="rank">{index + 1}</span>
                    <span className="provider-cell">
                      <strong>{entry.providerLabel}</strong>
                      <small>{entry.sourceKey}</small>
                    </span>
                    <span>{formatPrice(entry.inputPrice, currency)}</span>
                    <span>{formatPrice(entry.outputPrice, currency)}</span>
                    <span>{formatNumber(entry.contextWindow)}</span>
                    <span className="tag-line">
                      {index === 0 && <em className="tag best">最低</em>}
                      {index === visibleEntries.length - 1 && visibleEntries.length > 1 && <em className="tag high">最高</em>}
                      {entry.supportsReasoning && <em className="tag">推理</em>}
                      {entry.supportsVision && <em className="tag">视觉</em>}
                      {entry.isExtremePrice && <em className="tag warn">异常</em>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <aside className="chart-panel" aria-label="价格可视化">
              <div className="chart-title">
                <BarChart3 size={18} aria-hidden="true" />
                <div>
                  <h2>价格分布</h2>
                  <span>{metricLabels[metric]}</span>
                </div>
              </div>
              <div className="spread-card">
                <span>当前价差</span>
                <strong>{spread ? `${spread.toFixed(spread > 10 ? 1 : 2)}x` : '-'}</strong>
                <small>
                  {cheapest?.providerLabel ?? '-'} 到 {highest?.providerLabel ?? '-'}
                </small>
              </div>
              <div className="bars">
                {visibleEntries.slice(0, 12).map((entry, index) => {
                  const value = entry[metric] ?? 0
                  const width = Math.max((value / maxPrice) * 100, 4)
                  return (
                    <div className="bar-row" key={`${entry.sourceKey}-bar`}>
                      <div className="bar-meta">
                        <span>{entry.providerLabel}</span>
                        <strong>{formatPrice(value, currency)}</strong>
                      </div>
                      <div className="bar-track">
                        <span className={index === 0 ? 'bar best' : 'bar'} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>

          <section className="leaderboards" aria-label="排行榜">
            <Leaderboard
              currency={currency}
              items={data.leaderboards.priceSpread}
              label="价差最大"
              onSelect={selectModelAndFocus}
              value={(item) => (item.spreadRatio ? `${item.spreadRatio}x` : '-')}
            />
            <Leaderboard
              currency={currency}
              items={data.leaderboards.cheapestAverage}
              label="最低综合价"
              onSelect={selectModelAndFocus}
              value={(item) => formatPrice(item.minBlendedPrice, currency)}
            />
            <Leaderboard
              currency={currency}
              items={data.leaderboards.mostProviders}
              label="覆盖平台最多"
              onSelect={selectModelAndFocus}
              value={(item) => `${item.providerCount} 家`}
            />
          </section>
        </section>
      </div>
    </main>
  )
}

function BrandLogo({ family }: { family: string }) {
  const meta = brandMeta[family] ?? brandMeta.Other

  return (
    <span className="brand-logo" aria-hidden="true">
      <span>{meta.initials}</span>
      {meta.logoUrl && <img alt="" src={meta.logoUrl} onError={(event) => (event.currentTarget.style.display = 'none')} />}
    </span>
  )
}

function FamilyBadge({ family }: { family: string }) {
  return (
    <span className={familyClass(family)}>
      <BrandLogo family={family} />
      {family}
    </span>
  )
}

function PlatformLogo({ provider, label }: { provider: string; label: string }) {
  const fallback = label
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
  const meta = platformLogoMeta[provider] ?? { initials: fallback || label.slice(0, 2).toUpperCase() }

  return (
    <span className="platform-avatar" aria-hidden="true">
      <span>{meta.initials}</span>
      {meta.logoUrl && <img alt="" src={meta.logoUrl} onError={(event) => (event.currentTarget.style.display = 'none')} />}
    </span>
  )
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const safeValue = clamp(value)

  return (
    <div className="platform-metric">
      <span>
        {label}
        <strong>{formatPercent(safeValue)}</strong>
      </span>
      <i>
        <b style={{ width: `${safeValue}%` }} />
      </i>
    </div>
  )
}

function HotModelCard({
  model,
  currency,
  onSelect,
}: {
  model: ModelSummary
  currency: Currency
  onSelect: () => void
}) {
  const entries = cleanEntries(model.entries, false, false, 'blendedPrice').slice(0, 4)
  const max = Math.max(...entries.map((entry) => entry.blendedPrice ?? 0), 0.001)
  const best = entries[0] ?? null
  const worst = entries[entries.length - 1] ?? null
  const spread =
    best?.blendedPrice && worst?.blendedPrice && best.blendedPrice > 0 ? worst.blendedPrice / best.blendedPrice : model.spreadRatio

  return (
    <button className="hot-card" type="button" onClick={onSelect}>
      <div className="hot-card-top">
        <FamilyBadge family={model.family} />
        <RadarChart axes={radarAxes(model)} size={82} />
      </div>
      <h2>{model.label}</h2>
      <div className="hot-card-stats">
        <span>
          最低
          <strong>{formatPrice(best?.blendedPrice ?? model.minBlendedPrice, currency)}</strong>
        </span>
        <span>
          价差
          <strong>{spread ? `${spread.toFixed(spread > 10 ? 1 : 2)}x` : '-'}</strong>
        </span>
        <span>
          平台
          <strong>{model.providerCount}</strong>
        </span>
      </div>
      <div className="hot-mini-bars">
        {entries.map((entry, index) => {
          const width = Math.max(((entry.blendedPrice ?? 0) / max) * 100, 5)
          return (
            <div className="hot-mini-row" key={`${model.id}-${entry.provider}`}>
              <span>{entry.providerLabel}</span>
              <div className="hot-mini-track">
                <i className={index === 0 ? 'best' : ''} style={{ width: `${width}%` }} />
              </div>
              <strong>{formatPrice(entry.blendedPrice, currency)}</strong>
            </div>
          )
        })}
      </div>
    </button>
  )
}

function AbilityValueCard({
  item,
  mode,
  currency,
  rank,
  onSelect,
}: {
  item: AbilityValueItem
  mode: BenchmarkMode
  currency: Currency
  rank: number
  onSelect: () => void
}) {
  const bestEntry = cleanEntries(item.model.entries, false, false, 'blendedPrice')[0]
  const convertedPrice = currency === 'CNY' ? item.price * cnyRate : item.price
  const valuePerCurrency = item.score / convertedPrice
  const meterWidth = clamp(item.score)

  return (
    <button className="value-card" type="button" onClick={onSelect}>
      <div className="value-card-top">
        <span className="rank-dot">{rank}</span>
        <FamilyBadge family={item.model.family} />
        <RadarChart axes={benchmarkRadarAxes(item.benchmark)} size={88} />
      </div>
      <h3>{item.model.label}</h3>
      <p className="benchmark-match">
        DataLearner: {item.benchmark.modelName}
        {item.benchmark.organization ? ` · ${item.benchmark.organization}` : ''}
      </p>
      <div className="value-metrics">
        <span>
          <small>{benchmarkModeLabels[mode]}</small>
          <strong>{formatBenchmarkScore(item.score)}</strong>
        </span>
        <span>
          <small>最低综合价</small>
          <strong>{formatPrice(item.price, currency)}</strong>
        </span>
        <span>
          <small>每分成本</small>
          <strong>{formatPrice(item.pricePerPoint, currency)}</strong>
        </span>
      </div>
      <div className="value-meter" aria-hidden="true">
        <i style={{ width: `${meterWidth}%` }} />
      </div>
      <div className="value-card-foot">
        <span>{bestEntry?.providerLabel ?? item.model.cheapestProvider ?? '未知平台'}</span>
        <span>{valuePerCurrency.toFixed(valuePerCurrency > 100 ? 0 : 1)} 分/{currency === 'CNY' ? '¥' : '$'}</span>
      </div>
      <div className="value-source">LiteLLM 价格 × DataLearner 能力 · 匹配键 {item.matchedKey}</div>
    </button>
  )
}

function Leaderboard({
  items,
  label,
  value,
  onSelect,
}: {
  currency: Currency
  items: LeaderboardItem[]
  label: string
  value: (item: LeaderboardItem) => string
  onSelect: (id: string) => void
}) {
  return (
    <div className="leaderboard">
      <div className="leaderboard-head">
        <h2>{label}</h2>
        <span>Top 12</span>
      </div>
      {items.slice(0, 6).map((item, index) => (
        <button className="leaderboard-row" key={`${label}-${item.id}`} type="button" onClick={() => onSelect(item.id)}>
          <span className="rank-dot">{index + 1}</span>
          <span className="leaderboard-name">
            <strong>{item.id}</strong>
            <small>
              {item.family} · {item.providerCount} 平台
            </small>
          </span>
          <em>{value(item)}</em>
        </button>
      ))}
    </div>
  )
}

function RadarChart({ axes, size = 120, showLabels = false }: { axes: RadarAxis[]; size?: number; showLabels?: boolean }) {
  const center = size / 2
  const radius = showLabels ? size * 0.31 : size * 0.37
  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length
    const distance = radius * clamp(value) / 100
    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    }
  }
  const ringPoints = (scale: number) =>
    axes
      .map((_, index) => {
        const point = pointFor(index, scale)
        return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
      })
      .join(' ')
  const shapePoints = axes
    .map((axis, index) => {
      const point = pointFor(index, axis.value)
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg className="radar-chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {[100, 68, 36].map((ring) => (
        <polygon className="radar-ring" key={ring} points={ringPoints(ring)} />
      ))}
      {axes.map((axis, index) => {
        const edge = pointFor(index, 100)
        const label = pointFor(index, 119)
        return (
          <g key={axis.label}>
            <line className="radar-spoke" x1={center} y1={center} x2={edge.x} y2={edge.y} />
            {showLabels && (
              <text className="radar-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                {axis.label}
              </text>
            )}
          </g>
        )
      })}
      <polygon className="radar-shape" points={shapePoints} />
      {axes.map((axis, index) => {
        const point = pointFor(index, axis.value)
        return <circle className="radar-dot" cx={point.x} cy={point.y} key={`${axis.label}-dot`} r={showLabels ? 3.2 : 2.5} />
      })}
    </svg>
  )
}

export default App
