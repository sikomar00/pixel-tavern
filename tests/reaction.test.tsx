// [반응] 시험: 작업 끝·테스트 결과 반응(배너 문구 4초, 효과가 켜져 있으면 그림 3초 반짝임). 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { isTestCommand, reactionOfTurn } from '../hooks/reaction'
import { BAND, PANE, START, world } from './kit'

const begin = (turnId: string) => ({ text: '', turnId })
const finish = (turnId: string, reason: 'answer' | 'aborted' | 'error' = 'answer') => ({ answer: '', durationMs: 1000, isAborted: reason === 'aborted', turnId, reason })
const FLASH = '<animate attributeName="fill-opacity" values="0.4;0"'
const RED = 'fill="#ff7a7a" fill-opacity="0"'

test('[반응] 테스트 명령 알아보기: 테스트 도구 이름과 "<패키지 관리자> … test"만 테스트로 보고, 그 밖의 말이나 test가 든 글은 아니다', async () => {
  for (const command of ['pytest -q', 'npm test', 'npm run test -- --watch=false', 'pnpm test', 'yarn test', 'cargo test --release', 'go test ./...', 'claude plugin test .', 'npx vitest run', 'npx tsc --noEmit', 'npm run typecheck', 'python -m unittest', 'cd app && jest', 'dotnet test', 'FORCE_COLOR=1 pytest', 'python -m pytest', 'uv run pytest -x', './node_modules/.bin/jest', 'pnpm --filter web test']) {
    expect(isTestCommand(command), command).toBe(true)
  }
  for (const command of ['ls', 'cat test.txt', 'git add tests/', 'echo testing', 'npm install', 'git commit -m "test: 시험 추가"', 'python tools/render_term.py', 'grep -rn latest .', 'npm install --save-dev vitest', 'git commit -m "add jest config"', 'grep -rn tsc package.json', 'cat tests/jest.config.js', 'echo npm test']) {
    expect(isTestCommand(command), command).toBe(false)
  }
  expect([reactionOfTurn('answer'), reactionOfTurn('aborted'), reactionOfTurn('error'), reactionOfTurn('refusal')]).toEqual(['done', 'stopped', 'failed', 'failed'])
})

test('[반응] 작업이 끝나면 배너 한마디가 4초 바뀌고 그림이 반짝이며, 중단은 흐리게, 오류는 실패와 붉은 반짝임이고, 새 반응이 오면 4초를 다시 센다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  expect(await svg()).not.toContain('작업')
  expect(await svg()).not.toContain(FLASH)
  await $.turn.start(begin('t1'))
  await $.turn.complete(finish('t1'))
  expect(await svg()).toContain('✓ 작업 끝')
  expect(await svg()).toContain(FLASH)
  expect(await svg()).not.toContain(RED)
  await clock.advance(3_000)
  await $.turn.start(begin('t2'))
  await $.turn.complete(finish('t2', 'error'))
  expect(await svg()).toContain('✕ 작업 실패')
  expect(await svg()).toContain(RED)
  await clock.advance(3_000) // 첫 반응으로부터는 6초지만 두 번째로부터 3초: 아직 보인다
  expect(await svg()).toContain('✕ 작업 실패')
  await clock.advance(1_500)
  expect(await svg()).not.toContain('작업 실패')
  expect(await svg()).not.toContain(FLASH)
  await $.turn.start(begin('t3'))
  await $.turn.complete(finish('t3', 'aborted'))
  expect(await svg()).toContain('○ 작업 중단')
  await clock.advance(4_500)
  expect(await svg()).not.toContain('작업 중단')
  await banner.unmount()
})

test('[반응] 서브에이전트의 턴이 끝난 것은 반응하지 않는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.start({ ...begin('sub'), agentId: 'agent-1' })
  await $.turn.complete({ ...finish('sub'), agentId: 'agent-1' })
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).not.toContain('작업 끝')
  await banner.unmount()
})

test('[반응] 효과 강도: 약하게는 반짝임이 있고, 끔은 문구만 나오며 반짝임이 없다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const source = async () => String((await banner.find({ type: 'Svg' }))?.props.source)
  const scene = async () => String((await pane.findAll({ type: 'Svg' }))[0]?.props.source)

  await pane.press({ key: 'motion' }) // 약하게
  await $.turn.start(begin('t1'))
  await $.turn.complete(finish('t1'))
  expect(await source()).toContain(FLASH)
  expect(await scene()).toContain(FLASH) // 패널 그림도 반짝인다
  await clock.advance(4_500)
  await pane.press({ key: 'motion' }) // 끔
  await $.turn.start(begin('t2'))
  await $.turn.complete(finish('t2'))
  expect(await source()).toContain('✓ 작업 끝') // 문구는 나온다
  expect(await source()).not.toContain('<animate')
  expect(await scene()).not.toContain('<animate')
  await banner.unmount()
  await pane.unmount()
})

test('[반응] 터미널 명령(Bash·PowerShell)이 테스트 명령이면 통과·실패 반응을 보이고, 그 밖의 명령과 거부된 호출은 반응하지 않으며, 명령의 글은 저장하지 않는다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  expect(await svg()).not.toContain('테스트')
  await $.tool.call({ tool: 'Bash', command: 'npm test -- --token=SECRET' })
  expect(await svg()).toContain('✓ 테스트 통과')
  await clock.advance(4_500)
  expect(await svg()).not.toContain('테스트')
  await $.tool.call({ tool: 'PowerShell', command: 'npm test' })
  expect(await svg()).toContain('✓ 테스트 통과')
  expect(JSON.stringify(store)).not.toContain('SECRET') // 명령의 글은 어디에도 없다
  expect(JSON.stringify(store)).not.toContain('npm test')
  await banner.unmount()
})

test('[반응] 테스트 명령이 오류로 끝나면 테스트 실패(붉은 반짝임)다', async ($, on) => {
  const clock = world(on, { tool: { value: { isError: true, result: {} } } })

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  await $.tool.call({ tool: 'Bash', command: 'pytest -q' })
  expect(await svg()).toContain('✕ 테스트 실패')
  expect(await svg()).toContain(RED)
  await banner.unmount()
})

test('[반응] 거부된 테스트 명령은 실행되지 않았으니 반응하지 않는다', async ($, on) => {
  const clock = world(on, { tool: { value: { deny: '막음' } } })

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).not.toContain('테스트')
  await banner.unmount()
})

test('[반응] 터미널 배너에도 문구가 나온다(반짝임은 없다)', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start({ ...START, surface: 'terminal' })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.turn.start(begin('t1'))
  await $.turn.complete(finish('t1'))
  expect((await band.find({ type: 'Text', text: '✓ 작업 끝' }))?.text).toBe('✓ 작업 끝')
  await clock.advance(4_500)
  expect(await band.find({ type: 'Text', text: '✓ 작업 끝' })).toBeUndefined()
  await band.unmount()
})
