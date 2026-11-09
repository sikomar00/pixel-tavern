// 그리기 비용 측정(Node): 엔진 밖에서 모드의 "순수 함수"만 잰다. 엔진이 SVG를 해석·그리는 시간은 잴 수 없다(앱에서만 가능, R-18).
// 사용: node tools/bench_render.cjs   (hooks를 TypeScript로 임시 폴더에 옮겨 적은 뒤 불러 쓴다. 저장소 파일은 건드리지 않는다)
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { performance } = require('node:perf_hooks')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(os.tmpdir(), 'pixel-tavern-bench')
const ts = require(path.join(ROOT, 'node_modules/typescript/lib/typescript.js'))

const t0 = performance.now()
fs.rmSync(OUT, { recursive: true, force: true })
const walk = (dir, rel = '') =>
  fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(dir, path.join(rel, e.name)) : [path.join(rel, e.name)]))

for (const rel of walk(path.join(ROOT, 'hooks'))) {
  if (!/\.tsx?$/.test(rel)) continue
  const src = fs.readFileSync(path.join(ROOT, 'hooks', rel), 'utf8')
  const js = ts.transpileModule(src, { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'h' } }).outputText
  const target = path.join(OUT, 'hooks', rel.replace(/\.tsx?$/, '.js'))

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, js)
}
console.log(`(준비: TypeScript로 옮겨 적기 ${(performance.now() - t0).toFixed(0)}ms — 측정 대상 아님)\n`)

// 엔진 모듈 대용: atom/read/update는 쓰이기만 하고 여기서는 부르지 않는다.
const load = Module._load
Module._load = function (request, ...rest) {
  if (request === 'claude-code') return { atom: (ref, initial) => ({ ref, initial }), read: async () => null, update: async () => undefined }

  return load.call(this, request, ...rest)
}
globalThis.h = (type, props, ...children) => ({ type, props, children })
const ui = new Proxy({}, { get: (_, name) => String(name) })
const need = rel => require(path.join(OUT, 'hooks', rel))

// ------------------------------------------------------------------ 불러오기 비용(처음 한 번)
const timeLoad = (label, rel) => {
  const start = performance.now()
  const mod = need(rel)

  console.log(`불러오기 ${label.padEnd(34)} ${(performance.now() - start).toFixed(1).padStart(7)}ms`)

  return mod
}
console.log('== 1. 모듈 불러오기(처음 한 번, Node 기준 — 앱의 모듈 로더에서는 다를 수 있음) ==')
const art = timeLoad('art/index (그림 10장 ≈ 440KB)', 'art/index.js')
const cellsArt = timeLoad('art/cells (터미널 칸 그림 10장)', 'art/cells/index.js')
const scenes = timeLoad('scenes', 'scenes.js')
const banner = timeLoad('banner (+ usage·svg·still·effects)', 'banner.js')
const cells = timeLoad('cells', 'cells.js')
const panel = timeLoad('panel (+ layout·music·quick …)', 'panel.js')
const term = timeLoad('term', 'term.js')

// ------------------------------------------------------------------ 통계 도우미
const stats = samples => {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]

  return { first: samples[0], median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] }
}
const bench = (label, fn, { n = 300, warm = 30, size } = {}) => {
  const samples = []
  let last

  for (let i = 0; i < n + warm; i += 1) {
    const start = performance.now()

    last = fn()
    if (i >= warm) samples.push(performance.now() - start)
  }
  const s = stats(samples)
  const bytes = size === undefined ? '' : `  ${String(size(last)).padStart(7)}B`

  console.log(`${label.padEnd(46)} 중앙 ${s.median.toFixed(3).padStart(7)}ms  95% ${s.p95.toFixed(3).padStart(7)}ms  최대 ${s.max.toFixed(2).padStart(6)}ms${bytes}`)

  return s
}
// 가장 처음 한 번의 호출(JIT 전)만 따로 잰다.
const firstCall = (label, fn) => {
  const start = performance.now()

  fn()
  console.log(`첫 호출 ${label.padEnd(40)} ${(performance.now() - start).toFixed(2).padStart(7)}ms`)
}

// ------------------------------------------------------------------ 자료
const NOON = new Date('2026-11-06T12:00:00').getTime()
const usage = { limits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: NOON + 3_600_000 }, { kind: 'weekly', percentUsed: 17, resetsAt: NOON + 86_400_000 }], context: { percentUsed: 63, tokens: 126000 } }
const bannerData = (id, over = {}) => ({
  scene: scenes.SCENES[id], usage, git: { branch: 'main', changed: 3, ahead: 0, behind: 0, commits: [], files: [] }, model: 'claude-sonnet-5-5', effort: 'high', songTitle: '', project: 'pixel-tavern',
  now: NOON, radio: 'off', isMusicAvailable: true, motion: 'full', brightness: 'normal', reaction: '', ...over,
})
const ids = Object.keys(art.ART)
const sceneAt = (id, over) => art.composeScene(art.ART[id], 63, over)

// ------------------------------------------------------------------ 2. 그림 합치기·정지
console.log('\n== 2. 데스크톱 그림(10장면 전체의 평균을 내지 않고 가장 큰 장면 attic 과 가장 작은 dungeon 을 따로 본다) ==')
for (const id of ['attic', 'dungeon']) {
  const A = art.ART[id]
  const shade = require(path.join(OUT, 'hooks/effects.js'))

  firstCall(`${id} composeScene (JIT 전)`, () => art.composeScene(A, 63))
  bench(`${id} composeScene`, () => art.composeScene(A, 63), { size: s => s.length })
  bench(`${id} composeScene + motionSvg(low)`, () => require(path.join(OUT, 'hooks/still.js')).motionSvg(art.composeScene(A, 63), 'low'), { size: s => s.length })
  bench(`${id} composeScene + motionSvg(off=정지)`, () => require(path.join(OUT, 'hooks/still.js')).motionSvg(art.composeScene(A, 63), 'off'), { size: s => s.length })
  bench(`${id} 패널 그림 한 장 전체(밝기 어둡게+반짝임+low)`, () => require(path.join(OUT, 'hooks/still.js')).motionSvg(art.composeScene(A, 63, shade.shadeSvg('dim', 85, 74) + shade.flashSvg('done', 'low', 85, 74)), 'low'), { size: s => s.length })
}

console.log('\n== 3. 배너 띠 SVG(bannerSvg): 게이지·글자·모델·git 줄까지 한 장 ==')
for (const id of ['attic', 'dungeon']) {
  firstCall(`${id} bannerSvg (JIT 전)`, () => banner.bannerSvg(bannerData(id)))
  bench(`${id} bannerSvg 보통`, () => banner.bannerSvg(bannerData(id)), { size: s => s.length })
  bench(`${id} bannerSvg 효과 끔`, () => banner.bannerSvg(bannerData(id, { motion: 'off' })), { size: s => s.length })
  bench(`${id} bannerSvg 어둡게+반짝임`, () => banner.bannerSvg(bannerData(id, { brightness: 'dim', reaction: 'done' })), { size: s => s.length })
}
bench('10장면 전부 bannerSvg 한 바퀴', () => ids.forEach(id => banner.bannerSvg(bannerData(id))), { n: 60 })

// ------------------------------------------------------------------ 4. 터미널 그림
console.log('\n== 4. 터미널 색 블록 그림 ==')
const fill = id => cells.hexToInt(scenes.SCENES[id].base)
for (const id of ['attic', 'dungeon']) {
  firstCall(`${id} scenePicture 100칸 (JIT 전)`, () => cells.scenePicture(cellsArt.CELLS[id], 63, 100, fill(id)))
  bench(`${id} scenePicture 100칸(85칸 그림)`, () => cells.scenePicture(cellsArt.CELLS[id], 63, 100, fill(id)), { size: p => p.cells.length })
  bench(`${id} scenePicture 60칸(절반 배율)`, () => cells.scenePicture(cellsArt.CELLS[id], 63, 60, fill(id)), { size: p => p.cells.length })
  bench(`${id} scenePicture 100칸 + 어둡게`, () => cells.scenePicture(cellsArt.CELLS[id], 63, 100, fill(id), 'dim'), { size: p => p.cells.length })
  bench(`${id} emblemPicture(배너 엠블럼 12×5)`, () => cells.emblemPicture(cellsArt.CELLS[id], fill(id)), { size: p => p.cells.length })
}

// ------------------------------------------------------------------ 5. 화면 구성 트리 만들기(엔진 그리기 전 단계)
console.log('\n== 5. 화면 구성 트리 만들기(패널 함수 호출만. 엔진이 이 트리를 그리는 시간은 포함 안 됨) ==')
const count = node => (node === null || typeof node !== 'object' ? 0 : Array.isArray(node) ? node.reduce((n, c) => n + count(c), 0) : 1 + count(node.children))
const act = new Proxy({}, { get: () => async () => undefined })
const panelData = (id, over = {}) => ({
  ...bannerData(id),
  radioNote: '', openHelp: '', isDiag: false, frame: { columns: 51, rows: 63, placement: 'dock', surface: 'desktop' },
  today: { date: '2026-11-6', prompts: 12, actions: 48, files: ['a1b2c3d4', 'e5f6a7b8', '99887766'] }, projects: [], favorites: [], stationTab: '', timeline: [], timelineCount: 0,
  streak: { count: 3, best: 5 }, todos: [{ id: '1', text: '문서 쓰기', done: false, star: true }, { id: '2', text: '시험 돌리기', done: true, star: false }], chatFiles: ['src/a.ts', 'src/b.ts'],
  isFilesOpen: false, isPickerOpen: false, armedKey: null, work: { state: 'idle' }, volume: 3, collapsed: [], ...over,
})
let tree
try {
  const d = panelData('attic')

  d.scene = { ...d.scene, music: { label: 'REYFM 로파이', url: 'http://example/x', group: 'x' } }
  firstCall('패널 panelView (JIT 전)', () => (tree = panel.panelView(ui, d, act)))
  console.log(`   트리 노드 수 ${count(tree)}`)
  bench('데스크톱 panelView(전부 펼침)', () => panel.panelView(ui, d, act), { n: 200, size: () => count(tree) })
  const dFold = { ...d, collapsed: ['music', 'quick', 'todo', 'usage', 'status', 'files', 'art'] }

  bench('데스크톱 panelView(전부 접음)', () => panel.panelView(ui, dFold, act), { n: 200 })
  const dt = { ...d, frame: { ...d.frame, surface: 'terminal', columns: 100 } }

  bench('터미널 termPanelView', () => term.termPanelView(ui, dt, act), { n: 200 })
  bench('터미널 termBanner', () => term.termBanner(ui, { ...dt, isHidden: false }, act), { n: 200 })
} catch (error) {
  console.log('   (패널 트리 측정 실패:', error instanceof Error ? error.stack?.split('\n').slice(0, 4).join(' | ') : error, ')')
}
