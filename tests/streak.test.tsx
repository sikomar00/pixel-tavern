// [연속 기록] 시험: 프롬프트를 보낸 날을 며칠 연속으로 일했는지(하루라도 빠지면 0부터)와 최고 기록. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { aliveCount, dayBefore } from '../hooks/streak'
import { PANE, START, world } from './kit'

const SUBMIT = { text: '비밀 프롬프트 글', origin: { kind: 'composer' } } as never
const line = async (pane: { find: (query: object) => Promise<{ text?: string } | undefined> }) => (await pane.find({ type: 'Text', text: /^연속 \d+일 · 최고 \d+일$/ }))?.text

test('[연속 기록] 어제 날짜는 달력으로 센다(달·해·윤년이 바뀌어도 맞다), 지금 이어지는 일수는 오늘이나 어제까지만 이어진 것이다', async () => {
  expect(dayBefore('2026-11-4')).toBe('2026-11-3')
  expect(dayBefore('2026-3-1')).toBe('2026-2-28')
  expect(dayBefore('2024-3-1')).toBe('2024-2-29') // 윤년
  expect(dayBefore('2026-1-1')).toBe('2025-12-31')
  const streak = { last: '2026-11-3', count: 4, best: 9 }

  expect([aliveCount(streak, '2026-11-3'), aliveCount(streak, '2026-11-4'), aliveCount(streak, '2026-11-5')]).toEqual([4, 4, 0]) // 이틀 지나면 끊겼다
  expect(aliveCount({ last: '', count: 0, best: 0 }, '2026-11-4')).toBe(0)
})

test('[연속 기록] 처음에는 줄이 없고, 첫 프롬프트에 연속 1일이 되며, 같은 날 또 보내도 늘지 않고, 저장하는 것은 날짜와 숫자뿐이다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await line(pane)).toBeUndefined()
  await $.prompt.submit(SUBMIT)
  expect(await line(pane)).toBe('연속 1일 · 최고 1일')
  await $.prompt.submit(SUBMIT)
  expect(await line(pane)).toBe('연속 1일 · 최고 1일')
  expect(store.streak).toEqual({ last: '2026-11-4', count: 1, best: 1 })
  expect(JSON.stringify(store.streak)).not.toContain('비밀')
  await pane.unmount()
})

test('[연속 기록] 어제까지 이어졌으면 오늘 아직 안 했어도 이어져 보이고, 오늘 프롬프트에 하루를 더하며 최고 기록을 넘으면 최고도 오른다', async ($, on) => {
  const store: Record<string, unknown> = { streak: { last: '2026-11-3', count: 9, best: 9 } }
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await line(pane)).toBe('연속 9일 · 최고 9일') // 어제까지 이어졌다: 오늘 아직 안 했어도 이어진다
  await $.prompt.submit(SUBMIT)
  expect(await line(pane)).toBe('연속 10일 · 최고 10일')
  expect(store.streak).toEqual({ last: '2026-11-4', count: 10, best: 10 })
  await pane.unmount()
})

test('[연속 기록] 이틀 이상 빠지면 0부터 다시 센다(최고는 남는다)', async ($, on) => {
  const store: Record<string, unknown> = { streak: { last: '2026-11-1', count: 7, best: 12 } }
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await line(pane)).toBe('연속 0일 · 최고 12일')
  await $.prompt.submit(SUBMIT)
  expect(await line(pane)).toBe('연속 1일 · 최고 12일')
  expect(store.streak).toEqual({ last: '2026-11-4', count: 1, best: 12 })
  await pane.unmount()
})

test('[연속 기록] 자정이 지나도 이어지고(어제 일했으면), 다른 채팅이 오늘 이미 기록했으면 거기서 이어 세어 늘리지 않으며, 모양이 틀린 저장값은 없는 것으로 본다', async ($, on) => {
  const store: Record<string, unknown> = { streak: { last: '2026-11-4', count: 3, best: 3 } }
  const clock = world(on, { liveStore: store, now: Date.parse('2026-11-04T23:59:00') })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await $.prompt.submit(SUBMIT)
  expect(store.streak).toEqual({ last: '2026-11-4', count: 3, best: 3 }) // 오늘 이미 세었다
  await clock.advance(120_000) // 자정이 지났다
  expect(await line(pane)).toBe('연속 3일 · 최고 3일') // 어제 일했으니 이어진다
  store.streak = { last: '2026-11-5', count: 4, best: 4 } // 다른 채팅이 오늘 먼저 기록했다
  await $.prompt.submit(SUBMIT)
  expect(store.streak).toEqual({ last: '2026-11-5', count: 4, best: 4 }) // 그 위에서 이어 세므로 늘리지 않는다
  await clock.advance(60_000) // 1분마다의 갱신이 다른 채팅의 기록을 읽는다
  expect(await line(pane)).toBe('연속 4일 · 최고 4일')
  await pane.unmount()
})

test('[연속 기록] 모양이 틀린 저장값은 버리고, 터미널 패널에도 같은 줄이 나온다', async ($, on) => {
  const store: Record<string, unknown> = { streak: { last: 'garbage', count: -5, best: 'x' } }
  const clock = world(on, { liveStore: store, surfaces: ['terminal'] })

  await $.session.start({ ...START, surface: 'terminal' })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 100 }, surface: 'terminal' })

  expect(await line(pane)).toBeUndefined()
  await $.prompt.submit(SUBMIT)
  expect(await line(pane)).toBe('연속 1일 · 최고 1일')
  expect(store.streak).toEqual({ last: '2026-11-4', count: 1, best: 1 })
  await pane.unmount()
})
