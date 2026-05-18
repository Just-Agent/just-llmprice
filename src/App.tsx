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

const familyOrder = ['全部', 'OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Qwen', 'Llama', 'Mistral', 'Cohere', 'Other']
const hotModelIds = ['deepseek-r1', 'qwen3', 'gpt-4o-mini', 'claude-sonnet-4', 'gemini-2.5-pro', 'gpt-oss-120b']
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

function App() {
  const analysisRef = useRef<HTMLElement | null>(null)
  const [data, setData] = useState<PriceData | null>(null)
  const [selectedModelId, setSelectedModelId] = useState('gpt-4o-mini')
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('全部')
  const [metric, setMetric] = useState<PriceMetric>('blendedPrice')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [includeZero, setIncludeZero] = useState(false)
  const [includeExtreme, setIncludeExtreme] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

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
          return payload.models.some((model) => model.id === 'gpt-4o-mini') ? 'gpt-4o-mini' : (payload.models[0]?.id ?? '')
        })
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : '数据加载失败'))
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
          model.highestProvider?.toLowerCase().includes(keyword)
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

    for (const id of hotModelIds) {
      const model = byId.get(id)
      if (model) picked.set(model.id, model)
    }

    for (const item of data.leaderboards.priceSpread) {
      const model = byId.get(item.id)
      if (model) picked.set(model.id, model)
      if (picked.size >= 6) break
    }

    return Array.from(picked.values()).slice(0, 6)
  }, [data])

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
        <button className="brand" type="button" onClick={() => setSelectedModelId('gpt-4o-mini')}>
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
          <a className="icon-link" href="https://github.com/BerriAI/litellm" target="_blank" title="LiteLLM 数据源">
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
            热门模型价格雷达
          </span>
          <h1>同一个模型，平台价差可以很离谱。</h1>
          <p>
            先看高热模型的最低价、最高价和价差，再进入下方分析台做模型族筛选、平台排行和价格分布对比。
          </p>
          <div className="hot-actions">
            <button type="button" onClick={() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              进入完整分析台
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <span>
              <Activity size={15} aria-hidden="true" />
              每 1M tokens · 来自 LiteLLM
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
                <span>{item}</span>
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
              <span className={familyClass(selectedModel.family)}>{selectedModel.family}</span>
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
      <span className={familyClass(model.family)}>{model.family}</span>
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

export default App
