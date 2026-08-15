// collect.test.mjs — 收录逻辑单元测试（node:test，无依赖）。
// 运行：node --test test/
import test from 'node:test'
import assert from 'node:assert/strict'
import { collectCandidates, normalizeManifest, validateEntry, sha256Hex } from '../scripts/build-index.mjs'

const H = 'a'.repeat(64)
const validManifest = (overrides = {}) => ({
  version: 1,
  plugins: [
    {
      id: 'hello',
      name: 'Hello',
      version: '1.0.0',
      description: 'desc',
      type: 'static',
      downloadUrl: 'https://example.com/hello.js',
      checksum: H,
      entry: 'index.js',
      ...overrides,
    },
  ],
})
const plainRepo = (overrides = {}) => ({ fullName: 'owner/repo', fork: false, archived: false, defaultBranch: 'main', ...overrides })

test('合法 manifest 收录（含 checksum 不再下载）', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo()],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => { throw new Error('should not download when checksum present') },
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 1)
  assert.equal(entries.get('hello').id, 'hello')
  assert.equal(entries.get('hello').checksum, H)
  assert.equal(entries.get('hello').entry, 'index.js')
})

test('缺 checksum 时实算并写入', async () => {
  const bytes = Buffer.from('console.log(1)\n')
  const entries = await collectCandidates({
    repos: [plainRepo()],
    fetchManifest: async () => validManifest({ checksum: undefined }),
    fetchDownload: async () => ({ ok: true, bytes }),
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 1)
  assert.equal(entries.get('hello').checksum, sha256Hex(bytes))
})

test('缺 checksum 且算不出 → 过滤', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo()],
    fetchManifest: async () => validManifest({ checksum: undefined }),
    fetchDownload: async () => ({ ok: false, reason: 'HTTP 500' }),
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 0)
})

test('fork → 过滤', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo({ fullName: 'owner/forked', fork: true })],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 0)
})

test('archived → 过滤', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo({ archived: true })],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 0)
})

test('无默认分支 → 过滤', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo({ defaultBranch: '' })],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 0)
})

test('id 冲突保留先收录者（旧索引优先）', async () => {
  const logs = []
  const oldEntry = { id: 'hello', name: 'Old', version: '0.9.0', description: 'old', type: 'static', downloadUrl: 'https://example.com/old.js', checksum: H, entry: 'old.js' }
  const entries = await collectCandidates({
    repos: [plainRepo({ fullName: 'owner/newrepo' })],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(),
    existing: new Map([['hello', oldEntry]]),
    log: (line) => logs.push(line),
  })
  assert.equal(entries.size, 1)
  assert.equal(entries.get('hello').name, 'Old')
  assert.ok(logs.some((line) => line.includes('conflict') && line.includes('hello')))
})

test('id 冲突保留先收录者（本轮先见者优先）', async () => {
  const logs = []
  const entries = await collectCandidates({
    repos: [
      plainRepo({ fullName: 'owner/first' }),
      plainRepo({ fullName: 'owner/second' }),
    ],
    fetchManifest: async (repo) => validManifest(repo.fullName === 'owner/second' ? { name: 'Second' } : {}),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(),
    existing: new Map(),
    log: (line) => logs.push(line),
  })
  assert.equal(entries.size, 1)
  assert.equal(entries.get('hello').name, 'Hello')
  assert.ok(logs.some((line) => line.includes('conflict') && line.includes('owner/second')))
})

test('removed.json 命中仓库名 → 跳过', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo()],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(['owner/repo']),
    existing: new Map(),
  })
  assert.equal(entries.size, 0)
})

test('removed.json 命中插件 id → 跳过', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo()],
    fetchManifest: async () => validManifest(),
    fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
    removed: new Set(['hello']),
    existing: new Map(),
  })
  assert.equal(entries.size, 0)
})

test('removed.json 命中 → 旧索引条目下架', async () => {
  const oldEntry = { id: 'hello', name: 'Old', version: '0.9.0', description: 'old', type: 'static', downloadUrl: 'https://example.com/old.js', checksum: H, entry: 'old.js' }
  const logs = []
  const entries = await collectCandidates({
    repos: [],
    fetchManifest: async () => null,
    fetchDownload: async () => ({ ok: false, reason: 'unused' }),
    removed: new Set(['hello']),
    existing: new Map([['hello', oldEntry]]),
    log: (line) => logs.push(line),
  })
  assert.equal(entries.size, 0)
  assert.ok(logs.some((line) => line.includes('drop removed plugin hello')))
})

test('已收录但本轮无 manifest 的旧条目：跳过不删', async () => {
  const oldEntry = { id: 'keepme', name: 'Keep', version: '1.0.0', description: 'old', type: 'static', downloadUrl: 'https://example.com/k.js', checksum: H, entry: 'k.js' }
  const entries = await collectCandidates({
    repos: [],
    fetchManifest: async () => null,
    fetchDownload: async () => ({ ok: false, reason: 'unused' }),
    removed: new Set(),
    existing: new Map([['keepme', oldEntry]]),
  })
  assert.equal(entries.size, 1)
  assert.equal(entries.get('keepme').name, 'Keep')
})

test('单插件形态 manifest 也收录', async () => {
  const entries = await collectCandidates({
    repos: [plainRepo()],
    fetchManifest: async () => ({ id: 'bare', name: 'Bare', version: '1.0.0', description: 'd', type: 'dynamic', downloadUrl: 'https://example.com/b.js', checksum: H, entry: 'b.js' }),
    fetchDownload: async () => { throw new Error('unused') },
    removed: new Set(),
    existing: new Map(),
  })
  assert.equal(entries.size, 1)
  assert.equal(entries.get('bare').type, 'dynamic')
})

test('非法 manifest（坏 id / 非 HTTPS / 路径穿越 / 版本不符）→ 过滤', async () => {
  const cases = [
    validManifest({ id: 'Bad_ID' }),
    validManifest({ downloadUrl: 'http://example.com/x.js' }),
    validManifest({ entry: '../escape.js' }),
    { version: 2, plugins: [{ id: 'x', name: 'X', version: '1', description: 'd', type: 'static', downloadUrl: 'https://e.com/x.js', checksum: H, entry: 'x.js' }] },
  ]
  for (const manifest of cases) {
    const entries = await collectCandidates({
      repos: [plainRepo()],
      fetchManifest: async () => manifest,
      fetchDownload: async () => ({ ok: true, bytes: Buffer.from('x') }),
      removed: new Set(),
      existing: new Map(),
    })
    assert.equal(entries.size, 0, `expected filtered: ${JSON.stringify(manifest)}`)
  }
})

test('normalizeManifest：大写 checksum 归一化为小写', () => {
  const result = normalizeManifest({ version: 1, plugins: [{ id: 'x', name: 'X', version: '1', description: 'd', type: 'static', downloadUrl: 'https://e.com/x.js', checksum: 'A'.repeat(64), entry: 'x.js' }] })
  assert.equal(result.ok, true)
  assert.equal(result.plugins[0].checksum, 'a'.repeat(64))
})

test('validateEntry 拒绝非法 checksum', () => {
  const result = validateEntry({ id: 'x', name: 'X', version: '1', description: 'd', type: 'static', downloadUrl: 'https://e.com/x.js', checksum: 'zz', entry: 'x.js' })
  assert.equal(result.ok, false)
})
