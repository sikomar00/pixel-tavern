// [안전] 시험: 코드 리뷰에서 찾은 위험(git 잠금·저장소 설정 실행, 파일 이름 속 제어 문자, 끝없는 재연결, 고아 재생기)을 막은 것이 유지되는지.
// 실제 Windows 동작(고아가 3.5초 안에 끝남, 5번 시도 뒤 포기)은 시험이 아니라 docs/review 의 실험 기록에 있다.
import { expect, test } from 'claude-code/testing'
import { PLAYER } from '../hooks/radio'
import { BAND, PANE, START, newSpy, world } from './kit'

const STATUS = /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/

test('[안전] git: 읽기 명령은 잠금을 잡지 않고 저장소 설정의 fsmonitor 를 실행하지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const gitRuns = spy.runs.filter(argv => argv[0] === 'git')

  expect(gitRuns.some(argv => argv.includes('status'))).toBe(true)
  expect(gitRuns.some(argv => argv.includes('log'))).toBe(true)
  for (const argv of gitRuns) expect(argv.slice(0, 4)).toEqual(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false'])
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
