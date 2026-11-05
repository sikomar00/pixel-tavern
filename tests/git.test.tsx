// [Git] 시험: 바뀐 파일 목록(-z 읽기, 종류 분류, 접기, 개수 제한, 경고색, 이름 정리).
import { expect, test } from 'claude-code/testing'
import { parseFiles, parseStatus } from '../hooks/git'
import { SCENES } from '../hooks/scenes'
import { WARN_COLOR } from '../hooks/svg'
import { PANE, START, contrast, toPorcelainZ, world } from './kit'

const HEAD = '## main\n'

test('[Git] 상태 코드는 새 파일·수정·삭제·이름 변경·충돌로 나뉘고, 충돌이 먼저 온다', () => {
  const out = `${HEAD} M a.ts\n?? b.ts\nA  c.ts\nAM d.ts\n D e.ts\nD  f.ts\nMD g.ts\nR  old.ts -> new/h.ts\nT  i.ts\nUU z.ts\nAA y.ts\n`

  expect(parseFiles(toPorcelainZ(out))).toEqual([
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

test('[Git] -z 출력: 제어 문자는 표시에서 빼고, 빈 칸·짧은 칸·끝의 NUL은 무시하고, 변경이 없으면 빈 목록이다', () => {
  expect(parseFiles('## main\0 M a\u0007b.ts\0\0 M \0??\0?? 한글/문서.md\0')).toEqual([
    { path: 'ab.ts', kind: 'modified' },
    { path: '한글/문서.md', kind: 'new' },
  ])
  expect(parseFiles('## main\0')).toEqual([])
  expect(parseFiles('')).toEqual([])
  expect(parseStatus('## main\0')).toEqual({ branch: 'main', ahead: 0, behind: 0, changed: 0 })
})

// 임시 저장소에서 실제 git으로 만든 출력이다: `git --no-optional-locks -c core.fsmonitor=false status --porcelain=v1 -z -b`. 만드는 법은 tools/git_fixture.py.
// Windows는 이름에 ">", 따옴표, 탭, 줄바꿈을 쓸 수 없어서 인덱스에 직접 넣어 만들었다(역슬래시 이름은 Windows의 git이 "/"로 바꿔 만들 수 없다).
// 이름 변경 두 건은 새 이름과 옛 이름 양쪽에 " -> "가 든다. -z 는 이름 변경을 "XY 새 경로" 다음 칸에 옛 경로로 준다. 줄 단위 출력에서는 이 이름들이 잘리거나 이스케이프가 그대로 보였다.
// 이름 변경 + 작업 폴더 수정(RM)과, 양쪽이 같은 파일을 다른 이름으로 바꿔 생긴 충돌(UA·AU·DD)도 들어 있다.
const REAL_Z = "## main\u0000UU conflict.txt\u0000 D del.txt\u0000A  emoji😀.txt\u0000D  gone\"q.txt\u0000A  line\nbreak.txt\u0000 M mod.txt\u0000R  plain-new.txt\u0000old -> name.txt\u0000A  q\"uote.txt\u0000R  renamed -> to new -> name.txt\u0000rn1.txt\u0000RM rm-dst.txt\u0000rm-src.txt\u0000UA rr-a.txt\u0000AU rr-b.txt\u0000DD rr.txt\u0000A  tab\tnew.txt\u0000A  ünï côde.txt\u0000?? newdir/\u0000?? untracked file.txt\u0000"

test('[Git] 실제 git -z 출력: 어려운 이름(따옴표·탭·줄바꿈·" -> "·이모지·악센트·공백), 이름 변경(+수정), 이름 변경끼리의 충돌을 그대로 읽는다', () => {
  expect(parseFiles(REAL_Z)).toEqual([
    { path: 'conflict.txt', kind: 'conflict' }, // 충돌이 먼저(git이 준 순서대로)
    { path: 'rr-a.txt', kind: 'conflict' }, // 이름 변경끼리의 충돌: UA, AU, DD 모두 경로가 하나뿐이다(옛 경로 칸이 없다)
    { path: 'rr-b.txt', kind: 'conflict' },
    { path: 'rr.txt', kind: 'conflict' },
    { path: 'del.txt', kind: 'deleted' },
    { path: 'emoji😀.txt', kind: 'new' },
    { path: 'gone"q.txt', kind: 'deleted' }, // 따옴표
    { path: 'linebreak.txt', kind: 'new' }, // 이름 속 줄바꿈 문자는 표시에서 뺀다
    { path: 'mod.txt', kind: 'modified' },
    { path: 'plain-new.txt', kind: 'renamed' }, // 옛 이름 "old -> name.txt"는 항목으로 세지 않는다
    { path: 'q"uote.txt', kind: 'new' },
    { path: 'renamed -> to new -> name.txt', kind: 'renamed' }, // 새 이름에 " -> "가 들어 있어도 잘리지 않는다
    { path: 'rm-dst.txt', kind: 'renamed' }, // 이름을 바꾸고 작업 폴더에서 또 고친 것(RM)도 옛 경로 칸이 따라온다
    { path: 'tabnew.txt', kind: 'new' }, // 이름 속 탭 문자는 표시에서 뺀다
    { path: 'ünï côde.txt', kind: 'new' },
    { path: 'newdir/', kind: 'new' },
    { path: 'untracked file.txt', kind: 'new' },
  ])
  expect(parseStatus(REAL_Z)).toEqual({ branch: 'main', ahead: 0, behind: 0, changed: 17 }) // 옛 이름 칸 3개(old -> name.txt, rn1.txt, rm-src.txt)는 개수에 들지 않는다
})

test('[Git] 패널: 실제 -z 출력의 이름 변경(새 이름에 " -> "가 든 것)이 잘리지 않고 보인다', async ($, on) => {
  const clock = world(on, { git: { status: '## main\0R  renamed -> to new -> name.txt\0rn1.txt\0', isZ: true } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'fold:changes' }))?.props.label).toBe('▸ 바뀐 파일 1개') // 옛 이름 칸(rn1.txt)은 1개로 세지 않는다
  await pane.press({ key: 'fold:changes' })
  expect(await pane.find({ type: 'Text', text: /^> renamed -> to new -> name\.txt$/ })).toBeDefined()
  await pane.unmount()
})

test('[Git] 출력이 한도에서 잘렸으면 마지막의 조각난 항목은 버린다', async ($, on) => {
  const clock = world(on, { git: { status: '## main\0 M a.ts\0 M b.t', isZ: true, isTruncated: true } }) // b.ts 의 끝이 잘렸다

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'fold:changes' }))?.props.label).toBe('▸ 바뀐 파일 1개')
  await pane.press({ key: 'fold:changes' })
  expect(await pane.find({ type: 'Text', text: /^~ a\.ts$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /b\.t/ })).toBeUndefined()
  await pane.unmount()
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
