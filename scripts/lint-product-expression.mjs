#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const targetDirs = ['src']
const targetFiles = ['index.html']
const extensions = new Set(['.tsx', '.jsx', '.ts', '.js', '.html'])

const failTerms = [
  /Plus\s*\/\s*Pro\s+月费单独看/i,
  /不和\s*API\s*token\s*价格混在一起/i,
  /匹配键/,
  /只来自/,
  /暂无同名/,
  /未能同名/,
  /固定回退/,
  /\bTODO\b/i,
  /\bdebug\b/i,
  /\bmock\b/i,
  /\bfallback\b/i,
]

const warnTerms = [
  /不是/,
  /不要/,
  /避免/,
  /这里只/,
  /仅/,
  /样例/,
  /可核验/,
  /后续/,
  /口径/,
  /数据源/,
  /源条目/,
  /实现/,
  /维护/,
]

const sourceContext = [
  /sourceName/,
  /sourceUrl/,
  /source-links/,
  /sourceUrl/,
  /来源：/,
  /价格源：/,
  /能力源：/,
  /汇率源：/,
  /订阅价源：/,
  /指南：/,
  /数据来源/,
  /href=/,
  /https?:\/\//,
]

const codeContext = [
  /^\s*(type|const|let|function|return|if|for|throw|import|export)\b/,
  /^\s*status:/,
  /current\.status/,
  /className=/,
  /aria-label=/,
  /title=/,
  /onClick=/,
  /key=/,
]

function walk(dir) {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'public', 'data'].includes(entry.name)) return []
      return walk(fullPath)
    }
    return extensions.has(path.extname(entry.name)) ? [fullPath] : []
  })
}

function isAllowedContext(line) {
  return sourceContext.some((pattern) => pattern.test(line))
}

function looksLikeVisibleText(line) {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^\s*\/\//.test(trimmed)) return false
  if (/^\s*\/\*/.test(trimmed)) return false
  if (/<h[1-6]\b|<p\b|<small\b|<span\b|<strong\b|<em\b|<button\b|<a\b|aria-label=|title=/.test(line)) return true
  if (/['"`][^'"`]*(?:[\u4e00-\u9fff]|API|token|debug|fallback|mock|TODO)[^'"`]*['"`]/.test(line)) return true
  return false
}

function scanFile(file) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  const issues = []

  lines.forEach((line, index) => {
    if (!looksLikeVisibleText(line)) return
    const visibleLine = line.trim()
    const allowed = isAllowedContext(visibleLine)
    const isMostlyCode = codeContext.some((pattern) => pattern.test(visibleLine)) && !/[<>][^>]*>[^<{]+/.test(visibleLine)
    if (isMostlyCode) return

    for (const pattern of failTerms) {
      if (pattern.test(visibleLine) && !allowed) {
        issues.push({ severity: 'error', file, line: index + 1, pattern: pattern.source, text: visibleLine })
      }
    }

    const isProminent = /<h[1-3]\b|<button\b|aria-label=|title=/.test(visibleLine)
    if (allowed) return

    for (const pattern of warnTerms) {
      if (pattern.test(visibleLine)) {
        issues.push({ severity: isProminent ? 'error' : 'warn', file, line: index + 1, pattern: pattern.source, text: visibleLine })
      }
    }
  })

  return issues
}

const files = [
  ...targetDirs.flatMap((dir) => walk(path.join(root, dir))),
  ...targetFiles.map((file) => path.join(root, file)).filter(existsSync),
]

const issues = files.flatMap(scanFile)
const errors = issues.filter((issue) => issue.severity === 'error')

if (issues.length > 0) {
  console.log('Product expression guard found possible developer-note leakage:\n')
  for (const issue of issues) {
    const relative = path.relative(root, issue.file)
    console.log(`[${issue.severity}] ${relative}:${issue.line}`)
    console.log(`  ${issue.text}`)
  }
  console.log('\nMove implementation notes into source chips, tooltips, footnotes, docs, or logs; keep primary UI text user-facing.')
}

if (errors.length > 0) {
  process.exitCode = 1
} else if (issues.length === 0) {
  console.log('Product expression guard passed.')
}
