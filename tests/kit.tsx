// 시험 도우미: 가짜 엔진(world), 재생기 흉내, 숫자 읽기, 색 대비 계산. 시험 파일들이 함께 쓴다(시험이 아니라서 *.test.* 가 아니다).
import { mock } from 'claude-code/testing'
import { QUICK } from '../hooks/actions'

export const NOON = Date.parse('2026-11-04T12:00:00')

export const COMMIT_LABEL = QUICK.find(item => item.key === 'commit')?.label // 버튼 이름은 QUICK 한 곳에서만 정한다

export const ARMED_LABEL = '한 번 더' // 커밋을 한 번 누른 5초 동안의 라벨

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

/** 엔진이 받쳐 주는 호출을 흉내 낸다. 시계와 저장소는 키트가 메모리로 답한다. */
export type Spy = { ran: string[]; filled: string[]; toasts: string[] }

export type GitFake = { status: string; exitCode?: number }

export type World = { spy?: Spy; stored?: object; git?: GitFake; usage?: typeof USAGE; whereExit?: number; tool?: { value: object }; liveStore?: Record<string, unknown> }

export const newSpy = (): Spy => ({ ran: [], filled: [], toasts: [] })

export const world = (
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
