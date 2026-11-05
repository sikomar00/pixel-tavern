// [진행] 시험: 빠른 실행 버튼의 진행 상태(대기 → 진행 중 → 끝·중단·실패)가 턴 이벤트를 따라가는지.
// 실제 엔진에서 명령 호출과 턴 시작·끝의 순서는 확인하지 못했다(docs/review/remaining-issues.md R-20): 시험은 가짜 엔진이 보내는 순서만 본다.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { WARN_COLOR } from '../hooks/svg'
import { PANE, START, newSpy, world } from './kit'

const begin = (turnId: string) => ({ text: '', turnId })

const finish = (turnId: string, durationMs = 42_000) => ({ answer: '', durationMs, isAborted: false, turnId, reason: 'answer' as const })

const mountPane = async ($: Engine, clock: { settle: () => Promise<void> }) => {
  await $.session.start(START)
  await clock.settle()

  return $.ui.mount({ ...PANE, surface: 'desktop' })
}

test('[진행] 버튼을 누르면 대기 → 진행 중 → 끝(걸린 시간)으로 보이고, 60초 뒤 사라진다', async ($, on) => {
  const clock = world(on)
  const pane = await mountPane($, clock)
  const line = async () => (await pane.find({ type: 'Text', text: /^[◌●✓○✕] 코드 리뷰/ }))?.text

  expect(await line()).toBeUndefined()
  await pane.press({ key: 'review' })
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…')
  await $.turn.start(begin('t1'))
  expect(await line()).toBe('● 코드 리뷰 진행 중…')
  await $.turn.complete(finish('t1'))
  expect(await line()).toBe('✓ 코드 리뷰 끝 · 42초')
  await clock.advance(59_000)
  expect(await line()).toBe('✓ 코드 리뷰 끝 · 42초')
  await clock.advance(2_000)
  expect(await line()).toBeUndefined()
  await pane.unmount()
})

test('[진행] 누르기 전에 시작한 턴·서브에이전트의 턴·다른 턴의 끝은 상태를 바꾸지 않는다', async ($, on) => {
  const clock = world(on)
  const pane = await mountPane($, clock)
  const line = async () => (await pane.find({ type: 'Text', text: /^[◌●✓○✕] 코드 리뷰/ }))?.text

  await $.turn.start(begin('t0')) // 누르기 전에 이미 돌던 턴: 따라가지 않는다
  await pane.press({ key: 'review' })
  await $.turn.complete(finish('t0')) // 그 턴이 끝나도 우리 작업은 아직 시작 전이다
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…')
  await $.turn.start({ ...begin('sub'), agentId: 'agent-1' })
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…') // 서브에이전트의 턴은 건너뛴다
  await $.turn.start(begin('t2'))
  expect(await line()).toBe('● 코드 리뷰 진행 중…')
  await $.turn.complete(finish('t0')) // 다른 턴의 끝
  await $.turn.complete({ ...finish('sub'), agentId: 'agent-1' })
  expect(await line()).toBe('● 코드 리뷰 진행 중…')
  await $.turn.complete(finish('t2', 400))
  expect(await line()).toBe('✓ 코드 리뷰 끝 · 1초') // 1초 미만이어도 0초로 보이지 않는다
  await pane.unmount()
})

test('[진행] 중단됨·실패(오류·거절)는 알맞은 말로 보이고 실패만 경고색이며, 정리·커밋은 이름이 맞다', async ($, on) => {
  const clock = world(on)
  const pane = await mountPane($, clock)
  const find = async (pattern: RegExp) => pane.find({ type: 'Text', text: pattern })

  await pane.press({ key: 'simplify' }) // 두 번 눌러야 실행된다
  await pane.press({ key: 'simplify' })
  await $.turn.start(begin('a'))
  await $.turn.complete({ ...finish('a'), isAborted: true, reason: 'aborted' })
  expect((await find(/^○ 코드 정리 중단됨$/))?.props.color).not.toBe(WARN_COLOR)
  await pane.press({ key: 'review' })
  await $.turn.start(begin('b'))
  await $.turn.complete({ ...finish('b'), reason: 'error' })
  expect((await find(/^✕ 코드 리뷰 실패$/))?.props.color).toBe(WARN_COLOR)
  await pane.press({ key: 'commit' })
  await pane.press({ key: 'commit' })
  await $.turn.start(begin('c'))
  await $.turn.complete({ ...finish('c'), reason: 'refusal', refusal: { category: null, explanation: null } })
  expect(await find(/^✕ 변경 커밋 실패$/)).toBeDefined()
  await pane.unmount()
})

test('[진행] 명령 호출이 끝났는데 모델 작업이 시작되지 않으면 15초 뒤 기다림을 접는다', async ($, on) => {
  const clock = world(on)
  const pane = await mountPane($, clock)
  const line = async () => (await pane.find({ type: 'Text', text: /^◌ 코드 리뷰/ }))?.text

  await pane.press({ key: 'review' })
  await clock.advance(14_000)
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…')
  await clock.advance(2_000)
  expect(await line()).toBeUndefined()
  await pane.unmount()
})

test('[진행] 다시 누르면 새 대기로 바뀌고, 옛 타이머가 새 대기를 일찍 지우지 못한다', async ($, on) => {
  const clock = world(on)
  const pane = await mountPane($, clock)
  const line = async () => (await pane.find({ type: 'Text', text: /^◌ 코드 리뷰/ }))?.text

  await pane.press({ key: 'review' }) // 0초: 15초 타이머 시작
  await clock.advance(10_000)
  await pane.press({ key: 'review' }) // 10초: 새 대기(25초까지)
  await clock.advance(7_000) // 17초: 첫 타이머의 15초가 지났다
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…')
  await clock.advance(9_000) // 26초
  expect(await line()).toBeUndefined()
  await pane.unmount()
})

test('[진행] 명령을 실행하지 못하면 진행 표시를 남기지 않고 알려 준다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { runFails: true, spy })
  const pane = await mountPane($, clock)

  await pane.press({ key: 'review' })
  expect(await pane.find({ type: 'Text', text: /^[◌●✓○✕] 코드 리뷰/ })).toBeUndefined()
  expect(spy.toasts.some(text => text.includes('/code-review 를 실행하지 못했어요'))).toBe(true)
  await pane.unmount()
})

test('[진행] 세션이 바빠 줄 서 있던 옛 눌림의 호출이 끝나도, 새로 누른 버튼의 기다림 표시는 그대로 남는다', async ($, on) => {
  const clock = world(on, { runDelaysMs: [5_000, 40_000] }) // 첫 호출은 5초, 둘째 호출은 40초 뒤에 실행된다
  const pane = await mountPane($, clock)
  const line = async () => (await pane.find({ type: 'Text', text: /^◌ 코드 리뷰/ }))?.text

  const first = pane.press({ key: 'review' }) // 0초
  await clock.advance(1_000)
  const second = pane.press({ key: 'review' }) // 1초
  await clock.advance(5_000) // 6초: 첫 호출이 끝났다(옛 코드는 여기서 15초 접기 타이머를 건다)
  await first
  await clock.advance(16_000) // 22초: 옛 코드라면 21초에 둘째의 기다림을 접어 버렸다
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…')
  await clock.advance(20_000) // 42초: 둘째 호출이 끝났다(41초) — 접기까지 15초가 다시 센다
  await second
  expect(await line()).toBe('◌ 코드 리뷰 대기 중…')
  await $.turn.start(begin('t9')) // 줄 서 있던 둘째 명령의 작업이 시작된다
  expect(await line()).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^● 코드 리뷰 진행 중…$/ })).toBeDefined()
  await pane.unmount()
})
