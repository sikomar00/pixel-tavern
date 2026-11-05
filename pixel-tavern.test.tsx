import { expect, mock, test } from 'claude-code/testing'

import { ART, composeScene } from './hooks/art'
import { baseName, fmtReset, shortModel } from './hooks/format'
import { parseLog, parseStatus } from './hooks/git'
import { bannerSvg } from './hooks/banner'
import { limitsSvg } from './hooks/limits'
import { MODES, SCENES } from './hooks/scenes'
import { WARN_COLOR, clipWidth } from './hooks/svg'
import { TEXT_PRIMARY, chipOf, lift, surfaceOf } from './hooks/theme'

const NOON = Date.parse('2026-11-04T12:00:00')

const BAND = {
  plugin: 'pixel-tavern',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const PANE = {
  plugin: 'pixel-tavern',
  component: 'Pane',
  requestId: 'tavern',
  props: { title: '여관', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const USAGE = {
  startedAt: 0,
  context: { tokens: 84000, window: 200000, percent: 42 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-11-04T13:37:00' },
    { kind: 'seven_day', percentUsed: 7, resetsAt: '2026-11-06T15:00:00' },
  ],
  cost: { usd: 1.234 },
}

const GIT_STATUS = '## main...origin/main [ahead 1, behind 2]\n M a.ts\n?? b.ts\n'
const GIT_LOG = 'abc1234\tfeat: 배너 추가\ndef5678\tfix: 한도 표시'

/** 숫자 칸: 숫자 글자가 라벨 글자 바로 앞에 놓인다. */
const counter = async (ui: { findAll: (q: object) => Promise<{ text?: string }[]> }, label: string) => {
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text)

  return texts[texts.indexOf(label) - 1]
}

/** 엔진이 받쳐 주는 호출을 흉내 낸다. 시계와 저장소는 키트가 메모리로 답한다. */
type Spy = { ran: string[]; filled: string[]; toasts: string[] }
type GitFake = { status: string; exitCode?: number }
type World = { spy?: Spy; stored?: object; git?: GitFake; usage?: typeof USAGE }

const newSpy = (): Spy => ({ ran: [], filled: [], toasts: [] })

const world = (
  on: Parameters<typeof mock.clock>[0],
  { spy = newSpy(), stored = {}, git = { status: GIT_STATUS }, usage = USAGE }: World = {},
) => {
  const clock = mock.clock(on, { now: NOON })

  mock.store(on, stored)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'tavern' } }))
  on('command.run', (_, e) => {
    spy.ran.push(e.command)

    return { text: '' }
  })
  on('prompt.fill', (_, e) => {
    spy.filled.push(e.text)

    return { isFilled: true }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    spy.toasts.push(e.text)

    return { value: undefined }
  })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => ({ value: usage }))
  on('process.run', (_, e) => ({
    value: {
      exitCode: e.argv.includes('status') ? (git.exitCode ?? 0) : 0,
      stdout: e.argv.includes('status') ? git.status : GIT_LOG,
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>엔진 내용</Text>
  })

  return clock
}

test('순수 도우미: 시간·모델·파일 주소·git 출력 읽기', async () => {
  const now = Date.parse('2026-11-04T10:00:00Z')

  expect(fmtReset('2026-11-04T11:37:00Z', now)).toBe('1h 37m')
  expect(fmtReset('2026-11-04T10:12:00Z', now)).toBe('12m')
  expect(fmtReset('2026-11-06T13:00:00Z', now)).toBe('2d 3h')
  expect(fmtReset('2026-11-04T09:00:00Z', now)).toBe('곧')
  expect(fmtReset(undefined, now)).toBe('')
  expect(shortModel('claude-sonnet-5-5')).toBe('Sonnet 5.5')
  expect(baseName('C:\\a b\\c.ts')).toBe('c.ts')
  expect(parseStatus(GIT_STATUS)).toEqual({ branch: 'main', ahead: 1, behind: 2, changed: 2 })
  expect(parseStatus('## No commits yet on dev\n')).toEqual({ branch: 'dev', ahead: 0, behind: 0, changed: 0 })
  expect(parseLog(GIT_LOG)).toEqual([
    { hash: 'abc1234', subject: 'feat: 배너 추가' },
    { hash: 'def5678', subject: 'fix: 한도 표시' },
  ])
})

test('장면 그림과 장면 데이터가 어긋나지 않는다', async () => {
  const ids = MODES.flatMap(mode => mode.scenes)

  expect(ids).toHaveLength(4)
  for (const id of ids) {
    const scene = SCENES[id]
    const art = ART[id]
    const svg = composeScene(art, 42)

    expect(art.labelName, `${id} 게이지 이름`).toBe(scene.gauges.context)
    expect(svg).toContain(`${scene.gauges.context} 42%`)
    expect(svg).toContain(scene.title)
    expect(svg).toContain(scene.motto)
    expect(art.gauges).toHaveLength(21)
    expect(svg.length).toBeLessThan(131072)
    expect(composeScene(art, null)).toContain(`${scene.gauges.context} -`)
    expect(art.base).toBe(scene.base)
  }
})

test('배너: 사용량·프로젝트·브랜치를 그리고 엔진 내용을 남긴다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/my-project', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)

  expect(svg).toContain('비 오는 밤 다락방')
  expect(svg).toContain('my-project')
  expect(svg).toContain('main +2')
  expect(svg).toContain('Sonnet 5.5')
  expect(svg).toContain('42%')
  expect(svg).toContain('리셋 1h 37m')
  expect((await ui.find({ type: 'Text', text: /엔진 내용/ }))?.text).toBe('엔진 내용')
  await ui.unmount()
})

test('배너: ⟳는 4개 장면을 차례로 돌고, ✕로 숨겼다가 다시 연다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const title = async () => String((await ui.find({ type: 'Svg' }))?.props.source)

  expect(await title()).toContain('비 오는 밤 다락방')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('7080 다방')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('8비트 던전')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('네온 펑크 성')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('비 오는 밤 다락방') // 한 바퀴
  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.press({ key: 'show' })
  expect(await title()).toContain('비 오는 밤 다락방')
  await ui.unmount()
})

test('터미널에서는 글자 한 줄 띠로 대신한다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/p', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /촛불/ }))?.text).toContain('main')
  expect((await ui.find({ type: 'Button' }))?.props.label).toBe('▶')
  await ui.unmount()
})

test('패널: 장면을 고르면 바뀌고, 한도·프로젝트·최근 커밋이 보인다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/my-project', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const sources = async () => (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props.source))

  expect(await sources()).toHaveLength(2)
  expect((await sources())[0]).toContain('비 오는 밤 다락방')
  expect((await sources())[1]).toContain('24% 사용')
  expect((await sources())[1]).toContain('1h 37m 뒤 리셋')
  expect((await ui.find({ type: 'Text', text: /abc1234/ }))?.text).toContain('배너 추가')
  expect(await ui.find({ type: 'Text', text: /변경 2개/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /올릴 커밋 1/ }))?.text).toBe('올릴 커밋 1 · 받을 커밋 2')
  await ui.select({ key: 'scene', value: 'dungeon' })
  expect((await sources())[0]).toContain('8비트 던전')
  await ui.select({ key: 'scene', value: 'neon' })
  expect((await sources())[0]).toContain('네온 펑크 성')
  await ui.unmount()
})

test('오늘 통계와 이 채팅의 파일: Edit·Write만 기록하고, 누르면 @경로를 넣는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: 'C:/work/p/b.ts', content: 'x' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/a.ts', old_string: 'b', new_string: 'c' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await counter(ui, '도구 실행')).toBe('4')
  expect(await counter(ui, '수정 파일')).toBe('2')
  const files = (await ui.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file:'))

  expect(files.map(button => button.props.label)).toEqual(['p/b.ts', 'p/a.ts']) // 최근 것이 위, 폴더 이름을 붙여 구분
  await ui.press({ key: 'file:C:/work/p/b.ts' })
  expect(spy.filled).toEqual(['@C:/work/p/b.ts '])
  await ui.unmount()
})

test('어제의 통계는 0으로 보이고, 오늘 첫 기록부터 새로 센다', async ($, on) => {
  const yesterday = { date: '2026-11-3', prompts: 5, actions: 9, files: ['C:/old.ts'] }
  const clock = world(on, { stored: { today: yesterday } })

  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await counter(ui, '도구 실행')).toBe('0')
  expect(await counter(ui, '수정 파일')).toBe('0')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await counter(ui, '도구 실행')).toBe('1')
  await ui.unmount()
})

test('빠른 실행: 커밋은 두 번 눌러야 실행된다', async ($, on) => {
  const spy = newSpy()
  const { ran } = spy
  const clock = world(on, { spy })

  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await ui.press({ key: 'review' })
  expect(ran).toEqual(['code-review'])
  await ui.press({ key: 'commit' })
  expect(ran).toEqual(['code-review'])
  expect((await ui.find({ key: 'commit' }))?.props.label).toBe('한 번 더: 커밋')
  await ui.press({ key: 'commit' })
  expect(ran).toEqual(['code-review', 'commit-commands:commit'])
  expect((await ui.find({ key: 'commit' }))?.props.label).toBe('커밋')
  await ui.unmount()
})

test('음악: ▶는 이 장면의 방송을 켜고 ■는 끈다. 장면을 바꾸면 방송도 바뀐다', async ($, on) => {
  const clock = world(on)
  const urls: string[] = []

  // 재생기 프로세스 대신: 연결 → 재생 신호를 보내고, 반 초마다 "."을 쓴다.
  on('process.spawn', async function* (_, e) {
    urls.push(String(e.env?.TAVERN_URL))
    yield { stream: 'stdout', text: 'connecting\n' }
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  for (const id of MODES.flatMap(mode => mode.scenes)) {
    expect(SCENES[id].music.stream, id).toMatch(/^http:\/\//) // Windows 재생기는 https를 못 연다
  }
  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const icon = async () => (await banner.find({ type: 'Button' }))?.props.label
  const paneButtons = async () => (await pane.findAll({ type: 'Button' })).map(b => b.props.label)

  expect(await icon()).toBe('▶')
  expect(await paneButtons()).toContain('▶ 재생')
  await banner.press({ key: 'music' })
  expect(await icon()).toBe('■')
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).toContain(`♪ ${SCENES.attic.music.label}`)
  expect(await paneButtons()).toContain('■ 정지')
  expect(await pane.find({ type: 'Text', text: /● 재생 중/ })).toBeDefined()
  expect(urls).toEqual([SCENES.attic.music.stream])
  await banner.press({ key: 'shuffle' })
  expect(urls).toEqual([SCENES.attic.music.stream, SCENES.tearoom.music.stream])
  expect(await icon()).toBe('■')
  await banner.press({ key: 'music' })
  expect(await icon()).toBe('▶')
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).not.toContain('♪')
  await clock.advance(1000) // 옛 재생기들이 정지 신호를 보고 끝난다
  expect(await icon()).toBe('▶')
  expect(urls).toHaveLength(2)
  await banner.unmount()
  await pane.unmount()
})

test('글자 폭 자르기: 한글은 넓게, 영문은 좁게 센다', async () => {
  expect(clipWidth('abc', 3, 10)).toBe('abc')
  expect(clipWidth('가나다라마바사', 3, 10)).toBe('가나…')
  expect(clipWidth('abcdefghij', 3, 10)).toBe('abcd…')
})

test('경고 기준은 배너와 패널이 같다', async () => {
  const hot = { limits: [{ kind: 'five_hour', percentUsed: 85 }] } as never
  const cool = { limits: [{ kind: 'five_hour', percentUsed: 84 }] } as never
  const banner = (usage: never) =>
    bannerSvg({ scene: SCENES.attic, usage, git: null, model: null, project: 'p', now: NOON, radio: 'off' })

  expect(limitsSvg(SCENES.attic, hot, NOON)).toContain(WARN_COLOR)
  expect(banner(hot)).toContain(WARN_COLOR)
  expect(limitsSvg(SCENES.attic, cool, NOON)).not.toContain(WARN_COLOR)
  expect(banner(cool)).not.toContain(WARN_COLOR)
})

test('배너 게이지: 100%여도 이름이 퍼센트와 겹치지 않게 자른다', async () => {
  const at = (percentUsed: number) =>
    bannerSvg({
      scene: SCENES.attic,
      usage: { limits: [{ kind: 'five_hour', percentUsed }] } as never,
      git: null,
      model: null,
      project: 'p',
      now: NOON,
      radio: 'off',
    })

  expect(at(3)).toContain('>오늘의 의뢰<')
  expect(at(100)).not.toContain('>오늘의 의뢰<')
})

type Env = Record<string, string | undefined>
type Clock = ReturnType<typeof mock.clock>

/** 재생기 프로세스 대신: 연결(→ 재생) 신호를 보내고 반 초마다 "."을 쓴다. 켤 때마다 환경변수를 기록한다. */
const fakePlayer = (on: Parameters<typeof mock.clock>[0], clock: Clock, seen: Env[], isStuck = false) =>
  on('process.spawn', async function* (_, e) {
    seen.push((e.env ?? {}) as Env)
    yield { stream: 'stdout', text: 'connecting\n' }
    if (!isStuck) yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })

const START = { cwd: 'C:/work/p', surface: 'desktop', isInteractive: true } as const

test('음악: 음량 −/+는 단계를 바꾸고, 켜져 있으면 새 음량으로 다시 켠다', async ($, on) => {
  const clock = world(on)
  const seen: Env[] = []

  fakePlayer(on, clock, seen)
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bars = async () => (await pane.find({ type: 'Text', text: /^[●○]+$/ }))?.text

  expect(await bars()).toBe('●●●○○')
  await pane.press({ key: 'volume-up' })
  expect(await bars()).toBe('●●●●○')
  expect(seen).toHaveLength(0) // 꺼져 있으면 재생기를 켜지 않는다
  await pane.press({ key: 'radio' })
  for (let i = 0; i < 4; i++) await pane.press({ key: 'volume-down' }) // 마지막 한 번은 맨 아래라 아무 일도 없다
  expect(await bars()).toBe('●○○○○')
  expect(seen.map(env => env.TAVERN_VOLUME)).toEqual(['0.6', '0.4', '0.25', '0.1'])
  await pane.press({ key: 'radio' })
  await clock.advance(1000)
  await pane.unmount()
})

for (const [saved, shown] of [
  [5, '●●●●●'],
  [9, '●●●○○'], // 범위 밖 값은 버린다
] as const) {
  test(`음량: 저장된 ${saved}은 ${shown}로 보인다`, async ($, on) => {
    const clock = world(on, { stored: { volume: saved } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await pane.find({ type: 'Text', text: /^[●○]+$/ }))?.text).toBe(shown)
    await pane.unmount()
  })
}

test('배너를 숨겨도 음악이 켜져 있으면 끄는 버튼은 남는다', async ($, on) => {
  const clock = world(on)

  fakePlayer(on, clock, [])
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await banner.press({ key: 'hide' })
  expect(await banner.find({ key: 'music' })).toBeUndefined() // 꺼져 있으면 ▣ 여관만 남는다
  await banner.press({ key: 'show' })
  await banner.press({ key: 'music' })
  await banner.press({ key: 'hide' })
  expect((await banner.find({ key: 'music' }))?.props.label).toBe('■')
  await banner.press({ key: 'music' })
  expect(await banner.find({ key: 'music' })).toBeUndefined()
  await clock.advance(1000)
  await banner.unmount()
})

test('음악: 30초가 지나도 연결 중이면 알려 준다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  const slow = () => spy.toasts.filter(text => text.includes('아직 연결하지 못했어요'))

  fakePlayer(on, clock, [], true)
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await banner.press({ key: 'music' })
  await clock.advance(29_000)
  expect(slow()).toHaveLength(0)
  await clock.advance(2_000)
  expect(slow()).toHaveLength(1)
  await banner.press({ key: 'music' })
  await clock.advance(1000)
  await banner.unmount()
})

test('빠른 실행: 바뀐 파일이 없으면 커밋은 알려 주기만 하고 실행하지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy, git: { status: '## main\n' } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual([])
  expect(spy.toasts).toContain('커밋할 변경이 없어요')
  expect((await pane.find({ key: 'commit' }))?.props.label).toBe('커밋') // "한 번 더"로 바뀌지 않는다
  await pane.unmount()
})

test('패널: 한도 정보가 비어 있으면 이유를 알려 준다', async ($, on) => {
  const clock = world(on, { usage: { ...USAGE, rateLimits: [] } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ type: 'Text', text: /받은 한도 정보가 없어요/ })).toBeDefined()
  await pane.unmount()
})

test('처음 한 번만 안내 문구를 보여 준다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  await $.session.start(START)
  await clock.settle()
  expect(spy.toasts.filter(text => text.includes('픽셀 여관이 열렸어요'))).toHaveLength(1)
})

test('한 턴이 끝나면(측정) git 상태를 바로 다시 읽어 배너의 +N이 맞는다', async ($, on) => {
  const git = { status: '## main\n' }
  const clock = world(on, { git })

  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  expect(await svg()).not.toContain('main +')
  git.status = GIT_STATUS // Claude가 이번 턴에 파일 두 개를 바꿨다
  await $.session.measure({ ...USAGE, changed: ['context'] })
  await clock.settle()
  expect(await svg()).toContain('main +2')
  await banner.unmount()
})
// ── 최종 검증(추가 시험): 이름이 '검증:'으로 시작한다 ─────────────────────────────

const filledSegments = (svg: string): number => (svg.match(/width="6" height="8" fill="#(?!ffffff)/g) ?? []).length

const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const contrast = (a: string, b: string): number => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (hi + 0.05) / (lo + 0.05)
}

test('검증: 한도 0·3·45·100%와 초과 상태에서 숫자와 막대가 일치한다', async () => {
  const at = (scene: (typeof SCENES)[keyof typeof SCENES], percentUsed: number) =>
    limitsSvg(scene, { limits: [{ kind: 'five_hour', percentUsed, resetsAt: '2026-11-04T13:37:00' }] } as never, NOON)

  for (const scene of Object.values(SCENES)) {
    for (const [percent, filled] of [[0, 0], [3, 1], [45, 18], [100, 40], [120, 40]] as const) {
      const svg = at(scene, percent)

      expect(svg, `${scene.id} ${percent}% 숫자`).toContain(`>${percent}% 사용<`)
      expect(filledSegments(svg), `${scene.id} ${percent}% 막대`).toBe(filled)
    }
    // 5시간 단위임과 리셋까지 남은 시간을 문구로 알린다.
    expect(at(scene, 45), scene.id).toContain('5H')
    expect(at(scene, 45), scene.id).toContain('1h 37m 뒤 리셋')
  }
  // 주간 한도가 없는 줄은 0%처럼 보이지 않고 "정보 없음"이라고 쓴다.
  expect(at(SCENES.attic, 45)).toContain('>정보 없음<')
  // 배너도 같은 반올림을 쓴다.
  const banner = bannerSvg({ scene: SCENES.attic, usage: { limits: [{ kind: 'five_hour', percentUsed: 44.6 }] } as never, git: null, model: null, project: 'p', now: NOON, radio: 'off' })

  expect(banner).toContain('>45%<')
})

test('검증: 4개 장면의 글자색 대비가 4.5 이상이다', async () => {
  for (const scene of Object.values(SCENES)) {
    expect(contrast(scene.muted, scene.base), `${scene.id} 흐린 글자`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(scene.accent, scene.base), `${scene.id} 강조색`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(WARN_COLOR, scene.base), `${scene.id} 경고색`).toBeGreaterThanOrEqual(4.5)
  }
})

test('검증: 커밋 첫 클릭은 대기 상태를 보이고, 5초가 지나면 처음으로 돌아간다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'commit' }))?.props.label
  const waiting = async () => (await pane.find({ type: 'Text', text: /5초 안에 누르면 실행/ })) !== undefined

  await pane.press({ key: 'commit' })
  expect(await label()).toBe('한 번 더: 커밋')
  expect(await waiting()).toBe(true)
  await clock.advance(4_000)
  expect(await label()).toBe('한 번 더: 커밋')
  await clock.advance(2_000)
  expect(await label()).toBe('커밋')
  expect(await waiting()).toBe(false)
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' }) // 초기화된 뒤에는 다시 두 번 눌러야 한다
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual(['commit-commands:commit'])
  await pane.unmount()
})

test('검증: 실행 직후 다시 대기시켜도 예전 타이머가 대기를 일찍 끝내지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'commit' }))?.props.label

  await pane.press({ key: 'commit' }) // 0초: 대기(5초 타이머 시작)
  await pane.press({ key: 'commit' }) // 실행
  await clock.advance(4_000)
  await pane.press({ key: 'commit' }) // 4초: 다시 대기(9초까지)
  await clock.advance(2_000) // 6초: 첫 타이머의 5초가 지났다
  expect(await label()).toBe('한 번 더: 커밋')
  await clock.advance(4_000) // 10초
  expect(await label()).toBe('커밋')
  expect(spy.ran).toEqual(['commit-commands:commit'])
  await pane.unmount()
})

test('검증: 대기 중인 커밋 버튼을 연달아 눌러도 커밋은 한 번만 실행된다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'commit' })
  await Promise.all([pane.press({ key: 'commit' }), pane.press({ key: 'commit' }), pane.press({ key: 'commit' })])
  expect(spy.ran.filter(command => command === 'commit-commands:commit').length).toBeLessThanOrEqual(1)
  await pane.unmount()
})

test('검증: git 저장소가 아니면 정보 문구만 보이고, 커밋은 막지 않는다', async ($, on) => {
  const clock = world(on, { git: { status: '', exitCode: 128 } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ type: 'Text', text: /Git 저장소가 아니에요/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /변경 (\d+개|없음)/ })).toBeUndefined()
  await pane.press({ key: 'commit' })
  expect((await pane.find({ key: 'commit' }))?.props.label).toBe('한 번 더: 커밋')
  await pane.unmount()
})

for (const [status, hint] of [
  ['## main...origin/main [ahead 3]\n M a.ts\n', '올릴 커밋 3'],
  ['## main...origin/main [behind 2]\n', '받을 커밋 2'],
  ['## main...origin/main\n', undefined],
] as const) {
  test(`검증: 원격 상태 ${JSON.stringify(status.split('\n')[0])}`, async ($, on) => {
    const clock = world(on, { git: { status } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await pane.find({ type: 'Text', text: /(올릴|받을) 커밋/ }))?.text).toBe(hint)
    expect(await pane.find({ type: 'Text', text: status.includes(' M ') ? /변경 1개/ : /변경 없음/ })).toBeDefined()
    await pane.unmount()
  })
}

test('검증: 프로젝트 이름이 길면 배너는 칸 안에서 자르고 패널은 한 줄로 줄인다', async ($, on) => {
  const long = 'a-very-long-project-name-that-keeps-going-2026-11-04-980f42'
  const korean = '아주아주아주긴프로젝트이름이계속됩니다'
  const svg = (project: string) =>
    bannerSvg({ scene: SCENES.attic, usage: null, git: null, model: null, project, now: NOON, radio: 'off' })

  for (const name of [long, korean]) {
    expect(svg(name)).not.toContain(`>${name}<`)
    expect(svg(name)).toContain('…<')
  }
  const clock = world(on)

  await $.session.start({ ...START, cwd: `C:/work/${long}` })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ type: 'Text', text: long }))?.props.wrap).toBe('truncate-end')
  await pane.unmount()
})

test('검증: 수정 파일이 늘어나도 최근 8개만 보이고 나머지는 개수로 알려 준다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const fileButtons = async () => (await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file:'))
  const edit = async (from: number, to: number) => {
    for (let i = from; i <= to; i++) await $.tool.call({ tool: 'Edit', file_path: `C:/work/p/f${i}.ts`, old_string: 'a', new_string: 'b' })
  }

  await edit(1, 8)
  expect(await fileButtons()).toHaveLength(8)
  expect(await pane.find({ type: 'Text', text: /^외 \d+개$/ })).toBeUndefined()
  await edit(9, 12)
  const shown = await fileButtons()

  expect(shown).toHaveLength(8)
  expect(shown[0]?.props.label).toBe('p/f12.ts') // 가장 최근이 맨 위
  expect((await pane.find({ type: 'Text', text: /^외 \d+개$/ }))?.text).toBe('외 4개')
  expect(await counter(pane, '수정 파일')).toBe('12')
  await edit(13, 60)
  expect((await pane.find({ type: 'Text', text: /^외 \d+개$/ }))?.text).toBe('외 42개') // 이 채팅 목록은 50개까지만 기억한다
  expect(await counter(pane, '수정 파일')).toBe('60')
  await pane.unmount()
})

// ── 디자인 검증(추가 시험) ──────────────────────────────────────────────────

test('디자인: 카드·칩 배경은 바탕보다 밝고, 그 위 글자 대비도 4.5 이상이다', async () => {
  expect(lift('#000000', 0.5)).toBe('#808080')
  expect(lift('#ffffff', 0.3)).toBe('#ffffff')
  for (const scene of Object.values(SCENES)) {
    for (const [name, bg] of [['카드', surfaceOf(scene)], ['칩', chipOf(scene)]] as const) {
      expect(luminance(bg), `${scene.id} ${name}은 바탕보다 밝다`).toBeGreaterThan(luminance(scene.base))
      expect(contrast(scene.muted, bg), `${scene.id} ${name} 위 흐린 글자`).toBeGreaterThanOrEqual(4.5)
      // 강조색은 카드 위에서는 글자(4.5), 칩 위에서는 점(3)으로만 쓴다.
      expect(contrast(scene.accent, bg), `${scene.id} ${name} 위 강조색`).toBeGreaterThanOrEqual(name === '카드' ? 4.5 : 3)
      expect(contrast(TEXT_PRIMARY, bg), `${scene.id} ${name} 위 밝은 글자`).toBeGreaterThanOrEqual(7)
    }
  }
})

test('디자인: 패널 구역이 정해진 순서로 이름표를 달고 나온다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)
  const order = ['음악', '빠른 실행', '사용량 한도', '작업 현황', '이 채팅에서 만진 파일'].map(title => texts.indexOf(title))

  expect(order.every(index => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order) // 위에서 아래로 이 순서
  await pane.unmount()
})
// ── UI 2차 검증(추가 시험) ────────────────────────────────────────────────────

test('디자인 2차: 구역 배경이 바탕과 카드로 번갈아 나온다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bands = (await pane.findAll({ type: 'Box' })).filter(node => node.props.paddingY === 'md')
  const tones = bands.map(node => (node.props.backgroundColor === surfaceOf(SCENES.attic) ? '카드' : '바탕'))

  // 설정 · 음악 · 빠른 실행 · 사용량 · 작업 현황 · 만진 파일
  expect(tones).toEqual(['바탕', '카드', '바탕', '카드', '바탕', '카드'])
  await pane.unmount()
})

test('디자인 2차: 만진 파일은 소제목으로 작업 현황 바로 아래에 붙는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const title = async (text: string) => (await pane.find({ type: 'Text', text }))?.props
  const headline = await title('작업 현황')
  const sub = await title('이 채팅에서 만진 파일')

  expect(headline?.weight).toBe('semibold')
  expect(headline?.size).toBeUndefined() // 머리글은 본문 크기
  expect(sub?.size).toBe('footnote') // 소제목은 한 단계 작다
  expect(sub?.color).toBe(SCENES.attic.muted) // 강조색이 아니라 흐린 글자
  await pane.unmount()
})

test('디자인 2차: 커밋 대기로 라벨이 길어져도 세 줄 모두 같은 폭의 버튼 칸을 쓴다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const cells = async () => (await pane.findAll({ type: 'Box' })).filter(node => node.props.minWidth !== undefined).map(node => node.props.minWidth)

  expect(await cells()).toEqual([14, 14, 14])
  await pane.press({ key: 'commit' }) // 대기 상태
  expect((await pane.find({ key: 'commit' }))?.props.label).toBe('한 번 더: 커밋')
  expect(await cells()).toEqual([14, 14, 14])
  expect(await pane.find({ type: 'Text', text: /5초 안에 누르면 실행/ })).toBeDefined()
  await pane.unmount()
})

test('디자인 2차: 좁은 패널에서 줄바꿈되는 줄과 긴 파일명 처리', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/a-really-long-file-name-that-would-overflow-the-narrow-panel.test.tsx', old_string: 'a', new_string: 'b' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const boxes = await pane.findAll({ type: 'Box' })

  // 음악(상태·조작), git 칩, 숫자 칸: 폭이 모자라면 아래 줄로 내려간다.
  expect(boxes.filter(node => node.props.flexWrap === 'wrap').length).toBeGreaterThanOrEqual(4)
  // 파일 한 줄은 넘치는 부분을 잘라 낸다.
  expect(boxes.filter(node => node.props.overflow === 'hidden')).toHaveLength(1)
  await pane.unmount()
})

// ── 모드/장면 통합 검증(추가 시험) ────────────────────────────────────────────

test('장면 통합: 선택 칸은 장면 하나뿐이고 4개 장면이 모두 들어 있다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const selects = await pane.findAll({ type: 'Select' })

  expect(selects).toHaveLength(1)
  expect(selects[0]?.key).toBe('scene')
  expect((selects[0]?.props.options as { value: string }[]).map(option => option.value)).toEqual(['attic', 'tearoom', 'dungeon', 'neon'])
  await pane.unmount()
})

test('장면 통합: 패널에서 고른 장면에서 ⟳가 이어서 돈다(마지막 다음은 처음)', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const title = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  await pane.select({ key: 'scene', value: 'dungeon' })
  await banner.press({ key: 'shuffle' })
  expect(await title()).toContain('네온 펑크 성')
  await banner.press({ key: 'shuffle' })
  expect(await title()).toContain('비 오는 밤 다락방')
  await pane.unmount()
  await banner.unmount()
})

test('장면 통합: 예전 버전이 저장한 모드·장면 설정도 그대로 읽는다', async ($, on) => {
  const saved = { mode: 'adventure', sceneByMode: { cozy: 'tearoom', adventure: 'neon' } }
  const clock = world(on, { stored: { mood: saved } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(String((await pane.find({ type: 'Svg' }))?.props.source)).toContain('네온 펑크 성')
  await pane.unmount()
})
