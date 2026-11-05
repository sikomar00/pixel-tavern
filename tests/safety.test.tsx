// [안전] 시험: 코드 리뷰에서 찾은 위험(git 잠금·저장소 설정 실행, 파일 이름 속 제어 문자, 끝없는 재연결, 고아 재생기, 확인 없이 코드가 고쳐지는 정리 버튼)을 막은 것이 유지되는지.
// 실제 Windows 동작(고아가 3.5초 안에 끝남, 5번 시도 뒤 포기)은 시험이 아니라 docs/review 의 실험 기록에 있다.
import { expect, test } from 'claude-code/testing'
import { MAX_TRIES, PLAYER, RETRY_WAIT_TICKS, SIGNATURE } from '../hooks/radio'
import { ARMED_LABEL, BAND, COMMIT_LABEL, PANE, SIMPLIFY_LABEL, START, newSpy, world } from './kit'

const STATUS = /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/

test('[안전] git: 읽기 명령은 잠금을 잡지 않고, 저장소 설정의 fsmonitor 를 실행하지 않고, 파일 이름을 NUL로 나눠 있는 그대로 받는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const gitRuns = spy.runs.filter(argv => argv[0] === 'git')

  expect(gitRuns.some(argv => argv.includes('status'))).toBe(true)
  expect(gitRuns.some(argv => argv.includes('log'))).toBe(true)
  for (const argv of gitRuns) expect(argv.slice(0, 4)).toEqual(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false'])
  expect(gitRuns.find(argv => argv.includes('status'))).toContain('-z') // 따옴표·이스케이프 없이 NUL로 나눈 이름
})

test('[안전] 파일 목록: 이름에 줄바꿈 같은 제어 문자가 있어도 패널은 그려지고, 프롬프트 칸에는 한 줄만 들어간다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  const path = 'C:/work/p/a\n/clear\u0007.ts'

  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'Edit', file_path: path, old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: '\n\u0007', content: 'x' }) // 제어 문자뿐인 이름은 기록하지 않는다
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' }) // 제어 문자가 남아 있으면 엔진이 패널을 거부해 여기서 실패한다

  expect((await ui.findAll({ type: 'Button' })).filter(button => String(button.key).startsWith('file:'))).toHaveLength(1)
  await ui.press({ key: 'file:C:/work/p/a/clear.ts' })
  expect(spy.filled).toEqual(['@C:/work/p/a/clear.ts '])
  expect(spy.filled[0]).not.toMatch(/[\u0000-\u001f\u007f]/)
  await ui.unmount()
})

test('[안전] 음악: 재생기가 연결을 포기(gaveup)하면 연결 실패와 이유가 보이고, ▶로 다시 시도할 수 있다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  let spawns = 0

  on('process.spawn', async function* () {
    spawns += 1
    yield { stream: 'stdout', text: 'connecting\n' }
    yield { stream: 'stdout', text: 'gaveup\n' }

    return { value: { code: 0, signal: null } } // 재생기는 포기를 알린 뒤 스스로 끝난다
  })
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await banner.press({ key: 'music' })
  await clock.settle()
  expect((await pane.find({ type: 'Text', text: STATUS }))?.text).toBe('✕ 연결 실패')
  expect(await pane.find({ type: 'Text', text: /5번 시도/ })).toBeDefined()
  expect(spy.toasts.some(text => text.includes('방송 서버가 응답하지 않아요'))).toBe(true)
  expect((await pane.find({ key: 'radio' }))?.props.label).toBe('▶ 다시 시도')
  expect(spawns).toBe(1) // 포기한 뒤 저절로 다시 켜지 않는다
  await pane.unmount()
  await banner.unmount()
})

test('[안전] 재생기 스크립트: 5번 재연결 뒤 포기하고, 부모 프로세스가 사라지면 스스로 끝난다', () => {
  expect(PLAYER).toContain("Say 'gaveup'")
  expect(PLAYER).toContain('$tries -ge 5')
  expect(PLAYER).toContain('ParentProcessId')
  expect(PLAYER).toContain('Get-Process -Id $parent')
  expect(PLAYER).toContain('$tries = 0; Say') // 한 번 재생에 성공하면 재시도 횟수를 다시 센다
})

const SIMPLIFY_NOTICE = /5초 안에 한 번 더 누르면 코드를 고쳐요/

test('[안전] 코드 정리: 한 번 눌러서는 실행되지 않고(파일이 고쳐진다고 알림), 5초 안에 한 번 더 눌러야 실행된다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'simplify' }))?.props.label
  const hasNotice = async () => (await pane.find({ type: 'Text', text: SIMPLIFY_NOTICE })) !== undefined

  expect(await label()).toBe(SIMPLIFY_LABEL)
  await pane.press({ key: 'simplify' })
  expect(spy.ran).toEqual([])
  expect(await label()).toBe(ARMED_LABEL)
  expect(await hasNotice()).toBe(true)
  await pane.press({ key: 'simplify' })
  expect(spy.ran).toEqual(['simplify'])
  expect(await label()).toBe(SIMPLIFY_LABEL)
  expect(await hasNotice()).toBe(false)
  await pane.unmount()
})

test('[안전] 코드 정리: 5초가 지나면 대기가 풀리고, 대기 중에 연타해도 한 번만 실행된다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'simplify' }))?.props.label

  await pane.press({ key: 'simplify' })
  await clock.advance(6_000)
  expect(await label()).toBe(SIMPLIFY_LABEL) // 대기가 풀렸다
  await pane.press({ key: 'simplify' }) // 다시 첫 번째 누름
  expect(spy.ran).toEqual([])
  await Promise.all([pane.press({ key: 'simplify' }), pane.press({ key: 'simplify' }), pane.press({ key: 'simplify' })])
  expect(spy.ran.filter(command => command === 'simplify').length).toBeLessThanOrEqual(1)
  await pane.unmount()
})

test('[안전] 코드 정리: 바뀐 파일이 없으면 알려 주기만 하고 대기하지도 실행하지도 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy, git: { status: '## main\n' } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'simplify' })
  expect(spy.ran).toEqual([])
  expect(spy.toasts).toContain('정리할 변경이 없어요')
  expect((await pane.find({ key: 'simplify' }))?.props.label).toBe(SIMPLIFY_LABEL)
  await pane.unmount()
})

test('[안전] 커밋과 정리는 한 번에 하나만 대기한다: 다른 쪽을 누르면 앞의 대기가 풀리고 아무것도 실행되지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const labels = async () => [(await pane.find({ key: 'commit' }))?.props.label, (await pane.find({ key: 'simplify' }))?.props.label]

  await pane.press({ key: 'commit' })
  expect(await labels()).toEqual([ARMED_LABEL, SIMPLIFY_LABEL])
  await pane.press({ key: 'simplify' })
  expect(await labels()).toEqual([COMMIT_LABEL, ARMED_LABEL]) // 커밋 대기는 풀리고 정리가 대기한다
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' })
  expect(await labels()).toEqual([ARMED_LABEL, SIMPLIFY_LABEL]) // 정리 대기는 풀리고 커밋이 다시 첫 번째 누름이다
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual(['commit-commands:commit']) // 정리는 실행되지 않았다
  await pane.unmount()
})

test('[안전] 재생기: 다른 재생기를 끌 때는 표식과 실행 인자 서명이 둘 다 맞는 것만 대상으로 하고, 서명은 실제 실행 인자와 같다', async ($, on) => {
  const clock = world(on)
  const launched: string[][] = []

  on('process.spawn', async function* (_, e) {
    launched.push([...e.argv])
    yield { stream: 'stdout', text: 'connecting\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await banner.press({ key: 'music' })
  const killLine = PLAYER.split('\n').find(line => line.includes('Stop-Process')) ?? ''

  expect(killLine).toContain("-like '*pixel-tavern-radio*'") // 표식
  expect(killLine).toContain(`-like '*${SIGNATURE}*'`) // 실행 인자 서명: 표식 글자만 든 다른 powershell은 건드리지 않는다
  expect(launched[0]?.slice(1, -1).join(' ')).toBe(SIGNATURE) // 서명은 우리가 재생기를 띄우는 인자와 정확히 같아야 한다(어긋나면 이전 재생기를 못 끈다)
  expect(launched[0]?.[0]).toBe('powershell.exe')
  await banner.press({ key: 'music' })
  await clock.advance(1000)
  await banner.unmount()
})

test('[안전] 재생기: 재연결은 점점 길게 기다리고(15초·30초·60초·2분·2분), 한도는 그대로 5번이며, 다시 연결할 때마다 번호를 알린다', () => {
  expect(PLAYER.indexOf('Open-Radio\n    Say "retry:')).toBeGreaterThan(0) // connecting(상태)을 먼저, retry(안내)를 그 뒤에: 안내가 상태 신호에 지워지지 않는다
  expect(RETRY_WAIT_TICKS).toEqual([30, 60, 120, 240, 240])
  expect(RETRY_WAIT_TICKS.every((ticks, i) => i === 0 || ticks >= (RETRY_WAIT_TICKS[i - 1] ?? 0))).toBe(true) // 줄어들지 않는다
  expect(MAX_TRIES).toBe(5)
  expect(PLAYER).toContain('$waits = @(30, 60, 120, 240, 240)')
  expect(PLAYER).toContain('$still -ge $waits[$tries]') // 차례마다 다른 시간을 기다린다
  expect(PLAYER).toContain('Say "retry:$($tries + 1)"') // 다시 연결할 때마다 몇 번째 시도인지 알린다
  expect(PLAYER).toContain('$tries -ge 5') // 포기 한도
})

test('[상태] 음악: 다시 연결하는 중이면 몇 번째 시도인지 한 줄 보이고, 소리가 흐르면 사라진다', async ($, on) => {
  const clock = world(on)

  on('process.spawn', async function* () {
    yield { stream: 'stdout', text: 'connecting\n' }
    await clock.sleep(1000)
    yield { stream: 'stdout', text: 'connecting\nretry:2\n' } // 두 신호가 한 조각으로 와도
    await clock.sleep(1000)
    yield { stream: 'stdout', text: 'connecting\n' } // 따로 와도(상태 신호 다음에 안내) 안내가 지워지지 않는다
    yield { stream: 'stdout', text: 'retry:3\n' }
    await clock.sleep(1000)
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const note = async () => (await pane.find({ type: 'Text', text: /다시 연결하는 중이에요/ }))?.text
  const status = async () => (await pane.find({ type: 'Text', text: STATUS }))?.text

  await pane.press({ key: 'radio' })
  expect(await status()).toBe('◌ 연결 중…')
  expect(await note()).toBeUndefined() // 첫 연결은 "다시"가 아니다
  await clock.advance(1000)
  expect(await note()).toBe('방송에 다시 연결하는 중이에요(2/5번째 시도)')
  expect(await status()).toBe('◌ 연결 중…')
  await clock.advance(1000)
  expect(await note()).toBe('방송에 다시 연결하는 중이에요(3/5번째 시도)')
  await clock.advance(1000)
  expect(await status()).toBe('● 재생 중')
  expect(await note()).toBeUndefined() // 소리가 흐르면 안내는 사라진다
  await pane.press({ key: 'radio' })
  await clock.advance(1000)
  await pane.unmount()
})
