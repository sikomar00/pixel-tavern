// 패널의 화면 구성 트리를 JSON으로 덤프하는 시나리오(시험이 아니다: 이름이 *.test.* 가 아니라서 평소에는 돌지 않는다).
// tools/render_panel.py 가 이 파일을 잠깐 zz-tree.test.tsx 로 복사해 돌리고 지운다. 직접 돌리지 않는다.
import { expect, mock, test } from 'claude-code/testing'

const NOON = Date.parse('2026-11-04T12:00:00')
const BAND = { plugin: 'pixel-tavern', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 100, scroll: { offset: 0, bodyRows: 7 }, view: {} } } as const
const PANE = { plugin: 'pixel-tavern', component: 'Pane', requestId: 'tavern', props: { title: '여관', isFocused: false, bodyColumns: 51, placement: 'dock', scroll: { offset: 0, bodyRows: 63 }, view: {} } } as const

const usage = (context: number | null, five: number | null) => ({
  startedAt: 0,
  context: context === null ? { window: 200000 } : { tokens: 84000, window: 200000, percent: context },
  rateLimits: five === null ? [] : [{ kind: 'five_hour', percentUsed: five, resetsAt: '2026-11-04T13:37:00' }, { kind: 'seven_day', percentUsed: 45, resetsAt: '2026-11-06T15:00:00' }],
})

type Opts = {
  id: string
  cwd: string
  scene?: 'attic' | 'tearoom' | 'jazz' | 'camp' | 'library' | 'dungeon' | 'neon' | 'arcade' | 'drive' | 'station'
  usage: ReturnType<typeof usage>
  isRepo?: boolean
  edits?: number
  open?: boolean // 파일 목록 전체 보기
  arm?: boolean // 커밋 대기
  radio?: 'off' | 'playing' | 'failed'
  diag?: boolean // 측정판
  help?: string // 펼쳐 둘 도움말
  fold?: string[] // 접기/펴기를 누를 구역(art, usage, status, files, music, commits)
  picker?: boolean // 음악의 "방송 바꾸기"를 펼친다
  surface?: 'desktop' | 'terminal' // 어느 화면으로 그릴지(기본 데스크톱)
  columns?: number // 패널 본문의 글자 칸 수(기본 51)
  band?: boolean // 패널 대신 프롬프트 위 배너를 그린다
  hide?: boolean // 배너의 ✕를 눌러 숨긴 상태
  effort?: string // 모델 요청 한 번을 보내 모델(Opus 5.5)과 effort를 알린다
}

const strip = (node: any): any => ({
  type: node.type,
  key: node.key,
  props: Object.fromEntries(Object.entries(node.props ?? {}).filter(([, value]) => typeof value !== 'function')),
  text: node.text,
  children: (node.children ?? []).map((child: any) => (typeof child === 'string' ? child : strip(child))),
})

const moodOf = (scene: NonNullable<Opts['scene']>) => {
  const mode = ['dungeon', 'neon', 'arcade', 'drive', 'station'].includes(scene) ? 'adventure' : 'cozy'

  return { mood: { mode, sceneByMode: { cozy: 'attic', adventure: 'dungeon', [mode]: scene } } }
}

const scenario = (opts: Opts) =>
  test(`tree ${opts.id}`, async ($, on) => {
    const clock = mock.clock(on, { now: NOON })

    mock.store(on, opts.scene === undefined ? {} : moodOf(opts.scene))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'tavern' } }))
    on('command.run', () => ({ text: '' }))
    on('prompt.fill', () => ({ isFilled: true }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.panes', () => ({ value: [] }))
    on('ui.log', () => ({ value: undefined }))
    on('ui.toast', () => ({ value: undefined }))
    on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
    on('session.usage', () => ({ value: opts.usage }))
    on('process.run', (_, e) => ({
      value: {
        exitCode: opts.isRepo === false && e.argv[0] === 'git' ? 128 : 0,
        stdout: e.argv.includes('status') ? '## main...origin/main [ahead 1, behind 2]\n M a.ts\n?? b.ts\n' : 'abc1234\tfeat: 배너 추가\ndef5678\tfix: 한도 표시\n9a8b7c6\tdocs: README',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }))
    on('tool.call', () => ({ result: {} }))
    on('turn.step', async function* (_, e) {
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: null, usage: null }
    })
    on('ui.render', ($$, e) => {
      const { Text } = $$.ui.resolve(e)

      return <Text>엔진</Text>
    })
    if (opts.radio === 'failed') {
      // eslint-disable-next-line require-yield
      on('process.spawn', async function* () {
        throw new Error('x')
      })
    } else {
      on('process.spawn', async function* () {
        yield { stream: 'stdout', text: 'connecting\n' }
        yield { stream: 'stdout', text: 'playing\n' }
        for (;;) {
          await clock.sleep(500)
          yield { stream: 'stdout', text: '.\n' }
        }
      })
    }
    const surface = opts.surface ?? 'desktop'

    await $.session.start({ cwd: opts.cwd, surface, isInteractive: true })
    await clock.settle()
    for (let i = 1; i <= (opts.edits ?? 0); i++) await $.tool.call({ tool: 'Edit', file_path: `C:/work/p/src/components/file-number-${i}.tsx`, old_string: 'a', new_string: 'b' })
    const pane = await $.ui.mount(opts.band === true ? { ...BAND, props: { ...BAND.props, bodyColumns: opts.columns ?? 100 }, surface } : { ...PANE, props: { ...PANE.props, bodyColumns: opts.columns ?? 51 }, surface })

    if (opts.effort !== undefined) for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: opts.effort as 'high', messageCount: 1 })) void chunk
    if (opts.hide) await pane.press({ key: 'hide' })
    if (opts.open) await pane.press({ key: 'files-toggle' })
    if (opts.arm) await pane.press({ key: 'commit' })
    if (opts.radio === 'failed' || opts.radio === 'playing') await pane.press({ key: opts.band === true ? 'music' : 'radio' })
    if (opts.picker) await pane.press({ key: 'picker' })
    if (opts.help !== undefined) await pane.press({ key: `help:${opts.help}` })
    for (const id of opts.fold ?? []) await pane.press({ key: `fold:${id}` })
    if (opts.diag) await $.command.run({ command: 'tavern-diag' })
    await clock.settle()
    const root = (await pane.findAll({ type: 'Box' }))[0]

    console.log('@@TREE@@' + JSON.stringify({ id: opts.id, surface, columns: opts.columns ?? (opts.band === true ? 100 : 51), tree: strip(root) }))
    expect(true).toBe(true)
    await pane.unmount()
  })

// 보고 싶은 상태를 여기에 더한다. id가 화면 제목이 된다.
scenario({ id: 'default', cwd: 'C:/work/demo', usage: usage(42, 23), edits: 2 })
scenario({ id: 'busy', cwd: 'C:/work/a-very-long-project-name-that-keeps-going-2026-11-04', scene: 'neon', usage: usage(97, 120), edits: 12, open: true, arm: true, radio: 'failed' })
scenario({ id: 'bare', cwd: 'C:/work/x', scene: 'tearoom', usage: usage(null, null), isRepo: false, radio: 'playing' })
scenario({ id: 'help', cwd: 'C:/work/demo', scene: 'dungeon', usage: usage(42, 23), help: 'usage' })
scenario({ id: 'diag', cwd: 'C:/work/demo', usage: usage(42, 23), diag: true })
scenario({ id: 'commits-open', cwd: 'C:/work/demo', usage: usage(42, 23), edits: 2, fold: ['commits'] }) // 커밋 로그를 펼친 상태(예전 기본)
scenario({ id: 'art-off', cwd: 'C:/work/demo', usage: usage(42, 23), edits: 2, fold: ['art'] }) // 그림을 접은 "집중" 상태
scenario({ id: 'picker-open', cwd: 'C:/work/demo', scene: 'jazz', usage: usage(42, 23), edits: 2, radio: 'playing', picker: true }) // 방송 바꾸기를 펼친 상태
scenario({ id: 'folded', cwd: 'C:/work/demo', usage: usage(42, 23), edits: 2, fold: ['art', 'usage', 'status', 'files', 'music'] }) // 모두 접은 상태

// 터미널 화면(tools/render_term.py가 그린다)
scenario({ id: 'term-banner', cwd: 'C:/work/demo', usage: usage(42, 23), edits: 2, surface: 'terminal', band: true, columns: 100, effort: 'xhigh' })
scenario({ id: 'term-banner-hidden', cwd: 'C:/work/demo', usage: usage(42, 23), surface: 'terminal', band: true, hide: true })
scenario({ id: 'term-banner-neon', cwd: 'C:/work/a-very-long-project-name-that-keeps-going', scene: 'neon', usage: usage(97, 120), edits: 3, surface: 'terminal', band: true, columns: 80, radio: 'playing' })
scenario({ id: 'term-panel-56', cwd: 'C:/work/demo', usage: usage(42, 23), edits: 2, surface: 'terminal', columns: 56, effort: 'high' })
scenario({ id: 'term-panel-100', cwd: 'C:/work/demo', scene: 'jazz', usage: usage(70, 23), edits: 2, surface: 'terminal', columns: 100, radio: 'playing', picker: true })
