// 시험 도우미: 가짜 엔진(world), 재생기 흉내, 숫자 읽기, 색 대비 계산. 시험 파일들이 함께 쓴다(시험이 아니라서 *.test.* 가 아니다).
import type { ToolCallResult } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { Mounted } from 'claude-code/testing'
import { QUICK } from '../hooks/actions'
import { SCENES } from '../hooks/scenes'
import type { SceneId } from '../types'

export const NOON = Date.parse('2026-11-04T12:00:00')

export const COMMIT_LABEL = QUICK.find(item => item.key === 'commit')?.label // 버튼 이름은 QUICK 한 곳에서만 정한다

export const SIMPLIFY_LABEL = QUICK.find(item => item.key === 'simplify')?.label

export const ARMED_LABEL = '한 번 더' // 커밋·정리를 한 번 누른 5초 동안의 라벨

export const BAND = {
  plugin: 'pixel-tavern',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

export const PANE = {
  plugin: 'pixel-tavern',
  component: 'Pane',
  requestId: 'tavern',
  props: { title: '여관', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

export const USAGE = {
  startedAt: 0,
  context: { tokens: 84000, window: 200000, percent: 42 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-11-04T13:37:00' },
    { kind: 'seven_day', percentUsed: 7, resetsAt: '2026-11-06T15:00:00' },
  ],
  cost: { usd: 1.234 },
}

export const GIT_STATUS = '## main...origin/main [ahead 1, behind 2]\n M a.ts\n?? b.ts\n'

export const GIT_LOG = 'abc1234\tfeat: 배너 추가\ndef5678\tfix: 한도 표시'

/** 숫자 칸: 숫자 글자가 라벨 글자 바로 앞에 놓인다. */
export const counter = async (ui: { findAll: (q: object) => Promise<{ text?: string }[]> }, label: string) => {
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text)

  return texts[texts.indexOf(label) - 1]
}

/** 패널의 ▶로 원하는 장면이 나올 때까지 넘긴다(장면 수가 늘어도 시험이 깨지지 않는다). 장면 그림의 대체 글에 장면 이름이 있다. */
export const goToScene = async (pane: Mounted<'desktop', 'Pane'>, id: SceneId): Promise<void> => {
  for (let step = 0; step < 30; step += 1) {
    if (String((await pane.findAll({ type: 'Svg' }))[0]?.props.alt).includes(SCENES[id].title)) return
    await pane.press({ key: 'scene:next' })
  }
  throw new Error(`장면 ${id}에 닿지 못했다`)
}

/** 엔진이 받쳐 주는 호출을 흉내 낸다. 시계와 저장소는 키트가 메모리로 답한다. */
export type Spy = { ran: string[]; filled: string[]; toasts: string[]; runs: string[][] } // runs: process.run으로 실행한 명령(인자 목록)

/** isZ: status 가 이미 진짜 -z 출력이다(변환하지 않는다). isTruncated: 출력이 한도에서 잘렸다. */
export type GitFake = { status: string; exitCode?: number; isZ?: boolean; isTruncated?: boolean }

/**
 * 읽기 쉬운 줄 단위 시험 자료("XY 경로", 이름 변경은 "XY 옛 -> 새")를 git이 -z 로 내보내는 모양으로 바꾼다:
 * 항목마다 NUL로 끝맺고, 이름 변경은 "XY 새 경로" 다음 칸에 옛 경로. 진짜 출력은 tests/git.test.tsx 의 고정 자료(tools/git_fixture.py)에 있다.
 */
export const toPorcelainZ = (text: string): string =>
  text
    .split('\n')
    .filter(line => line !== '')
    .map(line => {
      const [from = '', to] = line.slice(3).split(' -> ')

      return /[RC]/.test(line.slice(0, 2)) && to !== undefined ? `${line.slice(0, 3)}${to}\0${from}` : line
    })
    .map(entry => `${entry}\0`)
    .join('')

/**
 * 저장소를 여러 채팅이 나눠 쓸 때 생기는 겹침을 흉내 낸다. afterGet: 값을 읽어 간 "직후" 다른 채팅이 끼어든다.
 * setDelayMs: 같은 키의 nth(0부터)번째 쓰기를 그만큼 늦게 끝낸다(가짜 시계) — 쓰기 끝나는 순서가 뒤바뀌는 경우를 만든다.
 */
export type StoreHooks = { afterGet?: (key: string) => void | Promise<void>; setDelayMs?: (key: string, nth: number) => number }

/** 곡 제목 조회 흉내: urls에는 조회한 방송 주소가 쌓이고, outputs는 조회마다 차례로 돌려줄 출력이다(모자라면 마지막 것을 반복). */
export type TitleFake = { urls: string[]; outputs: { stdout: string; exitCode?: number }[] }

export type World = { titles?: TitleFake; surfaces?: ('terminal' | 'desktop' | 'vscode' | 'mobile')[]; opened?: object[]; now?: number; storeHooks?: StoreHooks; runDelaysMs?: number[]; runFails?: boolean; spy?: Spy; stored?: Record<string, unknown>; git?: GitFake; usage?: typeof USAGE; whereExit?: number; tool?: { value: object }; liveStore?: Record<string, unknown> }

/** 저장소에 남은 그날의 칸(today:<날짜>:<칸 이름>)들의 값. 합계 키(today)는 옛 방식이라 들어 있지 않다. */
export const slotsOf = (store: Record<string, unknown>, day: string): { date: string; prompts: number; actions: number; files: string[] }[] =>
  Object.entries(store)
    .filter(([key]) => key.startsWith(`today:${day}:`))
    .map(([, value]) => value as { date: string; prompts: number; actions: number; files: string[] })

export const newSpy = (): Spy => ({ ran: [], filled: [], toasts: [], runs: [] })

export const world = (
  on: Parameters<typeof mock.clock>[0],
  { titles, surfaces = ['desktop'], opened, now = NOON, storeHooks = {}, runDelaysMs = [], runFails = false, spy = newSpy(), stored = {}, git = { status: GIT_STATUS }, usage = USAGE, whereExit = 0, tool = { value: { result: {} } }, liveStore }: World = {},
) => {
  const clock = mock.clock(on, { now })

  if (liveStore === undefined) mock.store(on, stored)
  else {
    // 채팅끼리 공유되는 저장소를 흉내 낸다: 시험이 객체를 직접 고쳐 "다른 채팅"의 기록을 남길 수 있다.
    // 진짜 저장소처럼 JSON을 거쳐 주고받는다(같은 객체를 서로 고치지 못한다).
    const copy = (value: unknown): unknown => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
    const sets = new Map<string, number>()

    on('store.get', async (_, e) => {
      const value = copy(liveStore[e.key])

      await storeHooks.afterGet?.(e.key)

      return { value }
    })
    on('store.set', async (_, e) => {
      const nth = sets.get(e.key) ?? 0
      const delay = storeHooks.setDelayMs?.(e.key, nth) ?? 0

      sets.set(e.key, nth + 1)
      if (delay > 0) await clock.sleep(delay)
      liveStore[e.key] = copy(e.value)

      return { value: undefined }
    })
    on('store.delete', (_, e) => {
      delete liveStore[e.key]

      return { value: undefined }
    })
    on('store.keys', () => ({ value: Object.keys(liveStore) }))
  }
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'tavern' } }))
  let runCount = 0

  on('command.run', async (_, e) => {
    const delay = runDelaysMs[runCount] ?? 0 // 세션이 바빠 명령이 줄 서 있는 시간

    runCount += 1
    if (delay > 0) await clock.sleep(delay)
    if (runFails) throw new Error('boom') // 명령을 실행하지 못하는 경우
    spy.ran.push(e.command)

    return { text: '' }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.fill', (_, e) => {
    spy.filled.push(e.text)

    return { isFilled: true }
  })
  on('session.surfaces', () => ({ value: surfaces }))
  // 모델 요청의 맨 아래: 요청을 보냈다고 치고 빈 답을 돌려준다(위의 훅이 모델·effort를 읽는 것만 시험한다).
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: null, usage: null }
  })
  on('ui.open', (_, e) => {
    opened?.push(e) // 패널을 열 때 보낸 요청(opened를 주면 쌓는다)

    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [] }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    spy.toasts.push(e.text)

    return { value: undefined }
  })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => ({ value: usage }))
  on('process.run', (_, e) => {
    if (titles !== undefined && e.argv[0] === 'powershell.exe' && e.argv.some(arg => arg.includes('pixel-tavern-title'))) {
      titles.urls.push(e.init?.env?.TAVERN_URL ?? '')
      const out = titles.outputs[Math.min(titles.urls.length, titles.outputs.length) - 1] ?? { stdout: '' }

      return { value: { exitCode: out.exitCode ?? 0, stdout: out.stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    spy.runs.push([...e.argv])

    return {
      value: {
        exitCode: e.argv[0] === 'where.exe' ? whereExit : e.argv.includes('status') ? (git.exitCode ?? 0) : 0,
        stdout: e.argv.includes('status') ? (git.isZ ? git.status : toPorcelainZ(git.status)) : GIT_LOG,
        stderr: '',
        isStdoutTruncated: e.argv.includes('status') ? (git.isTruncated ?? false) : false,
        isStderrTruncated: false,
      },
    }
  })
  on('tool.call', () => tool.value as ToolCallResult)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>엔진 내용</Text>
  })

  return clock
}

export type Env = Record<string, string | undefined>

export type Clock = ReturnType<typeof mock.clock>

/** 재생기 프로세스 대신: 연결(→ 재생) 신호를 보내고 반 초마다 "."을 쓴다. 켤 때마다 환경변수를 기록한다. */
export const fakePlayer = (on: Parameters<typeof mock.clock>[0], clock: Clock, seen: Env[], isStuck = false) =>
  on('process.spawn', async function* (_, e) {
    seen.push((e.env ?? {}) as Env)
    yield { stream: 'stdout', text: 'connecting\n' }
    if (!isStuck) yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })

export const START = { cwd: 'C:/work/p', surface: 'desktop', isInteractive: true } as const

export const filledSegments = (svg: string): number => (svg.match(/stroke="#(?!ffffff)/g) ?? []).length

export const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export const contrast = (a: string, b: string): number => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (hi + 0.05) / (lo + 0.05)
}

/** 예전에 장면마다 있던 비유 이름. 이제 화면 어디에도 없어야 한다. */
export const METAPHOR_NAMES = ['촛불', '찻잔', '마나', '전기', '오늘의 의뢰', '길드 장부', '신청곡', '단골 장부', '스테이지', '시즌', '공연', '투어']
