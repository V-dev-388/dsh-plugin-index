#!/usr/bin/env node
// build-index.mjs — 收录脚本：扫描 topic:dsh-plugin 仓库，收录根目录有可解析
// dsh.plugin.json 的仓库，产出 schema v1 的 index.json（原子写）。
// 必读环境变量：GITHUB_TOKEN（GitHub Search/Core API 认证）。
// 用法：GITHUB_TOKEN=xxx node scripts/build-index.mjs
import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INDEX_PATH = join(ROOT, 'index.json')
const REMOVED_PATH = join(ROOT, 'removed.json')
const LOG_PATH = join(ROOT, 'collect.log')

const TOPIC = 'dsh-plugin'
const PER_PAGE = 100
const SEARCH_INTERVAL_MS = 2200 // Search API 认证限速 30 req/min，留余量
const SEARCH_MAX_PAGES = 10 // GitHub Search API 单查询最多 1000 条（page 10）
const SEARCH_START = '2008-01-01'
const SEARCH_END = '2027-12-31'
const MAX_CONCURRENCY = 8
const TIMEOUT_MS = 15000
const MAX_RETRIES = 3
const API_BASE = 'https://api.github.com'
const RAW_BASE = 'https://raw.githubusercontent.com'
const MANIFEST_NAME = 'dsh.plugin.json'

export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
export const SHA256_PATTERN = /^[a-f0-9]{64}$/

// ---------- 纯函数（可单测） ----------

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function validateEntry(value) {
  const errors = []
  if (!isRecord(value)) return { ok: false, errors: ['plugin entry must be an object'] }
  const { id, name, version, description, type, downloadUrl, checksum, entry } = value
  if (typeof id !== 'string' || id.trim() === '' || !ID_PATTERN.test(id.trim())) errors.push(`invalid plugin id ${JSON.stringify(id)}`)
  for (const [field, label] of [[name, 'name'], [version, 'version'], [description, 'description']]) {
    if (typeof field !== 'string' || field.trim() === '') errors.push(`${label} must be a non-empty string`)
  }
  if (type !== 'static' && type !== 'dynamic') errors.push(`type must be "static" or "dynamic"`)
  if (typeof downloadUrl !== 'string') {
    errors.push('downloadUrl must be a non-empty string')
  } else {
    let parsed
    try {
      parsed = new URL(downloadUrl)
    } catch {
      parsed = undefined
    }
    if (parsed === undefined || parsed.protocol !== 'https:') errors.push(`downloadUrl must use HTTPS (${downloadUrl})`)
  }
  if (checksum !== undefined) {
    if (typeof checksum !== 'string' || !SHA256_PATTERN.test(checksum.toLowerCase())) errors.push(`checksum must be a lowercase 64-hex SHA-256 digest (${JSON.stringify(checksum)})`)
  }
  if (typeof entry !== 'string' || entry.trim() === '' || entry.startsWith('/') || entry.includes('\\') || entry.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    errors.push(`entry path traversal is not allowed (${JSON.stringify(entry)})`)
  }
  if (errors.length > 0) return { ok: false, errors }
  const normalized = {
    id: id.trim(),
    name: name.trim(),
    version: version.trim(),
    description: description.trim(),
    type,
    downloadUrl: new URL(downloadUrl).toString(),
    ...(checksum === undefined ? {} : { checksum: checksum.toLowerCase() }),
    entry: entry.trim(),
    ...(value.permissions === undefined ? {} : { permissions: value.permissions }),
    ...(value.config === undefined ? {} : { config: value.config }),
    ...(value.controllable === undefined ? {} : { controllable: value.controllable }),
  }
  return { ok: true, entry: normalized }
}

// 解析仓库根 dsh.plugin.json：接受目录形态 {version:1,plugins:[...]} 或单插件形态。
export function normalizeManifest(raw) {
  const errors = []
  if (!isRecord(raw)) return { ok: false, errors: ['manifest must be an object'], plugins: [] }
  if (Array.isArray(raw.plugins)) {
    if (raw.version !== 1) return { ok: false, errors: [`unsupported manifest version ${JSON.stringify(raw.version)}`], plugins: [] }
    const plugins = []
    for (const item of raw.plugins) {
      const result = validateEntry(item)
      if (result.ok) plugins.push(result.entry)
      else errors.push(...result.errors)
    }
    return { ok: plugins.length > 0, errors, plugins }
  }
  if (raw.id !== undefined) {
    const result = validateEntry(raw)
    return result.ok
      ? { ok: true, errors: [], plugins: [result.entry] }
      : { ok: false, errors: result.errors, plugins: [] }
  }
  return { ok: false, errors: ['manifest has neither plugins[] nor id'], plugins: [] }
}

// 收录核心：repos 为候选仓库（可带预取的 repo.manifest 供 fetchManifest 使用）；
// fetchManifest 返回 manifest 对象或 null；fetchDownload 返回 {ok:true,bytes} 或
// {ok:false,reason}；removed 命中（仓库名或插件 id）即跳过；existing 为先收录者
// （id 冲突保留先者；已收录但本轮不合格的跳过不删）。
export async function collectCandidates({ repos, fetchManifest, fetchDownload, removed, existing, log = () => {} }) {
  const entries = new Map()
  for (const [id, entry] of existing) {
    if (!removed.has(id)) entries.set(id, entry)
    else log(`drop removed plugin ${id} from previous index`)
  }
  for (const repo of repos) {
    if (removed.has(repo.fullName)) {
      log(`skip removed repo ${repo.fullName}`)
      continue
    }
    if (repo.fork) {
      log(`skip fork ${repo.fullName}`)
      continue
    }
    if (repo.archived) {
      log(`skip archived ${repo.fullName}`)
      continue
    }
    if (!repo.defaultBranch) {
      log(`skip no default branch ${repo.fullName}`)
      continue
    }
    let manifest
    try {
      manifest = await fetchManifest(repo)
    } catch (error) {
      log(`skip ${repo.fullName}: manifest probe failed (${error instanceof Error ? error.message : error})`)
      continue
    }
    if (manifest === null) {
      log(`skip ${repo.fullName}: no ${MANIFEST_NAME} at root`)
      continue
    }
    const normalized = normalizeManifest(manifest)
    if (!normalized.ok) {
      log(`skip ${repo.fullName}: invalid manifest (${normalized.errors.join('; ')})`)
      continue
    }
    for (const entry of normalized.plugins) {
      if (removed.has(entry.id)) {
        log(`skip removed plugin id ${entry.id} from ${repo.fullName}`)
        continue
      }
      if (entries.has(entry.id)) {
        log(`conflict: keep first ${entry.id}, skip from ${repo.fullName}`)
        continue
      }
      if (entry.checksum === undefined) {
        let download
        try {
          download = await fetchDownload(entry.downloadUrl)
        } catch (error) {
          download = { ok: false, reason: error instanceof Error ? error.message : String(error) }
        }
        if (!download.ok) {
          log(`skip ${entry.id} from ${repo.fullName}: cannot download ${entry.downloadUrl} for checksum (${download.reason})`)
          continue
        }
        entry.checksum = sha256Hex(download.bytes)
      }
      entries.set(entry.id, entry)
      log(`collect ${entry.id} (${entry.version}) from ${repo.fullName}`)
    }
  }
  return entries
}

// ---------- 真实网络实现 ----------

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

// raw.githubusercontent.com 无认证配额文档，全局限速 5 req/s 防 429 级联。
let lastRawAt = 0
async function pacedRaw(url, timeoutMs = TIMEOUT_MS, maxRetries = MAX_RETRIES) {
  const now = Date.now()
  const waitMs = Math.max(0, lastRawAt + 200 - now)
  lastRawAt = Date.now() + waitMs
  if (waitMs > 0) await sleep(waitMs)
  return fetchRaw(url, timeoutMs, maxRetries)
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function waitForRateLimit(response) {
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? 0)
  if (remaining === '0' && reset > 0) {
    const waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000
    console.warn(`rate limit hit, waiting ${Math.ceil(waitMs / 1000)}s`)
    await sleep(waitMs)
    return true
  }
  return false
}

async function ghApi(path, token) {
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1))
    let response
    try {
      response = await fetchWithTimeout(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    } catch (error) {
      lastError = error
      continue
    }
    if (response.status === 403 || response.status === 429) {
      if (await waitForRateLimit(response)) {
        attempt -= 1
        continue
      }
    }
    if (!response.ok) {
      lastError = new Error(`HTTP ${response.status} for ${path}`)
      if (response.status >= 400 && response.status < 500 && response.status !== 403 && response.status !== 429) break
      continue
    }
    return await response.json()
  }
  throw lastError ?? new Error(`failed after retries: ${path}`)
}

async function fetchRaw(url, timeoutMs = TIMEOUT_MS, maxRetries = MAX_RETRIES) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1))
    let response
    try {
      response = await fetchWithTimeout(url, { redirect: 'follow' }, timeoutMs)
    } catch (error) {
      lastError = error
      continue
    }
    if (response.status === 429) {
      lastError = new Error(`HTTP 429 for ${url}`)
      continue
    }
    if (!response.ok) {
      lastError = new Error(`HTTP ${response.status} for ${url}`)
      break
    }
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) }
  }
  throw lastError ?? new Error(`failed after retries: ${url}`)
}

function makeFetchers(token) {
  let lastSearchAt = 0

  async function searchPage(query, page) {
    // Search API 认证限速 30 req/min：串行 + 间隔。
    const now = Date.now()
    const waitMs = Math.max(0, lastSearchAt + SEARCH_INTERVAL_MS - now)
    lastSearchAt = Date.now() + waitMs
    if (waitMs > 0) await sleep(waitMs)
    return await ghApi(`/search/repositories?q=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}`, token)
  }

  // 全量分页：Search API 单查询封顶 1000 条，按 created 日期窗口二分，直到窗口不满页。
  async function searchTopic() {
    const repos = new Map()
    async function scan(from, to) {
      const capped = await scanRange(from, to, repos)
      if (!capped) return
      const parts = splitRange(from, to)
      if (parts === null) {
        console.warn(`bucket ${from}..${to} still capped at 1000, accepting partial`)
        return
      }
      for (const [a, b] of parts) await scan(a, b)
    }
    await scan(SEARCH_START, SEARCH_END)
    return [...repos.values()]
  }

  async function scanRange(from, to, repos) {
    const query = `topic:${TOPIC} created:${from}..${to}`
    let capped = false
    for (let page = 1; page <= SEARCH_MAX_PAGES; page += 1) {
      const data = await searchPage(query, page)
      const items = data.items ?? []
      for (const repo of items) repos.set(repo.full_name, repo)
      if (items.length < PER_PAGE) return false // 本窗口已取完
      if (page === SEARCH_MAX_PAGES) capped = true
    }
    return capped
  }

  async function fetchManifest(repo) {
    const branch = repo.defaultBranch
    const rawUrl = `${RAW_BASE}/${repo.fullName}/${branch}/${MANIFEST_NAME}`
    // 优先 raw HEAD（不占 API 配额）；429/失败时回退 git/trees（走认证 API，配额充足）。
    try {
      const result = await pacedRaw(rawUrl, TIMEOUT_MS, 1)
      return JSON.parse(result.bytes.toString('utf8'))
    } catch (rawError) {
      try {
        const tree = await ghApi(`/repos/${repo.fullName}/git/trees/${branch}?recursive=1`, token)
        const found = (tree.tree ?? []).find((item) => item.path === MANIFEST_NAME && item.type === 'blob')
        if (!found) return null
        const result = await pacedRaw(`${RAW_BASE}/${repo.fullName}/${branch}/${MANIFEST_NAME}`, TIMEOUT_MS, 1)
        return JSON.parse(result.bytes.toString('utf8'))
      } catch (error) {
        console.warn(`probe failed for ${repo.fullName}: raw ${rawError instanceof Error ? rawError.message : rawError}; trees ${error instanceof Error ? error.message : error}`)
        return null
      }
    }
  }

  async function fetchDownload(url) {
    const result = await pacedRaw(url)
    return { ok: true, bytes: result.bytes }
  }

  return { searchTopic, fetchManifest, fetchDownload }
}

// ---------- 主流程 ----------

export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// 把一个会触发 1000 条封顶的日期窗口切成两个不重叠子窗口；单日窗口不可再分返回 null。
export function splitRange(from, to) {
  if (from === to) return null
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const days = Math.round((end - start) / 86400000)
  if (days === 1) return [[from, from], [to, to]] // 相邻两天：拆成两个单日窗口
  const mid = addDays(from, Math.max(1, Math.floor(days / 2)))
  return [[from, mid], [addDays(mid, 1), to]]
}

async function runAll(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function pump() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      try {
        results[index] = await worker(items[index], index)
      } catch (error) {
        results[index] = { error }
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => pump())
  await Promise.all(workers)
  return results
}

export async function buildIndex({ token, indexPath = INDEX_PATH, removedPath = REMOVED_PATH, logPath = LOG_PATH }) {
  if (!token) throw new Error('GITHUB_TOKEN environment variable is required')

  const logLines = []
  const log = (line) => {
    logLines.push(line)
    console.log(line)
  }

  const removed = new Set()
  try {
    const parsed = JSON.parse(await readFile(removedPath, 'utf8'))
    if (Array.isArray(parsed)) for (const item of parsed) if (typeof item === 'string') removed.add(item)
  } catch {
    // removed.json 缺失/损坏视为空清单
  }

  let previous = []
  try {
    const parsed = JSON.parse(await readFile(indexPath, 'utf8'))
    if (Array.isArray(parsed.plugins)) previous = parsed.plugins
  } catch {
    // 首次运行无旧索引
  }
  const existing = new Map(previous.map((entry) => [entry.id, entry]))

  log(`[${new Date().toISOString()}] searching topic:${TOPIC}`)
  const { searchTopic, fetchManifest, fetchDownload } = makeFetchers(token)
  const searchResults = await searchTopic()
  const repos = searchResults.map((repo) => ({
    fullName: repo.full_name,
    fork: repo.fork === true,
    archived: repo.archived === true,
    defaultBranch: repo.default_branch ?? '',
  }))
  log(`found ${repos.length} candidate repos`)

  // 并发探测 manifest；repo.manifest 为对象或 null。
  const probed = await runAll(repos, MAX_CONCURRENCY, async (repo) => {
    const manifest = await fetchManifest(repo)
    return { repo: { ...repo, manifest } }
  })

  const entries = await collectCandidates({
    repos: probed.map((item) => item.repo).filter((repo) => repo.manifest !== undefined),
    fetchManifest: (repo) => repo.manifest,
    fetchDownload,
    removed,
    existing,
    log,
  })

  const plugins = [...entries.values()]
  const next = { version: 1, plugins }
  const tmp = `${indexPath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await rename(tmp, indexPath)
  log(`wrote ${indexPath} with ${plugins.length} plugins (atomic rename)`)

  try {
    const existingLog = await readFile(logPath, 'utf8').catch(() => '')
    await writeFile(logPath, existingLog + logLines.join('\n') + (logLines.length > 0 ? '\n' : ''), 'utf8')
  } catch (error) {
    console.warn(`cannot append ${logPath}: ${error instanceof Error ? error.message : error}`)
  }
  return { count: plugins.length }
}

async function main() {
  try {
    const token = process.env.GITHUB_TOKEN
    const result = await buildIndex({ token })
    console.log(`build-index.mjs: ok, ${result.count} plugins in index`)
  } catch (error) {
    console.error(`build-index.mjs: failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) await main()
