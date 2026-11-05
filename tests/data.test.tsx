// [데이터] 시험. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { ART, composeScene } from '../hooks/art'
import { baseName, fmtReset, shortModel } from '../hooks/format'
import { parseLog, parseStatus } from '../hooks/git'
import { bannerSvg } from '../hooks/banner'
import { HELP } from '../hooks/help'
import { NO_ALERTS, checkAlerts } from '../hooks/alerts'
import { mergeToday } from '../hooks/state'
import { filledSegments as segmentsFor, usageSummary, usageSvg } from '../hooks/usage'
import { MODES, SCENES } from '../hooks/scenes'
import { WARN_COLOR } from '../hooks/svg'
import { ARMED_LABEL, BAND, GIT_LOG, GIT_STATUS, METAPHOR_NAMES, NOON, PANE, START, USAGE, counter, filledSegments, newSpy, world } from './kit'

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

    expect(art.labelName, `${id} 게이지 이름`).toBe('컨텍스트')
    expect(svg).toContain('컨텍스트 42%')
    expect(svg).toContain('viewBox="0 0 85 74"') // 그림이 끝나는 줄에서 자른다
    expect(svg).not.toContain(scene.title) // 제목·모토 블록은 그리지 않는다(장면 선택 칸과 배너에 있다)
    expect(svg).not.toContain(scene.motto)
    expect(art.gauges).toHaveLength(21)
    expect(svg.length).toBeLessThan(131072)
    expect(composeScene(art, null)).toContain('컨텍스트 -')
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

test('[데이터] 사용량 0·3·45·100%와 초과 상태에서 숫자와 원의 칸 수가 일치한다', async () => {
  const at = (scene: (typeof SCENES)[keyof typeof SCENES], percentUsed: number) =>
    usageSvg(scene, { limits: [{ kind: 'five_hour', percentUsed, resetsAt: '2026-11-04T13:37:00' }] } as never, NOON)

  for (const scene of Object.values(SCENES)) {
    for (const [percent, filled] of [[0, 0], [3, 1], [45, 9], [100, 20], [120, 20]] as const) {
      const svg = at(scene, percent)

      expect(svg, `${scene.id} ${percent}% 숫자`).toContain(`>${percent}%<`)
      expect(filledSegments(svg), `${scene.id} ${percent}% 원`).toBe(filled)
    }
    // 기능 이름만 쓴다(장면별 비유 이름은 없다). 리셋까지 남은 시간도 문구로 알린다.
    expect(at(scene, 45), scene.id).toContain('>5시간 한도<')
    for (const old of METAPHOR_NAMES) expect(at(scene, 45), `${scene.id} ${old}`).not.toContain(`>${old}<`)
    expect(at(scene, 45), scene.id).toContain('1h 37m 뒤 리셋')
  }
  // 주간 한도가 없는 원은 0%처럼 보이지 않고 "정보 없음"이라고 쓴다.
  expect(at(SCENES.attic, 45)).toContain('>정보 없음<')
  // 배너도 같은 반올림을 쓴다.
  const banner = bannerSvg({ scene: SCENES.attic, usage: { limits: [{ kind: 'five_hour', percentUsed: 44.6 }] } as never, git: null, model: null, project: 'p', now: NOON, radio: 'off' })

  expect(banner).toContain('>45%<')
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

test('[데이터] 장면 통합: 예전 버전이 저장한 모드·장면 설정도 그대로 읽는다', async ($, on) => {
  const saved = { mode: 'adventure', sceneByMode: { cozy: 'tearoom', adventure: 'neon' } }
  const clock = world(on, { stored: { mood: saved } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(String((await pane.find({ type: 'Svg' }))?.props.alt)).toContain('네온 펑크 성')
  await pane.unmount()
})

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
  for (const old of METAPHOR_NAMES) expect(svg).not.toContain(`>${old}<`) // 비유 이름은 없다
  expect(svg).toContain('>84k/200k<')
  expect(svg).toContain('>1h 37m 뒤 리셋<')
  expect(svg).toContain('>2d 3h 뒤 리셋<')
  expect(usageSvg(SCENES.attic, null, NOON)).toContain('>-<') // 값이 없으면 0%처럼 보이지 않는다
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
