/* Zero-dependency test runner. Each test file runs in its own Node process, so one file's setup hooks and mock
 * storage can never leak into another. TypeScript is transpiled on the fly with the project's own compiler,
 * the "@/" alias is resolved, and browser storage is stubbed.
 *
 *   node scripts/run-tests.cjs              run every *.test.ts under features/
 *   node scripts/run-tests.cjs <file.ts>    run a single file (used internally)
 */
const Module = require('module')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')

function findTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.next') return []
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return findTests(full)
    return entry.name.endsWith('.test.ts') ? [full] : []
  })
}

function runSingleFile(file) {
  const ts = require(path.join(root, 'node_modules/typescript'))
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }
  globalThis.__resetStorage = () => storage.clear()

  const resolveFilename = Module._resolveFilename
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request.startsWith('@/')) request = path.join(root, request.slice(2))
    if (request === 'cn') request = path.join(root, 'node_modules/cn')
    for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
      try { return resolveFilename.call(this, request + suffix, parent, ...rest) } catch { /* try next suffix */ }
    }
    return resolveFilename.call(this, request, parent, ...rest)
  }
  for (const extension of ['.ts', '.tsx']) {
    require.extensions[extension] = (module, filename) => {
      const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: 'commonjs', target: 'es2020', jsx: 'react-jsx', esModuleInterop: true } })
      module._compile(output.outputText, filename)
    }
  }
  require(file)
}

const target = process.argv[2]
if (target) {
  runSingleFile(path.resolve(target))
} else {
  const files = [...findTests(path.join(root, 'features')), ...findTests(path.join(root, 'lib'))]
  if (!files.length) { console.error('No test files found.'); process.exit(1) }
  const totals = { tests: 0, pass: 0, fail: 0 }
  let failedFiles = 0
  for (const file of files) {
    const result = spawnSync(process.execPath, [__filename, file], { encoding: 'utf8' })
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    for (const key of Object.keys(totals)) {
      const match = new RegExp(`^ℹ ${key} (\\d+)`, 'm').exec(result.stdout)
      if (match) totals[key] += Number(match[1])
    }
    if (result.status !== 0) failedFiles += 1
  }
  console.log(`\nFiles: ${files.length} · tests ${totals.tests} · pass ${totals.pass} · fail ${totals.fail}`)
  process.exit(failedFiles === 0 && totals.fail === 0 ? 0 : 1)
}
