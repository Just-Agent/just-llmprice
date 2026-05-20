#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const hookDir = path.join(root, '.git', 'hooks')
const hookPath = path.join(hookDir, 'pre-commit')
const markerStart = '# product-expression-guard:start'
const markerEnd = '# product-expression-guard:end'
const block = `${markerStart}
npm run expression:lint
${markerEnd}`

if (!existsSync(path.join(root, '.git'))) {
  console.error('No .git directory found. Run this from the repository root.')
  process.exit(1)
}

mkdirSync(hookDir, { recursive: true })

let content = '#!/bin/sh\n'
if (existsSync(hookPath)) {
  content = readFileSync(hookPath, 'utf8')
  if (!content.startsWith('#!')) content = `#!/bin/sh\n${content}`
  const markerPattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`, 'm')
  content = markerPattern.test(content) ? content.replace(markerPattern, block) : `${content.trimEnd()}\n\n${block}\n`
} else {
  content = `#!/bin/sh\n\n${block}\n`
}

writeFileSync(hookPath, content, 'utf8')
chmodSync(hookPath, 0o755)
console.log(`Installed product expression guard pre-commit hook at ${path.relative(root, hookPath)}`)

