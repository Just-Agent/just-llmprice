import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const SOURCE_URL = 'https://www.datalearner.com/leaderboards'
const LOCAL_SOURCE = path.resolve('data', 'raw', 'datalearner-leaderboards.html')
const OUTPUT_PATH = path.resolve('public', 'data', 'model-benchmarks.json')
const preferLocal = process.argv.includes('--prefer-local')
const now = new Date().toISOString()

const benchmarkKeys = [
  'HLE',
  'ARC-AGI-2',
  'MMLU Pro',
  'AIME2025',
  'FrontierMath',
  'FrontierMath - Tier 4',
  'MATH-500',
  'SWE-bench Verified',
  'LiveCodeBench',
  'SWE-Bench Pro - Public',
  'τ²-Bench',
  'Terminal Bench 2.0',
  'Aider-Polyglot',
]

const benchmarkCategories = {
  overall: ['HLE', 'ARC-AGI-2', 'MMLU Pro'],
  math: ['AIME2025', 'FrontierMath', 'FrontierMath - Tier 4', 'MATH-500'],
  coding: ['SWE-bench Verified', 'LiveCodeBench', 'SWE-Bench Pro - Public'],
  agent: ['τ²-Bench', 'Terminal Bench 2.0', 'Aider-Polyglot'],
}

function normalizeKey(value) {
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

function average(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
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
          'User-Agent': 'just-llmprice-benchmark-builder',
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
    throw new Error(`Failed to fetch DataLearner leaderboards: ${suffix}`)
  }

  const raw = await response.text()
  await mkdir(path.dirname(LOCAL_SOURCE), { recursive: true })
  await writeFile(LOCAL_SOURCE, raw)
  return {
    raw,
    fetchedFrom: SOURCE_URL,
  }
}

function decodeFlightHtml(html) {
  return html
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}

function readObjectAt(text, start) {
  let depth = 0
  let inString = false
  let escape = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escape) escape = false
      else if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }

  return null
}

function extractModelRows(html) {
  const decoded = decodeFlightHtml(html)
  const rows = []
  const seen = new Set()
  let cursor = 0

  while ((cursor = decoded.indexOf('"modelName"', cursor)) !== -1) {
    const start = decoded.lastIndexOf('{', cursor)
    const objectText = readObjectAt(decoded, start)
    cursor += 11
    if (!objectText || seen.has(objectText)) continue
    seen.add(objectText)

    try {
      const row = JSON.parse(objectText)
      if (row?.modelName) rows.push(row)
    } catch {
      // Ignore non-data fragments from the React flight stream.
    }
  }

  return rows
}

function mergeRow(acc, row) {
  const organization = row.orgName || row.organization || acc.organization || null
  const modelCode = row.modelCode || acc.modelCode || null
  const modelName = row.modelName || acc.modelName
  const matchKeys = new Set(acc.matchKeys)

  matchKeys.add(normalizeKey(modelName))
  if (modelCode) matchKeys.add(normalizeKey(modelCode))
  if (modelCode?.endsWith('-preview')) matchKeys.add(normalizeKey(modelCode.replace(/-preview$/, '')))

  const aaScore = typeof row.score === 'number' && row.score <= 100 ? row.score : acc.aaScore
  const aaRank = typeof row.score === 'number' && row.score <= 100 ? Math.min(acc.aaRank ?? row.rank, row.rank) : acc.aaRank
  const arenaScore = typeof row.score === 'number' && row.score > 100 ? Math.max(acc.arenaScore ?? 0, row.score) : acc.arenaScore
  const arenaRank = typeof row.score === 'number' && row.score > 100 ? Math.min(acc.arenaRank ?? row.rank, row.rank) : acc.arenaRank
  const benchmarks = { ...acc.benchmarks }

  for (const key of benchmarkKeys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      benchmarks[key] = Math.max(benchmarks[key] ?? 0, round(value))
    }
  }

  const categoryScores = Object.fromEntries(
    Object.entries(benchmarkCategories).map(([category, keys]) => [
      category,
      round(average(keys.map((key) => benchmarks[key]))),
    ]),
  )
  const compositeScore = round(average([aaScore, categoryScores.overall, categoryScores.math, categoryScores.coding, categoryScores.agent]))

  return {
    modelName,
    modelCode,
    organization,
    aaScore: round(aaScore),
    aaRank,
    arenaScore: round(arenaScore),
    arenaRank,
    benchmarks,
    categoryScores,
    compositeScore,
    matchKeys: Array.from(matchKeys).filter(Boolean).toSorted(),
  }
}

const { raw, fetchedFrom } = await fetchSource()
const extractedRows = extractModelRows(raw)
const byKey = new Map()

for (const row of extractedRows) {
  const key = normalizeKey(row.modelCode || row.modelName)
  if (!key) continue
  const current =
    byKey.get(key) ??
    {
      modelName: row.modelName,
      modelCode: row.modelCode || null,
      organization: row.orgName || row.organization || null,
      aaScore: null,
      aaRank: null,
      arenaScore: null,
      arenaRank: null,
      benchmarks: {},
      categoryScores: {},
      compositeScore: null,
      matchKeys: [key],
    }
  byKey.set(key, mergeRow(current, row))
}

const models = Array.from(byKey.values())
  .filter((model) => model.aaScore || model.compositeScore || Object.keys(model.benchmarks).length)
  .toSorted((a, b) => {
    const scoreA = a.aaScore ?? a.compositeScore ?? 0
    const scoreB = b.aaScore ?? b.compositeScore ?? 0
    return scoreB - scoreA
  })

const payload = {
  meta: {
    generatedAt: now,
    sourceName: 'DataLearner AI',
    sourceUrl: SOURCE_URL,
    fetchedFrom,
    license: 'CC BY 4.0 as declared in DataLearner Dataset metadata',
    extractedRowCount: extractedRows.length,
    modelCount: models.length,
    note: 'Benchmark scores are parsed from DataLearner public leaderboards and matched to LiteLLM model ids by normalized aliases in the frontend.',
  },
  benchmarkKeys,
  categories: benchmarkCategories,
  models,
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`)

console.log(`Generated ${payload.meta.modelCount} benchmark model groups from ${extractedRows.length} rows -> ${OUTPUT_PATH}`)
