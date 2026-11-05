import { expect, mock, test } from 'claude-code/testing'

import { ART, composeScene } from './hooks/art'
import { baseName, fmtReset, shortModel } from './hooks/format'
import { parseLog, parseStatus } from './hooks/git'
import { bannerSvg } from './hooks/banner'
import { QUICK } from './hooks/actions'
import { HELP } from './hooks/help'
import { NO_ALERTS, checkAlerts } from './hooks/alerts'
import { mergeToday } from './hooks/state'
import { filledSegments as segmentsFor, usageSummary, usageSvg, usageWidthFor } from './hooks/usage'
import { MODES, SCENES } from './hooks/scenes'
import { WARN_COLOR, clipWidth } from './hooks/svg'
import { TEXT_PRIMARY, chipOf, lift, surfaceOf } from './hooks/theme'

const NOON = Date.parse('2026-11-04T12:00:00')
const COMMIT_LABEL = QUICK.find(item => item.key === 'commit')?.label // 버튼 이름은 QUICK 한 곳에서만 정한다
const ARMED_LABEL = '한 번 더' // 커밋을 한 번 누른 5초 동안의 라벨

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
type World = { spy?: Spy; stored?: object; git?: GitFake; usage?: typeof USAGE; whereExit?: number; tool?: { value: object }; liveStore?: Record<string, unknown> }

const newSpy = (): Spy => ({ ran: [], filled: [], toasts: [] })

const world = (
  on: Parameters<typeof mock.clock>[0],
  { spy = newSpy(), stored = {}, git = { status: GIT_STATUS }, usage = USAGE, whereExit = 0, tool = { value: { result: {} } }, liveStore }: World = {},
) => {
  const clock = mock.clock(on, { now: NOON })

  if (liveStore === undefined) mock.store(on, stored)
  else {
    // 채팅끼리 공유되는 저장소를 흉내 낸다: 시험이 객체를 직접 고쳐 "다른 채팅"의 기록을 남길 수 있다.
    on('store.get', (_, e) => ({ value: liveStore[e.key] }))
    on('store.set', (_, e) => {
      liveStore[e.key] = e.value

      return { value: undefined }
    })
  }
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
      exitCode: e.argv[0] === 'where.exe' ? whereExit : e.argv.includes('status') ? (git.exitCode ?? 0) : 0,
      stdout: e.argv.includes('status') ? git.status : GIT_LOG,
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('tool.call', () => tool.value)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>엔진 내용</Text>
  })

  return clock
}

test('[데이터] 순수 도우미: 시간·모델·파일 주소·git 출력 읽기', async () => {
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

test('[데이터] 장면 그림과 장면 데이터가 어긋나지 않는다', async () => {
  const ids = MODES.flatMap(mode => mode.scenes)

  expect(ids).toHaveLength(4)
  for (const id of ids) {
    const scene = SCENES[id]
    const art = ART[id]
    const svg = composeScene(art, 42)

    expect(art.labelName, `${id} 게이지 이름`).toBe(scene.gauges.context)
    expect(svg).toContain(`${scene.gauges.context} 42%`)
    expect(svg).toContain('viewBox="0 0 85 74"') // 그림이 끝나는 줄에서 자른다
    expect(svg).not.toContain(scene.title) // 제목·모토 블록은 그리지 않는다(장면 선택 칸과 배너에 있다)
    expect(svg).not.toContain(scene.motto)
    expect(art.gauges).toHaveLength(21)
    expect(svg.length).toBeLessThan(131072)
    expect(composeScene(art, null)).toContain(`${scene.gauges.context} -`)
    expect(art.base).toBe(scene.base)
  }
})

test('[데이터] 배너: 사용량·프로젝트·브랜치를 그리고 엔진 내용을 남긴다', async ($, on) => {
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

test('[기능] 배너: ⟳는 4개 장면을 차례로 돌고, ✕로 숨겼다가 다시 연다', async ($, on) => {
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

test('[레이아웃] 터미널에서는 글자 한 줄 띠로 대신한다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/p', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /촛불/ }))?.text).toContain('main')
  expect((await ui.find({ type: 'Button' }))?.props.label).toBe('▶')
  await ui.unmount()
})

test('[기능] 패널: 장면을 고르면 바뀌고, 한도·프로젝트·최근 커밋이 보인다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/my-project', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const sources = async () => (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props.source))
  const alts = async () => (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt))

  expect(await sources()).toHaveLength(2)
  expect((await alts())[0]).toContain('비 오는 밤 다락방')
  expect((await sources())[1]).toContain('>24%<') // 5시간 사용량
  expect((await sources())[1]).toContain('>42%<') // 컨텍스트
  expect((await sources())[1]).toContain('84k/200k')
  expect((await sources())[1]).toContain('1h 37m 뒤 리셋')
  expect(await ui.find({ type: 'Text', text: /abc1234/ })).toBeUndefined() // 커밋 로그는 기본으로 접혀 있다
  await ui.press({ key: 'fold:commits' })
  expect((await ui.find({ type: 'Text', text: /abc1234/ }))?.text).toContain('배너 추가')
  expect(await ui.find({ type: 'Text', text: /변경 2개/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /올릴 커밋 1/ }))?.text).toBe('올릴 커밋 1 · 받을 커밋 2')
  await ui.select({ key: 'scene', value: 'dungeon' })
  expect((await alts())[0]).toContain('8비트 던전')
  await ui.select({ key: 'scene', value: 'neon' })
  expect((await alts())[0]).toContain('네온 펑크 성')
  await ui.unmount()
})

test('[데이터] 오늘 통계와 이 채팅의 파일: Edit·Write만 기록하고, 누르면 @경로를 넣는다', async ($, on) => {
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

test('[데이터] 어제의 통계는 0으로 보이고, 오늘 첫 기록부터 새로 센다', async ($, on) => {
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

test('[상태] 빠른 실행: 커밋은 두 번 눌러야 실행된다', async ($, on) => {
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
  expect((await ui.find({ key: 'commit' }))?.props.label).toBe(ARMED_LABEL)
  await ui.press({ key: 'commit' })
  expect(ran).toEqual(['code-review', 'commit-commands:commit'])
  expect((await ui.find({ key: 'commit' }))?.props.label).toBe(COMMIT_LABEL)
  await ui.unmount()
})

test('[상태] 음악: ▶는 이 장면의 방송을 켜고 ■는 끈다. 장면을 바꾸면 방송도 바뀐다', async ($, on) => {
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

test('[레이아웃] 글자 폭 자르기: 한글은 넓게, 영문은 좁게 센다', async () => {
  expect(clipWidth('abc', 3, 10)).toBe('abc')
  expect(clipWidth('가나다라마바사', 3, 10)).toBe('가나…')
  expect(clipWidth('abcdefghij', 3, 10)).toBe('abcd…')
})

test('[데이터] 경고 기준은 배너와 패널이 같다', async () => {
  const hot = { limits: [{ kind: 'five_hour', percentUsed: 85 }] } as never
  const cool = { limits: [{ kind: 'five_hour', percentUsed: 84 }] } as never
  const banner = (usage: never) =>
    bannerSvg({ scene: SCENES.attic, usage, git: null, model: null, project: 'p', now: NOON, radio: 'off' })

  expect(usageSvg(SCENES.attic, hot, NOON)).toContain(WARN_COLOR)
  expect(banner(hot)).toContain(WARN_COLOR)
  expect(usageSvg(SCENES.attic, cool, NOON)).not.toContain(WARN_COLOR)
  expect(banner(cool)).not.toContain(WARN_COLOR)
})

test('[레이아웃] 배너 게이지: 100%여도 이름이 퍼센트와 겹치지 않게 자른다', async () => {
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

test('[기능] 음악: 음량 −/+는 단계를 바꾸고, 켜져 있으면 새 음량으로 다시 켠다', async ($, on) => {
  const clock = world(on)
  const seen: Env[] = []

  fakePlayer(on, clock, seen)
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bars = async () => (await pane.find({ type: 'Text', text: /^[●○]{5}$/ }))?.text

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
  test(`[상태] 음량: 저장된 ${saved}은 ${shown}로 보인다`, async ($, on) => {
    const clock = world(on, { stored: { volume: saved } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await pane.find({ type: 'Text', text: /^[●○]{5}$/ }))?.text).toBe(shown)
    await pane.unmount()
  })
}

test('[사용성] 배너를 숨겨도 음악이 켜져 있으면 끄는 버튼은 남는다', async ($, on) => {
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

test('[상태] 음악: 30초가 지나도 연결 중이면 알려 준다', async ($, on) => {
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

test('[기능] 빠른 실행: 바뀐 파일이 없으면 커밋은 알려 주기만 하고 실행하지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy, git: { status: '## main\n' } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual([])
  expect(spy.toasts).toContain('커밋할 변경이 없어요')
  expect((await pane.find({ key: 'commit' }))?.props.label).toBe(COMMIT_LABEL) // "한 번 더"로 바뀌지 않는다
  await pane.unmount()
})

test('[사용성] 패널: 한도 정보가 비어 있으면 이유를 알려 준다', async ($, on) => {
  const clock = world(on, { usage: { ...USAGE, rateLimits: [] } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ type: 'Text', text: /받은 한도 정보가 없어요/ })).toBeDefined()
  await pane.unmount()
})

test('[사용성] 처음 한 번만 안내 문구를 보여 준다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  await $.session.start(START)
  await clock.settle()
  expect(spy.toasts.filter(text => text.includes('픽셀 여관이 열렸어요'))).toHaveLength(1)
})

test('[데이터] 한 턴이 끝나면(측정) git 상태를 바로 다시 읽어 배너의 +N이 맞는다', async ($, on) => {
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

const filledSegments = (svg: string): number => (svg.match(/stroke="#(?!ffffff)/g) ?? []).length

const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const contrast = (a: string, b: string): number => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (hi + 0.05) / (lo + 0.05)
}

test('[데이터] 사용량 0·3·45·100%와 초과 상태에서 숫자와 원의 칸 수가 일치한다', async () => {
  const at = (scene: (typeof SCENES)[keyof typeof SCENES], percentUsed: number) =>
    usageSvg(scene, { limits: [{ kind: 'five_hour', percentUsed, resetsAt: '2026-11-04T13:37:00' }] } as never, NOON)

  for (const scene of Object.values(SCENES)) {
    for (const [percent, filled] of [[0, 0], [3, 1], [45, 9], [100, 20], [120, 20]] as const) {
      const svg = at(scene, percent)

      expect(svg, `${scene.id} ${percent}% 숫자`).toContain(`>${percent}%<`)
      expect(filledSegments(svg), `${scene.id} ${percent}% 원`).toBe(filled)
    }
    // 기능 이름이 먼저, 테마 이름은 그 아래. 리셋까지 남은 시간도 문구로 알린다.
    expect(at(scene, 45), scene.id).toContain('>5시간 한도<')
    expect(at(scene, 45), scene.id).toContain(`>${scene.gauges.fiveHour.split(' · ')[0]}<`)
    expect(at(scene, 45), scene.id).toContain('1h 37m 뒤 리셋')
  }
  // 주간 한도가 없는 원은 0%처럼 보이지 않고 "정보 없음"이라고 쓴다.
  expect(at(SCENES.attic, 45)).toContain('>정보 없음<')
  // 배너도 같은 반올림을 쓴다.
  const banner = bannerSvg({ scene: SCENES.attic, usage: { limits: [{ kind: 'five_hour', percentUsed: 44.6 }] } as never, git: null, model: null, project: 'p', now: NOON, radio: 'off' })

  expect(banner).toContain('>45%<')
})

test('[레이아웃] 4개 장면의 글자색 대비가 4.5 이상이다', async () => {
  for (const scene of Object.values(SCENES)) {
    expect(contrast(scene.muted, scene.base), `${scene.id} 흐린 글자`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(scene.accent, scene.base), `${scene.id} 강조색`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(WARN_COLOR, scene.base), `${scene.id} 경고색`).toBeGreaterThanOrEqual(4.5)
  }
})

test('[상태] 커밋 첫 클릭은 대기 상태를 보이고, 5초가 지나면 처음으로 돌아간다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'commit' }))?.props.label
  const waiting = async () => (await pane.find({ type: 'Text', text: /5초 안에 한 번 더 누르면 변경을 커밋해요/ })) !== undefined

  await pane.press({ key: 'commit' })
  expect(await label()).toBe(ARMED_LABEL)
  expect(await waiting()).toBe(true)
  await clock.advance(4_000)
  expect(await label()).toBe(ARMED_LABEL)
  await clock.advance(2_000)
  expect(await label()).toBe(COMMIT_LABEL)
  expect(await waiting()).toBe(false)
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' }) // 초기화된 뒤에는 다시 두 번 눌러야 한다
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual(['commit-commands:commit'])
  await pane.unmount()
})

test('[상태] 실행 직후 다시 대기시켜도 예전 타이머가 대기를 일찍 끝내지 않는다', async ($, on) => {
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
  expect(await label()).toBe(ARMED_LABEL)
  await clock.advance(4_000) // 10초
  expect(await label()).toBe(COMMIT_LABEL)
  expect(spy.ran).toEqual(['commit-commands:commit'])
  await pane.unmount()
})

test('[상태] 대기 중인 커밋 버튼을 연달아 눌러도 커밋은 한 번만 실행된다', async ($, on) => {
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

test('[데이터] git 저장소가 아니면 정보 문구만 보이고, 커밋은 막지 않는다', async ($, on) => {
  const clock = world(on, { git: { status: '', exitCode: 128 } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ type: 'Text', text: /Git 저장소가 아니에요/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /변경 (\d+개|없음)/ })).toBeUndefined()
  await pane.press({ key: 'commit' })
  expect((await pane.find({ key: 'commit' }))?.props.label).toBe(ARMED_LABEL)
  await pane.unmount()
})

for (const [status, hint] of [
  ['## main...origin/main [ahead 3]\n M a.ts\n', '올릴 커밋 3'],
  ['## main...origin/main [behind 2]\n', '받을 커밋 2'],
  ['## main...origin/main\n', undefined],
] as const) {
  test(`[데이터] 원격 상태 ${JSON.stringify(status.split('\n')[0])}`, async ($, on) => {
    const clock = world(on, { git: { status } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await pane.find({ type: 'Text', text: /^(올릴|받을) 커밋 \d/ }))?.text).toBe(hint)
    expect(await pane.find({ type: 'Text', text: status.includes(' M ') ? /변경 1개/ : /변경 없음/ })).toBeDefined()
    await pane.unmount()
  })
}

test('[레이아웃] 프로젝트 이름이 길면 배너는 칸 안에서 자르고 패널은 한 줄로 줄인다', async ($, on) => {
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

test('[사용성] 만진 파일은 기본 4개만 보이고, 전체 보기·접기로 펼친다(이 채팅 목록은 50개까지만 기억)', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const fileButtons = async () => (await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file:'))
  const toggle = async () => (await pane.find({ key: 'files-toggle' }))?.props.label
  const edit = async (from: number, to: number) => {
    for (let i = from; i <= to; i++) await $.tool.call({ tool: 'Edit', file_path: `C:/work/p/f${i}.ts`, old_string: 'a', new_string: 'b' })
  }

  await edit(1, 4)
  expect(await fileButtons()).toHaveLength(4)
  expect(await toggle()).toBeUndefined() // 4개 이하면 펼칠 것이 없다
  await edit(5, 12)
  expect(await fileButtons()).toHaveLength(4) // 기본은 최근 4개
  expect((await fileButtons())[0]?.props.label).toBe('p/f12.ts') // 가장 최근이 맨 위
  expect(await toggle()).toBe('전체 보기 (12)')
  expect(await pane.find({ type: 'Text', text: '이 채팅 12개' })).toBeDefined()
  await pane.press({ key: 'files-toggle' })
  expect(await fileButtons()).toHaveLength(12)
  expect(await toggle()).toBe('접기')
  await pane.press({ key: 'files-toggle' })
  expect(await fileButtons()).toHaveLength(4)
  await edit(13, 60)
  await pane.press({ key: 'files-toggle' })
  expect(await fileButtons()).toHaveLength(50) // 수집 한도는 그대로 50개
  expect(await counter(pane, '수정 파일')).toBe('60') // 오늘 누적은 따로 센다
  await pane.unmount()
})

// ── 디자인 검증(추가 시험) ──────────────────────────────────────────────────

test('[레이아웃] 카드·칩 배경은 바탕보다 밝고, 그 위 글자 대비도 4.5 이상이다', async () => {
  expect(lift('#000000', 0.5)).toBe('#808080')
  expect(lift('#ffffff', 0.3)).toBe('#ffffff')
  for (const scene of Object.values(SCENES)) {
    for (const [name, bg] of [['카드', surfaceOf(scene)], ['칩', chipOf(scene)]] as const) {
      expect(luminance(bg), `${scene.id} ${name}은 바탕보다 밝다`).toBeGreaterThan(luminance(scene.base))
      expect(contrast(scene.muted, bg), `${scene.id} ${name} 위 흐린 글자`).toBeGreaterThanOrEqual(4.5)
      // 강조색은 카드 위에서는 글자(4.5), 칩 위에서는 점(3)으로만 쓴다.
      expect(contrast(scene.accent, bg), `${scene.id} ${name} 위 강조색`).toBeGreaterThanOrEqual(name === '카드' ? 4.5 : 3)
      expect(contrast(TEXT_PRIMARY, bg), `${scene.id} ${name} 위 밝은 글자`).toBeGreaterThanOrEqual(7)
      if (name === '카드') expect(contrast(WARN_COLOR, bg), `${scene.id} 카드 위 경고색`).toBeGreaterThanOrEqual(4.5) // 음악 카드의 "연결 실패"
    }
  }
})

test('[레이아웃] 패널 구역이 정해진 순서로 이름표를 달고 나온다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)
  const order = ['음악', '빠른 실행', '사용량', '작업 현황', '이 채팅에서 만진 파일'].map(title => texts.indexOf(title))

  expect(order.every(index => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order) // 위에서 아래로 이 순서
  await pane.unmount()
})
// ── UI 2차 검증(추가 시험) ────────────────────────────────────────────────────

test('[레이아웃] 만진 파일은 소제목으로 작업 현황 바로 아래에 붙는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const title = async (text: string) => (await pane.find({ type: 'Text', text: new RegExp(`^${text}$`) }))?.props // 숨겨진 설명 글자와 섞이지 않게 정확히
  const headline = await title('작업 현황')
  const sub = await title('이 채팅에서 만진 파일')

  expect(headline?.weight).toBe('semibold')
  expect(headline?.size).toBeUndefined() // 머리글은 본문 크기
  expect(sub?.size).toBe('footnote') // 소제목은 한 단계 작다
  expect(sub?.color).toBe(SCENES.attic.muted) // 강조색이 아니라 흐린 글자
  await pane.unmount()
})

test('[사용성] 빠른 실행은 버튼만 한 줄에 두고, 설명은 늘어놓지 않으며, 커밋 대기에는 안내가 덧붙는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const waiting = async () => (await pane.find({ type: 'Text', text: /5초 안에 한 번 더 누르면 변경을 커밋해요/ })) !== undefined
  const labels = async () => Promise.all(QUICK.map(async item => (await pane.find({ key: item.key }))?.props.label))
  const names = QUICK.map(item => item.label)

  expect(names).toEqual(['코드 리뷰', '변경 커밋', '코드 정리']) // 무엇을 하는 버튼인지 이름만으로 알 수 있다
  expect(await labels()).toEqual(names)
  expect((await pane.findAll({ type: 'Box' })).filter(node => node.props.minWidth !== undefined)).toHaveLength(0)
  expect(await pane.find({ type: 'Text', text: /^(바뀐 코드를 검토해요|코드를 다듬어요)$/ })).toBeUndefined() // 설명은 "?"에만 있다
  expect(await waiting()).toBe(false)
  await pane.press({ key: 'commit' })
  expect(await labels()).toEqual([names[0], ARMED_LABEL, names[2]]) // 대기 중에도 다른 버튼 라벨은 그대로, 줄 길이도 비슷하다
  expect(await waiting()).toBe(true)
  await pane.unmount()
})

test('[레이아웃] 좁은 패널에서 줄바꿈되는 줄과 긴 파일명 처리', async ($, on) => {
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

test('[기능] 장면 통합: 선택 칸은 장면 하나뿐이고 4개 장면이 모두 들어 있다', async ($, on) => {
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

test('[기능] 장면 통합: 패널에서 고른 장면에서 ⟳가 이어서 돈다(마지막 다음은 처음)', async ($, on) => {
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

test('[데이터] 장면 통합: 예전 버전이 저장한 모드·장면 설정도 그대로 읽는다', async ($, on) => {
  const saved = { mode: 'adventure', sceneByMode: { cozy: 'tearoom', adventure: 'neon' } }
  const clock = world(on, { stored: { mood: saved } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(String((await pane.find({ type: 'Svg' }))?.props.alt)).toContain('네온 펑크 성')
  await pane.unmount()
})

// ── 3차 검증(추가 시험): 원형 사용량, 도움말(?), 제목 블록 제거 ─────────────────────

test('[데이터] 사용량 원: 컨텍스트·5시간·주간 3개가 한 줄에 순서대로 나온다', async () => {
  const usage = {
    percent: 42,
    tokens: 84000,
    window: 200000,
    limits: [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-11-04T13:37:00' },
      { kind: 'seven_day', percentUsed: 7, resetsAt: '2026-11-06T15:00:00' },
    ],
  } as never
  const svg = usageSvg(SCENES.attic, usage, NOON)
  const at = (needle: string) => svg.indexOf(needle)

  expect(svg.match(/<path /g)).toHaveLength(60) // 원 3개 × 칸 20개
  expect(filledSegments(svg)).toBe(8 + 5 + 1) // 42% → 8칸, 23.5% → 5칸, 7% → 1칸
  // 왼쪽부터 컨텍스트, 5시간, 주간
  expect(at('>컨텍스트<')).toBeGreaterThan(-1)
  expect(at('>컨텍스트<')).toBeLessThan(at('>5시간 한도<'))
  expect(at('>5시간 한도<')).toBeLessThan(at('>주간 한도<'))
  for (const theme of ['촛불', '오늘의 의뢰', '길드 장부']) expect(svg).toContain(`>${theme}<`) // 테마 이름은 보조로 함께
  expect(svg).toContain('>84k/200k<')
  expect(svg).toContain('>1h 37m 뒤 리셋<')
  expect(svg).toContain('>2d 3h 뒤 리셋<')
  expect(usageSvg(SCENES.attic, null, NOON)).toContain('>-<') // 값이 없으면 0%처럼 보이지 않는다
})

test('[레이아웃] 제목 블록: 패널 그림은 296px로 잘려 있고 제목·모토 글자를 그리지 않는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const art = (await pane.findAll({ type: 'Svg' }))[0]

  expect(art?.props.height).toBe(296)
  expect(String(art?.props.source)).not.toContain('비는 오고')
  await pane.unmount()
})

test('[사용성] 도움말: 항목마다 ? 하나와 숨겨진 설명 창이 짝을 이루고, 누르면 패널 안에서 펼쳐진다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const marks = (await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('help:'))
  const tips = (await pane.findAll({ type: 'Box' })).filter(node => node.props.display === 'none')
  const ids = marks.map(button => String(button.key).slice('help:'.length))

  expect([...ids].sort()).toEqual(Object.keys(HELP).sort()) // HELP에 적은 항목이 모두, 그리고 그것만 화면에 있다
  expect(tips).toHaveLength(ids.length) // ? 하나에 설명 창 하나
  expect(marks.every(button => button.props.label === '?')).toBe(true)
  expect(tips.every(tip => tip.props.position === 'absolute' && tip.props.right === 0 && typeof tip.props.width === 'number')).toBe(true)
  for (const line of HELP.quick) expect(await pane.find({ type: 'Text', text: line })).toBeDefined()
  expect(HELP.quick.join(' ')).toContain('두 번 눌러야 실행')
  expect(Object.keys(HELP)).not.toContain('files') // 한 줄이면 되는 안내는 화면에 직접 적는다
  // 누르면 패널 안에서 펼쳐진다(하나만 열린다): 설명 카드가 생기고, 그 항목의 호버 창은 빠지고, 표시는 ×가 된다.
  expect(await pane.find({ key: 'help-card:quick' })).toBeUndefined()
  await pane.press({ key: 'help:quick' })
  expect(await pane.find({ key: 'help-card:quick' })).toBeDefined()
  expect((await pane.find({ key: 'help:quick' }))?.props.label).toBe('×')
  expect((await pane.findAll({ type: 'Box' })).filter(node => node.props.display === 'none')).toHaveLength(ids.length - 1)
  await pane.press({ key: 'help:usage' })
  expect(await pane.find({ key: 'help-card:quick' })).toBeUndefined() // 다른 걸 열면 앞의 것은 닫힌다
  expect(await pane.find({ key: 'help-card:usage' })).toBeDefined()
  await pane.press({ key: 'help:usage' })
  expect(await pane.find({ key: 'help-card:usage' })).toBeUndefined()
  expect(spy.toasts).not.toContain(HELP.quick.join(' · ')) // 알림으로 띄우지 않는다
  await pane.unmount()
})

// ── UX 개선 시험: 음악 실패, 파일 목록, 데이터 구분, 사용량 규칙, 장면 호환 ─────────────────

test('[상태] 음악: 재생기를 켜지 못하면 연결 실패로 보이고, ▶로 다시 시도한다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  const seen: Env[] = []

  // eslint-disable-next-line require-yield
  on('process.spawn', async function* () {
    throw new Error('spawn failed')
  })
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text

  expect(await status()).toBe('○ 멈춤')
  await banner.press({ key: 'music' })
  expect(await status()).toBe('✕ 연결 실패')
  expect(await pane.find({ type: 'Text', text: /Windows에서만/ })).toBeDefined() // 이유가 한 줄 붙는다
  expect((await pane.find({ key: 'radio' }))?.props.label).toBe('▶ 다시 시도')
  expect((await banner.find({ key: 'music' }))?.props.label).toBe('▶') // 배너 버튼도 다시 누를 수 있다
  expect(spy.toasts.some(text => text.includes('음악을 켜지 못했어요'))).toBe(true)
  expect(seen).toHaveLength(0)
  await pane.unmount()
  await banner.unmount()
})

test('[상태] 음악: 재생기가 저절로 끝나면 연결 실패, 새 시도는 실패 표시를 지운다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  let attempts = 0

  on('process.spawn', async function* () {
    attempts += 1
    yield { stream: 'stdout', text: 'connecting\n' }
    if (attempts === 1) return { value: { code: 0, signal: null } } // 첫 시도: 재생기가 곧바로 끝난다
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text

  await pane.press({ key: 'radio' })
  await clock.settle()
  expect(await status()).toBe('✕ 연결 실패')
  expect(spy.toasts.some(text => text.includes('음악 연결 실패'))).toBe(true)
  await pane.press({ key: 'radio' }) // 다시 시도
  expect(await status()).toBe('● 재생 중')
  expect(await pane.find({ type: 'Text', text: /재생기가 멈췄어요/ })).toBeUndefined() // 옛 실패 이유는 지워진다
  await pane.press({ key: 'radio' })
  await clock.advance(1000)
  await pane.unmount()
})

test('[상태] 음악: 실패한 뒤에는 장면을 바꾸면 표시가 지워지고, 음량을 바꿔도 저절로 다시 켜지 않는다', async ($, on) => {
  const clock = world(on)
  let spawns = 0

  // eslint-disable-next-line require-yield
  on('process.spawn', async function* () {
    spawns += 1
    throw new Error('nope')
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text

  await pane.press({ key: 'radio' })
  expect(await status()).toBe('✕ 연결 실패')
  expect(spawns).toBe(1)
  await pane.press({ key: 'volume-up' })
  expect(spawns).toBe(1) // 켜져 있을 때만 새 음량으로 다시 켠다
  await pane.select({ key: 'scene', value: 'dungeon' })
  expect(await status()).toBe('○ 멈춤')
  expect(spawns).toBe(1)
  await pane.unmount()
})

test('[데이터] 오늘 수정 파일(오늘 누적)과 이 채팅에서 만진 파일은 서로 다른 값이다', async ($, on) => {
  const earlier = { date: '2026-11-4', prompts: 5, actions: 9, files: ['C:/a.ts', 'C:/b.ts', 'C:/c.ts'] } // 앞선 채팅들의 오늘 기록
  const clock = world(on, { stored: { today: earlier } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const fileButtons = async () => (await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file:'))

  expect(await counter(pane, '수정 파일')).toBe('3')
  expect(await fileButtons()).toHaveLength(0) // 이 채팅에서는 아직 아무것도 만지지 않았다
  expect(await pane.find({ type: 'Text', text: '이 채팅 0개' })).toBeDefined()
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/d.ts', old_string: 'a', new_string: 'b' })
  expect(await counter(pane, '수정 파일')).toBe('4')
  expect(await fileButtons()).toHaveLength(1)
  expect(await pane.find({ type: 'Text', text: /^오늘 누적$/ })).toBeDefined() // 숫자 칸 위에 "오늘 누적"
  expect(await pane.find({ type: 'Text', text: /^이 채팅에서 만진 파일$/ })).toBeDefined()
  expect(HELP.status.join(' ')).toContain('이 채팅에서만 모은 목록') // 차이는 도움말에도 적혀 있다
  await pane.unmount()
})

test('[데이터] 사용량 원의 칸 수: 5% 단위 오차 규칙(최대 2.5%p, 가장자리는 5%p 이내)', async () => {
  expect([0, 0.4, 2.4, 3, 50, 85, 97.4, 98, 99.9, 100, 120].map(segmentsFor)).toEqual([0, 1, 1, 1, 10, 17, 19, 19, 19, 20, 20])
  for (let percent = 0; percent <= 100; percent += 0.5) {
    const error = Math.abs(segmentsFor(percent) * 5 - percent)

    if (percent > 0 && percent < 100) expect(segmentsFor(percent), `${percent}%는 한 칸 이상`).toBeGreaterThanOrEqual(1)
    if (percent < 100) expect(segmentsFor(percent), `${percent}%는 꽉 찬 원이 아니다`).toBeLessThan(20)
    expect(error, `${percent}% 오차`).toBeLessThanOrEqual(percent >= 2.5 && percent < 97.5 ? 2.5 : 5)
  }
})

for (const id of ['attic', 'tearoom', 'dungeon', 'neon'] as const) {
  test(`[레이아웃] 장면 ${id}: 패널과 사용량 원이 기능 이름·테마 이름과 함께 그려진다`, async ($, on) => {
    const mood = { mode: SCENES[id].mode, sceneByMode: { cozy: 'attic', adventure: 'dungeon', [SCENES[id].mode]: id } }
    const clock = world(on, { stored: { mood } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const svgs = await pane.findAll({ type: 'Svg' })

    expect(String(svgs[0]?.props.alt)).toContain(SCENES[id].title)
    expect(svgs[0]?.props.height).toBe(296)
    expect(String(svgs[1]?.props.source)).toContain('>컨텍스트<')
    for (const name of [SCENES[id].gauges.context, SCENES[id].gauges.fiveHour, SCENES[id].gauges.week]) {
      expect(String(svgs[1]?.props.source), `${id} ${name}`).toContain(`>${name.split(' · ')[0]}<`)
    }
    expect((await pane.find({ type: 'Text', text: SCENES[id].music.label }))?.text).toBe(SCENES[id].music.label)
    await pane.unmount()
  })
}

// ── P0 시험: 리셋 지난 한도, 도구 집계, 음악 가로채기·윈도우 감지, 클릭 도움말 ─────────────────

test('[데이터] 리셋 시각이 지난 한도는 옛 사용량을 보이지 않고 "리셋됨"으로 알린다(배너·패널)', async () => {
  const usage = {
    percent: 42,
    tokens: 84000,
    window: 200000,
    limits: [
      { kind: 'five_hour', percentUsed: 100, resetsAt: '2026-11-04T11:00:00' }, // NOON보다 이전
      { kind: 'seven_day', percentUsed: 45, resetsAt: '2026-11-06T15:00:00' },
    ],
  } as never
  const panel = usageSvg(SCENES.attic, usage, NOON)
  const banner = bannerSvg({ scene: SCENES.attic, usage, git: null, model: null, project: 'p', now: NOON, radio: 'off', isMusicAvailable: true })

  expect(panel).toContain('>리셋됨<')
  expect(panel).toContain('>응답 후 갱신<')
  expect(panel).not.toContain('곧 뒤 리셋')
  expect(panel).not.toContain('>100%<') // 옛 100%는 보이지 않는다
  expect(filledSegments(panel)).toBe(8 + 0 + 9) // 컨텍스트 42%, 5시간은 비움, 주간 45%
  expect(banner).toContain('>리셋됨<')
  expect(banner).not.toContain('>100%<')
  expect(banner).toContain('>45%<') // 아직 리셋 전인 한도는 그대로
})

test('[데이터] 도구 실행은 끝까지 간 호출만 세고, NotebookEdit로 고친 파일도 수정 파일에 잡힌다', async ($, on) => {
  const tool = { value: { result: {} } as object }
  const clock = world(on, { tool })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const call = () => $.tool.call({ tool: 'Bash', command: 'ls' })

  await call()
  expect(await counter(pane, '도구 실행')).toBe('1')
  tool.value = { result: {}, isError: true }
  await call()
  tool.value = { deny: '막힘' }
  await call()
  expect(await counter(pane, '도구 실행')).toBe('1') // 실패하거나 거부된 호출은 세지 않는다
  tool.value = { result: {} }
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/work/p/n.ipynb', new_source: 'x' } as never)
  expect(await counter(pane, '수정 파일')).toBe('1')
  expect((await pane.findAll({ type: 'Button' })).some(button => button.props.label === 'p/n.ipynb')).toBe(true)
  await pane.unmount()
})

test('[상태] 음악: 다른 채팅이 가져가면 연결 실패가 아니라 "다른 채팅에서 재생 중"으로 보이고, 여기서 다시 켤 수 있다', async ($, on) => {
  const spy = newSpy()
  const store: Record<string, unknown> = {} // 채팅끼리 공유되는 저장소 역할
  const clock = world(on, { spy, liveStore: store })
  const kills = new Set<number>()
  let spawns = 0

  on('process.spawn', async function* () {
    const mine = (spawns += 1)

    yield { stream: 'stdout', text: 'connecting\n' }
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      if (kills.has(mine)) return { value: { code: 1, signal: null } } // 다른 채팅의 재생기가 이 재생기를 껐다
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text
  const takeOver = async (spawn: number) => {
    store.radioOwner = 'another-chat' // 다른 채팅이 음악을 켜며 저장소에 남기는 표시
    kills.add(spawn)
    await clock.advance(1000)
  }

  await pane.press({ key: 'radio' })
  expect(await status()).toBe('● 재생 중')
  await takeOver(1)
  expect(await status()).toBe('◇ 다른 채팅에서 재생 중')
  expect((await pane.find({ key: 'radio' }))?.props.label).toBe('▶ 여기서 켜기')
  expect((await banner.find({ key: 'music' }))?.props.label).toBe('▶')
  expect(spy.toasts.some(text => text.includes('다른 채팅에서 음악을 켜서'))).toBe(true)
  expect(spy.toasts.some(text => text.includes('연결 실패'))).toBe(false) // 실패로 알리지 않는다
  await pane.press({ key: 'radio' }) // 여기서 다시 켠다
  expect(await status()).toBe('● 재생 중')
  expect(typeof store.radioOwner).toBe('string') // 다시 켤 때 소유 표시를 내 이름표로 되돌린다
  expect(store.radioOwner).not.toBe('another-chat')
  await takeOver(2)
  expect(await status()).toBe('◇ 다른 채팅에서 재생 중')
  await pane.select({ key: 'scene', value: 'dungeon' }) // 장면을 바꾸면 옛 표시는 지워지고, 저절로 켜지지도 않는다
  expect(await status()).toBe('○ 멈춤')
  expect(spawns).toBe(2)
  await pane.unmount()
  await banner.unmount()
})

test('[사용성] 윈도우가 아니면 음악 버튼 대신 이유만 보이고, 배너에도 음악 버튼이 없다', async ($, on) => {
  const clock = world(on, { whereExit: 1 }) // where.exe가 PowerShell을 못 찾는 환경

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await banner.find({ key: 'music' })).toBeUndefined()
  expect(await banner.find({ key: 'panel' })).toBeDefined() // 나머지 버튼은 그대로
  expect(await pane.find({ key: 'radio' })).toBeUndefined()
  expect(await pane.find({ key: 'volume-up' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^음악은 Windows에서만 쓸 수 있어요$/ })).toBeDefined()
  await banner.unmount()
  await pane.unmount()
})

// ── P3 시험: 측정판 ───────────────────────────────────────────────────────────

test('[사용성] /tavern-diag: 측정판이 켜지고 꺼지며, 열·줄 수와 px 기준자가 있다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const board = async () => pane.find({ type: 'Text', text: /^측정판/ })
  const rulers = async () => (await pane.findAll({ type: 'Svg' })).filter(svg => String(svg.props.alt).includes('기준자'))

  expect(await board()).toBeUndefined() // 평소에는 보이지 않는다
  expect(await rulers()).toHaveLength(0)
  const on1 = await $.command.run({ command: 'tavern-diag' })

  expect(String((on1 as { text?: string }).text)).toContain('측정판을 켰어요')
  expect(await board()).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '열 40 · 줄 20 · dock · desktop' })).toBeDefined() // 렌더 훅이 받은 틀 정보
  expect((await rulers()).map(svg => svg.props.width)).toEqual([100, 300]) // 선언한 px 그대로
  // 간격 5단계·글자 5크기 표본이 모두 있다
  for (const step of ['xs', 'sm', 'md', 'lg', 'xl']) expect(await pane.find({ type: 'Text', text: new RegExp(`^${step}$`) })).toBeDefined()
  for (const size of ['caption', 'footnote', 'body', 'heading', 'title']) expect(await pane.find({ type: 'Text', text: new RegExp(`^${size} 가나다`) })).toBeDefined()
  expect(await pane.find({ key: 'quick' })).toBeUndefined() // 측정판의 버튼이 진짜 기능 버튼과 섞이지 않는다
  const off = await $.command.run({ command: 'tavern-diag' })

  expect(String((off as { text?: string }).text)).toContain('껐어요')
  expect(await board()).toBeUndefined()
  expect(await rulers()).toHaveLength(0)
  await pane.unmount()
})

// ── 실측 반영 시험: 사용량 그림 폭, 숫자 크기 ─────────────────────────────────────

test('[레이아웃] 사용량 그림 폭은 패널 열 수에 맞추되 기본(340)보다 좁아지지 않고 480을 넘지 않는다', async () => {
  expect(usageWidthFor(40)).toBe(340) // 좁은 패널: 기본 폭(앱이 줄여 그린다)
  expect(usageWidthFor(51)).toBe(387) // 실측한 패널(열 51, 칸 7.7px ≈ 394px)에 맞춘다
  expect(usageWidthFor(200)).toBe(480)
  const wide = usageSvg(SCENES.attic, null, NOON, 387)

  expect(wide).toContain('viewBox="0 0 387 152"')
  expect(wide).toContain('width="387"')
  expect(usageSvg(SCENES.attic, null, NOON)).toContain('viewBox="0 0 340 152"') // 폭을 안 주면 예전과 같다
  // 세 원이 넓어진 폭을 고르게 나눠 쓴다(가운데 원은 한가운데).
  expect(wide).toContain('x="193.5"')
})

test('[레이아웃] 패널 열이 51이면 사용량 그림을 387px로 그리고, 숫자 칸의 숫자는 title 크기다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 51 }, surface: 'desktop' })
  const svgs = await pane.findAll({ type: 'Svg' })

  expect(svgs[1]?.props.width).toBe(387)
  expect(String(svgs[1]?.props.source)).toContain('viewBox="0 0 387 152"')
  expect(svgs[0]?.props.width).toBe(340) // 그림(픽셀 아트)은 4배 그대로: 선명도를 지킨다
  const texts = await pane.findAll({ type: 'Text' })
  const index = texts.findIndex(node => node.text === '프롬프트')

  expect(texts[index - 1]?.props.size).toBe('title')
  await pane.unmount()
})

// ── P1 시험: 구역 접기, 한 줄 요약, 상태 기억, 사용량 알림 ─────────────────────────────

test('[사용성] 접기 표시: 구역마다 ▾가 있고, 커밋 로그는 기본으로 접혀 있으며 눌러서 펴고 접는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async (key: string) => (await pane.find({ key }))?.props.label

  for (const id of ['usage', 'status', 'files', 'music']) expect(await label(`fold:${id}`), id).toBe('▾') // 처음에는 모두 펴져 있다
  expect(await label('fold:art')).toBe('그림 ▾')
  expect(await label('fold:commits')).toBe('▸ 최근 커밋 2개')
  expect(await pane.find({ type: 'Text', text: /abc1234/ })).toBeUndefined()
  await pane.press({ key: 'fold:commits' })
  expect(await label('fold:commits')).toBe('▾ 최근 커밋 2개')
  expect(await pane.find({ type: 'Text', text: /abc1234/ })).toBeDefined()
  await pane.press({ key: 'fold:commits' })
  expect(await pane.find({ type: 'Text', text: /abc1234/ })).toBeUndefined()
  await pane.unmount()
})

test('[상태] 구역을 접으면 머리글 한 줄과 요약만 남고, 편 상태로 되돌리면 본문이 돌아오며, 상태는 저장된다', async ($, on) => {
  const store: Record<string, unknown> = { collapsed: ['art', 'usage', 'status', 'files', 'music'] } // 이전에 접어 둔 상태
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svgs = async () => (await pane.findAll({ type: 'Svg' })).length
  const has = async (text: string | RegExp) => (await pane.find({ type: 'Text', text })) !== undefined

  expect(await svgs()).toBe(0) // 그림도 사용량도 접혀 있다
  expect(await pane.find({ key: 'radio' })).toBeUndefined()
  for (const title of ['사용량', '작업 현황', '이 채팅에서 만진 파일', '음악']) expect(await has(new RegExp(`^${title}$`)), title).toBe(true) // 머리글은 남는다
  expect(await has('컨텍스트 42% · 5시간 24% · 주간 7%')).toBe(true)
  expect(await has('p · main +2')).toBe(true)
  expect(await has('이 채팅 0개')).toBe(true)
  expect(await has('○ 멈춤')).toBe(true) // 음악의 한 줄 요약
  expect(await has(/^오늘 누적$/)).toBe(false)
  await pane.press({ key: 'fold:usage' })
  expect(await svgs()).toBe(1)
  expect(store.collapsed).toEqual(['art', 'status', 'files', 'music']) // 저장소에 남는다
  await pane.press({ key: 'fold:art' })
  expect(await svgs()).toBe(2)
  await pane.press({ key: 'fold:music' })
  expect(await pane.find({ key: 'radio' })).toBeDefined()
  expect(store.collapsed).toEqual(['status', 'files'])
  await pane.unmount()
})

test('[데이터] 접은 사용량 요약: 값 없음은 "-", 리셋이 지난 한도는 "리셋됨"', async () => {
  const usage = (five: number | null, resetsAt: string) =>
    ({ percent: 42, tokens: 1, window: 2, usd: null, limits: five === null ? [] : [{ kind: 'five_hour', percentUsed: five, resetsAt }] }) as never

  expect(usageSummary(SCENES.attic, usage(23.5, '2026-11-04T13:37:00'), NOON)).toBe('컨텍스트 42% · 5시간 24% · 주간 -')
  expect(usageSummary(SCENES.attic, usage(100, '2026-11-04T11:00:00'), NOON)).toBe('컨텍스트 42% · 5시간 리셋됨 · 주간 -')
  expect(usageSummary(SCENES.attic, null, NOON)).toBe('컨텍스트 - · 5시간 - · 주간 -')
})

test('[데이터] 사용량 알림 규칙: 90% 이상이 처음 될 때만 알리고, 80% 아래로 내려오면 다시 알릴 준비를 한다', async () => {
  const reading = (context: number | null, five?: number, resetsAt = '2026-11-04T13:37:00') =>
    ({ percent: context, tokens: 1, window: 2, usd: null, limits: five === undefined ? [] : [{ kind: 'five_hour', percentUsed: five, resetsAt }] }) as never
  let state = NO_ALERTS
  const step = (usage: never) => {
    const found = checkAlerts(usage, state, NOON)

    state = found.alerted

    return found.messages
  }

  expect(step(reading(80))).toEqual([])
  expect(step(reading(89.9))).toEqual([])
  expect(step(reading(90))).toEqual(['컨텍스트가 90%예요. /compact 로 정리하거나 새 채팅을 여는 게 좋아요'])
  expect(step(reading(95))).toEqual([]) // 같은 구간에서는 다시 알리지 않는다
  expect(step(reading(85))).toEqual([]) // 80~90%는 상태를 그대로 둔다(경계에서 깜박이지 않는다)
  expect(step(reading(92))).toEqual([])
  expect(step(reading(70))).toEqual([]) // 컨텍스트를 정리했다: 다시 알릴 준비
  expect(step(reading(93))).toHaveLength(1)
  expect(step(reading(10, 91))).toEqual(['5시간 한도 91% 사용 · 1h 37m 뒤 리셋'])
  expect(step(reading(10, 99, '2026-11-04T11:00:00'))).toEqual([]) // 리셋이 지난 한도는 옛 값이라 알리지 않고
  expect(step(reading(10, 92))).toHaveLength(1) // 새 구간에서 다시 알린다
})

test('[사용성] 사용량이 90%를 넘으면 한 번만 알림이 뜬다(측정이 올 때마다 확인)', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start(START)
  await clock.settle()
  const measure = async (percent: number) => {
    await $.session.measure({ ...USAGE, context: { ...USAGE.context, percent }, changed: ['context'] })
    await clock.settle()
  }
  const alerts = () => spy.toasts.filter(text => text.startsWith('컨텍스트가'))

  await measure(80)
  expect(alerts()).toHaveLength(0)
  await measure(92)
  expect(alerts()).toEqual(['컨텍스트가 92%예요. /compact 로 정리하거나 새 채팅을 여는 게 좋아요'])
  await measure(95)
  expect(alerts()).toHaveLength(1)
  await measure(70)
  await measure(93)
  expect(alerts()).toHaveLength(2)
})

test('[레이아웃] 음악은 그림 바로 아래 카드로 놓이고, 사용량·만진 파일과 같은 카드 배경이다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await pane.findAll({ type: 'Box' })
  const bands = all.filter(node => node.props.paddingY === 'md') // 구역(띠)들: 설정, 음악, 빠른 실행, 사용량, 작업 현황, 만진 파일
  const card = surfaceOf(SCENES.attic)
  const tones = bands.map(node => node.props.backgroundColor)

  expect(tones[1]).toBe(card) // 설정 다음, 빠른 실행 앞이 음악
  expect(tones[3]).toBe(card) // 사용량
  expect(tones[5]).toBe(card) // 만진 파일
  expect(tones[2]).not.toBe(card) // 빠른 실행은 바탕
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)

  expect(texts.indexOf('음악')).toBeLessThan(texts.indexOf('빠른 실행'))
  await pane.unmount()
})

// ── 오늘 통계 병합 시험: 채팅이 여럿이어도 기록이 서로 덮어쓰이지 않는다 ───────────────────

test('[데이터] 오늘 기록 합치기: 숫자는 큰 쪽, 파일은 합집합, 줄어들지 않는다', async () => {
  const a = { date: '2026-11-4', prompts: 5, actions: 9, files: ['a', 'b'] }
  const b = { date: '2026-11-4', prompts: 8, actions: 7, files: ['b', 'c'] }

  expect(mergeToday(a, b)).toEqual({ date: '2026-11-4', prompts: 8, actions: 9, files: ['a', 'b', 'c'] })
  expect(mergeToday(b, a)).toEqual({ date: '2026-11-4', prompts: 8, actions: 9, files: ['b', 'c', 'a'] })
  const many = { ...a, files: Array.from({ length: 400 }, (_, i) => `x${i}`) }

  expect(mergeToday(many, { ...b, files: Array.from({ length: 400 }, (_, i) => `y${i}`) }).files).toHaveLength(500) // 한도는 그대로
})

test('[데이터] 다른 채팅이 더한 오늘 기록이 이 채팅의 숫자에 반영되고, 새 기록은 그 위에 더해진다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await counter(pane, '프롬프트')).toBe('0')
  // 다른 채팅이 그동안 프롬프트 5개·도구 9개·파일 1개를 더해 저장소에 남겼다.
  store.today = { date: '2026-11-4', prompts: 5, actions: 9, files: ['C:/other/a.ts'] }
  await clock.advance(60_000) // 1분마다 오는 갱신: 아무것도 누르지 않아도 따라온다
  expect(await counter(pane, '프롬프트')).toBe('5')
  expect(await counter(pane, '도구 실행')).toBe('9')
  expect(await counter(pane, '수정 파일')).toBe('1')
  await $.tool.call({ tool: 'Bash', command: 'ls' }) // 이 채팅의 새 기록은 그 위에 더한다(덮어쓰지 않는다)
  expect(await counter(pane, '도구 실행')).toBe('10')
  expect((store.today as { actions: number }).actions).toBe(10)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/b.ts', old_string: 'a', new_string: 'b' })
  expect(await counter(pane, '수정 파일')).toBe('2') // 다른 채팅의 파일 1개 + 이 채팅의 파일 1개
  expect((await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file:'))).toHaveLength(1) // 이 채팅 목록은 따로
  await pane.unmount()
})

test('[데이터] 어제 날짜의 기록은 저장소에 있어도 오늘 숫자에 섞이지 않는다', async ($, on) => {
  const store: Record<string, unknown> = { today: { date: '2026-11-3', prompts: 50, actions: 90, files: ['C:/old.ts'] } }
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await clock.advance(60_000)
  expect(await counter(pane, '프롬프트')).toBe('0')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await counter(pane, '도구 실행')).toBe('1')
  expect((store.today as { date: string }).date).toBe('2026-11-4')
  await pane.unmount()
})
