// [Git] 시험: 바뀐 파일 목록(종류 분류, 접기, 개수 제한, 경고색, 이름 정리).
import { expect, test } from 'claude-code/testing'
import { parseFiles } from '../hooks/git'
import { SCENES } from '../hooks/scenes'
import { WARN_COLOR } from '../hooks/svg'
import { PANE, START, contrast, world } from './kit'

const HEAD = '## main\n'

test('[Git] 상태 코드는 새 파일·수정·삭제·이름 변경·충돌로 나뉘고, 충돌이 먼저 온다', () => {
  const out = `${HEAD} M a.ts\n?? b.ts\nA  c.ts\nAM d.ts\n D e.ts\nD  f.ts\nMD g.ts\nR  old.ts -> new/h.ts\nT  i.ts\nUU z.ts\nAA y.ts\n`

  expect(parseFiles(out)).toEqual([
    { path: 'z.ts', kind: 'conflict' },
    { path: 'y.ts', kind: 'conflict' },
    { path: 'a.ts', kind: 'modified' },
    { path: 'b.ts', kind: 'new' },
    { path: 'c.ts', kind: 'new' },
    { path: 'd.ts', kind: 'new' }, // index에 새로 올린 뒤 고친 것도 새 파일
    { path: 'e.ts', kind: 'deleted' },
    { path: 'f.ts', kind: 'deleted' },
    { path: 'g.ts', kind: 'deleted' }, // 올려 둔 수정 위에 작업 폴더에서 지운 것
    { path: 'new/h.ts', kind: 'renamed' }, // "옛 -> 새"에서 새 이름
    { path: 'i.ts', kind: 'modified' },
  ])
})

test('[Git] 따옴표·제어 문자·빈 줄·짧은 줄을 정리하고, 변경이 없으면 빈 목록이다', () => {
  expect(parseFiles(`${HEAD} M "a b.ts"\n?? x\u0007y.ts\n M \n??\n`)).toEqual([
    { path: 'a b.ts', kind: 'modified' }, // 공백이 든 이름은 git이 따옴표로 감싼다
    { path: 'xy.ts', kind: 'new' },
  ])
  expect(parseFiles(HEAD)).toEqual([])
  expect(parseFiles('')).toEqual([])
  expect(parseFiles(`${HEAD}?? 한글/문서.md\n`)).toEqual([{ path: '한글/문서.md', kind: 'new' }]) // quotePath=false 라서 한글이 그대로 온다
})

// 임시 저장소에서 실제 git으로 만든 출력이다(`git --no-optional-locks -c core.fsmonitor=false -c core.quotePath=false status --porcelain=v1 -b`).
// 한글 이름·공백(따옴표로 감싸임)·이름 변경("옛 -> 새")·합치기 충돌(UU)·index에 올린 새 파일(A)이 모두 들어 있다.
const REAL_GIT = [
  '## main',
  'A  added.ts',
  'UU conflict.txt',
  ' D del.ts',
  ' M dir/deep/x.ts',
  'R  ren_old.ts -> "dir/공백 이름.ts"',
  ' M mod.ts',
  'R  "sp ace.ts" -> ren_new.ts',
  '?? untracked.ts',
  '?? "새 파일.txt"',
  '',
].join('\n')

test('[Git] 실제 git이 내보낸 출력(한글·공백·이름 변경·충돌)을 그대로 읽는다', () => {
  expect(parseFiles(REAL_GIT)).toEqual([
    { path: 'conflict.txt', kind: 'conflict' },
    { path: 'added.ts', kind: 'new' },
    { path: 'del.ts', kind: 'deleted' },
    { path: 'dir/deep/x.ts', kind: 'modified' },
    { path: 'dir/공백 이름.ts', kind: 'renamed' }, // 이름을 바꾼 줄은 새 이름, 따옴표는 벗김
    { path: 'mod.ts', kind: 'modified' },
    { path: 'ren_new.ts', kind: 'renamed' },
    { path: 'untracked.ts', kind: 'new' },
    { path: '새 파일.txt', kind: 'new' },
  ])
})

test('[Git] 패널: 바뀐 파일은 기본으로 접혀 있고, 누르면 종류별 개수와 파일 줄이 나온다', async ($, on) => {
  const clock = world(on) // 기본 상태: " M a.ts", "?? b.ts"

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'fold:changes' }))?.props.label
  const row = async (pattern: RegExp) => pane.find({ type: 'Text', text: pattern })

  expect(await label()).toBe('▸ 바뀐 파일 2개')
  expect(await row(/^~ a\.ts$/)).toBeUndefined()
  await pane.press({ key: 'fold:changes' })
  expect(await label()).toBe('▾ 바뀐 파일 2개')
  expect((await row(/^새 1 · 수정 1$/))?.text).toBe('새 1 · 수정 1')
  expect(await row(/^~ a\.ts$/)).toBeDefined()
  expect(await row(/^\+ b\.ts$/)).toBeDefined()
  await pane.press({ key: 'fold:changes' })
  expect(await label()).toBe('▸ 바뀐 파일 2개')
  expect(await row(/^~ a\.ts$/)).toBeUndefined()
  await pane.unmount()
})

test('[Git] 패널: 충돌이 맨 위에, 삭제·충돌은 경고색으로 나오고, 길면 8줄까지 보이고 나머지는 개수로 알린다', async ($, on) => {
  const many = Array.from({ length: 9 }, (_, i) => ` M src/f${i}.ts`).join('\n')
  const clock = world(on, { git: { status: `${HEAD}${many}\n D gone.ts\nUU clash.ts\n` } }) // 변경 11개

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'fold:changes' })
  const rows = (await pane.findAll({ type: 'Text', text: /^[+~>!-] / })).map(node => node.text)

  expect(rows).toHaveLength(8)
  expect(rows[0]).toBe('! clash.ts') // 충돌이 먼저
  expect(await pane.find({ type: 'Text', text: /^충돌 1 · 수정 9 · 삭제 1$/ })).toBeDefined()
  expect((await pane.find({ type: 'Text', text: /^! clash\.ts$/ }))?.props.color).toBe(WARN_COLOR)
  expect(await pane.find({ type: 'Text', text: /^…외 3개$/ })).toBeDefined() // 11개 중 8줄만
  expect(await pane.find({ type: 'Text', text: /^- gone\.ts$/ })).toBeUndefined() // 삭제 줄은 9번째라 개수에만 들어 있다
  await pane.unmount()
})

test('[Git] 패널: 삭제 줄은 경고색이고, 긴 경로는 마지막 두 칸만 보이며, 이름을 바꾼 파일은 새 이름이 나온다', async ($, on) => {
  const clock = world(on, { git: { status: `${HEAD} D gone.ts\nR  a/b/old.ts -> a/b/c/d/new.ts\n` } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'fold:changes' })
  expect((await pane.find({ type: 'Text', text: /^- gone\.ts$/ }))?.props.color).toBe(WARN_COLOR)
  expect(await pane.find({ type: 'Text', text: /^> d\/new\.ts$/ })).toBeDefined()
  await pane.unmount()
})

test('[Git] 패널: 변경이 없으면 바뀐 파일 줄이 없다', async ($, on) => {
  const clock = world(on, { git: { status: HEAD } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ key: 'fold:changes' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /변경 없음/ })).toBeDefined()
  await pane.unmount()
})

test('[Git] 패널: git 저장소가 아니면 바뀐 파일 줄 없이 안내만 나온다', async ($, on) => {
  const clock = world(on, { git: { status: '', exitCode: 128 } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ key: 'fold:changes' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /Git 저장소가 아니에요/ })).toBeDefined()
  await pane.unmount()
})

test('[Git] 패널: 새 폴더는 끝의 /가 남아 파일과 구분된다', async ($, on) => {
  const clock = world(on, { git: { status: `${HEAD}?? newdir/\n?? file.ts\n` } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'fold:changes' })
  expect(await pane.find({ type: 'Text', text: /^\+ newdir\/$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^\+ file\.ts$/ })).toBeDefined()
  await pane.unmount()
})

test('[Git] 경고색(삭제·충돌 줄)은 4개 장면의 바탕 위에서 글자 대비 4.5 이상이다', () => {
  for (const scene of Object.values(SCENES)) expect(contrast(WARN_COLOR, scene.base), scene.title).toBeGreaterThanOrEqual(4.5)
})
