#!/usr/bin/env node
// validate.mjs — 无依赖校验 index.json（schema v1）。
// 用法：node scripts/validate.mjs [path-to-index.json]（默认 ./index.json）
// 规则：version=1；plugins[] 每项 id 合法 [a-z0-9][a-z0-9._-]{0,63}、
//       name/version/description 非空、type static|dynamic、downloadUrl 必须 https、
//       checksum 小写 64 位 hex、entry 无绝对路径/反斜杠/..；id 不得重复。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const ALLOWED_TYPES = new Set(['static', 'dynamic'])

const target = process.argv[2] ?? 'index.json'
const errors = []
const ids = new Set()

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function check(condition, message) {
  if (!condition) errors.push(message)
}

function validateText(value, field, label) {
  check(typeof value === 'string' && value.trim() !== '', `${label}: ${field} must be a non-empty string`)
  return typeof value === 'string' ? value.trim() : undefined
}

function validateEntry(entry, label) {
  if (!isRecord(entry)) {
    errors.push(`${label}: plugin entry must be an object`)
    return
  }
  const id = validateText(entry.id, 'id', label)
  if (id !== undefined) {
    check(ID_PATTERN.test(id), `${label}: invalid plugin id "${id}" (must match [a-z0-9][a-z0-9._-]{0,63})`)
    check(!ids.has(id), `${label}: duplicate plugin id "${id}"`)
    ids.add(id)
  }
  validateText(entry.name, 'name', label)
  validateText(entry.version, 'version', label)
  validateText(entry.description, 'description', label)
  check(ALLOWED_TYPES.has(entry.type), `${label}: type must be "static" or "dynamic"`)
  if (typeof entry.downloadUrl === 'string') {
    let parsed
    try {
      parsed = new URL(entry.downloadUrl)
    } catch {
      parsed = undefined
    }
    check(parsed !== undefined, `${label}: downloadUrl must be a valid URL`)
    check(parsed !== undefined && parsed.protocol === 'https:', `${label}: downloadUrl must use HTTPS`)
  } else {
    errors.push(`${label}: downloadUrl must be a non-empty string`)
  }
  check(typeof entry.checksum === 'string' && SHA256_PATTERN.test(entry.checksum), `${label}: checksum must be a lowercase 64-hex SHA-256 digest`)
  const entryPath = validateText(entry.entry, 'entry', label)
  if (entryPath !== undefined) {
    check(!entryPath.startsWith('/') && !entryPath.includes('\\') && entryPath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'), `${label}: entry path traversal is not allowed`)
  }
}

let raw
try {
  raw = JSON.parse(readFileSync(resolve(target), 'utf8'))
} catch (error) {
  console.error(`validate.mjs: cannot read ${target}: ${error.message}`)
  process.exit(1)
}

if (!isRecord(raw)) {
  console.error('validate.mjs: index must be an object')
  process.exit(1)
}
if (raw.version !== 1) {
  console.error(`validate.mjs: unsupported version ${JSON.stringify(raw.version)} (expected 1)`)
  process.exit(1)
}
if (!Array.isArray(raw.plugins)) {
  console.error('validate.mjs: plugins must be an array')
  process.exit(1)
}
raw.plugins.forEach((entry, index) => validateEntry(entry, `plugins[${index}]`))

if (errors.length > 0) {
  console.error(`validate.mjs: ${errors.length} error(s)`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`validate.mjs: ok (${raw.plugins.length} plugins, version ${raw.version})`)
