// [타임라인] 시험: 오늘 작업 기록(시각·종류·고친 파일 수만, 오늘 하루). 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { NOON, PANE, START, world } from './kit'

const DAY = '2026-11-4' // kit의 NOON이 있는 날
const SUBMIT = { text: '비밀 프롬프트 글', origin: { kind: 'composer' } } as never
const begin = (turnId: string) => ({ text: '', turnId })
const finish = (turnId: string, reason: 'answer' | 'aborted' | 'error' = 'answer') => ({ answer: '비밀 답 글', durationMs: 1000, isAborted: reason === 'aborted', turnId, reason })
const edit = (path: string) => ({ tool: 'Edit' as const, file_path: path, old_string: 'a', new_string: 'b' })
const keysOf = (store: Record<string, unknown>) => Object.keys(store).filter(key => key.startsWith('timeline:'))

test('[타임라인] 프롬프트와 작업 끝이 시각과 함께 기록되고, 작업 끝에는 그 턴에 고친 파일 수(같은 파일은 한 번)가 붙으며, 파일 이름·글은 저장되지 않는다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ key: 'fold:timeline' })).toBeUndefined() // 기록이 없으면 줄이 나오지 않는다
  await $.prompt.submit(SUBMIT)
  await clock.advance(60_000)
  await $.turn.start(begin('t1'))
  for (const path of ['C:/work/p/a.ts', 'C:/work/p/b.ts', 'C:/work/p/a.ts']) await $.tool.call(edit(path))
  await $.turn.complete(finish('t1'))
  await clock.advance(60_000)
  await $.turn.start(begin('t2')) // 고친 파일이 없는 다음 턴: 앞 턴의 파일 수가 따라오지 않는다
  await $.turn.complete(finish('t2'))
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 3개')
  await pane.press({ key: 'fold:timeline' })
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)

  expect(texts[texts.indexOf('12:02') + 1]).toBe('작업 끝')
  expect(texts[texts.indexOf('12:01') + 1]).toBe('작업 끝 · 파일 2개')
  expect(texts[texts.indexOf('12:00') + 1]).toBe('프롬프트')
  expect(texts.indexOf('12:01')).toBeLessThan(texts.indexOf('12:00')) // 최근 것이 위
  const saved = JSON.stringify(Object.fromEntries(keysOf(store).map(key => [key, store[key]])))

  expect(keysOf(store)).toHaveLength(1) // 이 채팅의 칸 하나
  for (const secret of ['a.ts', 'b.ts', 'C:/work', '비밀 프롬프트 글', '비밀 답 글']) expect(saved, secret).not.toContain(secret)
  await pane.unmount()
})

test('[타임라인] 중단·오류는 작업 중단으로 기록하고, 거부된 도구 호출은 파일 수에 넣지 않으며, 서브에이전트의 턴은 기록하지 않는다', async ($, on) => {
  const clock = world(on, { tool: { value: { deny: '막음' } } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await $.turn.start({ ...begin('sub'), agentId: 'agent-1' })
  await $.turn.complete({ ...finish('sub'), agentId: 'agent-1' })
  expect(await pane.find({ key: 'fold:timeline' })).toBeUndefined() // 서브에이전트의 턴은 기록하지 않는다
  await $.turn.start(begin('t1'))
  await $.tool.call(edit('C:/work/p/a.ts')) // 거부됨
  await $.turn.complete(finish('t1', 'aborted'))
  await clock.advance(1000)
  await $.turn.start(begin('t2'))
  await $.turn.complete(finish('t2', 'error'))
  await pane.press({ key: 'fold:timeline' })
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)

  expect(texts.filter(text => text === '작업 중단')).toHaveLength(2) // 파일 수가 붙지 않는다: 거부된 호출은 세지 않는다
  expect(texts.some(text => /파일 \d+개/.test(String(text)))).toBe(false)
  await pane.unmount()
})

test('[타임라인] 다른 채팅의 기록과 합쳐 보이고(모양이 틀린 것은 버림), 지난 날의 칸은 지워진다', async ($, on) => {
  const store: Record<string, unknown> = {
    [`timeline:${DAY}:chat-b`]: {
      date: DAY,
      entries: [{ at: NOON - 30 * 60_000, kind: 'done', files: 3 }, { at: 'x', kind: 'done' }, { at: NOON - 1, kind: 'nope' }, 7, { at: NOON - 60 * 60_000, kind: 'prompt' }],
    },
    'timeline:2026-11-3:old': { date: '2026-11-3', entries: [{ at: NOON - 24 * 3_600_000, kind: 'prompt' }] },
    [`timeline:${DAY}:chat-c`]: 'garbage',
  }
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 2개') // 쓸 수 있는 것 둘만
  expect(store['timeline:2026-11-3:old']).toBeUndefined() // 지난 날의 칸은 지워진다
  await pane.press({ key: 'fold:timeline' })
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)

  expect(texts).toEqual(expect.arrayContaining(['11:30', '작업 끝 · 파일 3개', '11:00', '프롬프트']))
  await pane.unmount()
})

test('[타임라인] 자정이 지나면 오늘 기록은 0부터 다시 시작하고, 어제 칸은 지워진다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store, now: Date.parse('2026-11-04T23:59:00') })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await $.prompt.submit(SUBMIT)
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 1개')
  expect(keysOf(store)[0]).toContain(':2026-11-4:')
  await clock.advance(120_000) // 1분마다의 갱신이 날짜가 바뀐 것을 본다
  expect(await pane.find({ key: 'fold:timeline' })).toBeUndefined()
  expect(keysOf(store).filter(key => key.includes(':2026-11-4:'))).toHaveLength(0) // 어제 칸은 지워진다
  await $.prompt.submit(SUBMIT)
  expect(keysOf(store)[0]).toContain(':2026-11-5:')
  await pane.unmount()
})

test('[타임라인] 한 칸은 50개까지만 읽고(다른 채팅이 더 많이 써 둬도), 패널에는 최근 10개와 "…외 N개"가 보인다', async ($, on) => {
  const entries = Array.from({ length: 60 }, (_, i) => ({ at: NOON - (60 - i) * 60_000, kind: 'prompt' }))
  const clock = world(on, { liveStore: { [`timeline:${DAY}:chat-b`]: { date: DAY, entries } } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 50개') // 60개 중 최근 50개
  await pane.press({ key: 'fold:timeline' })
  expect((await pane.findAll({ type: 'Text', text: /^\d\d:\d\d$/ })).length).toBe(10) // 시각이 있는 줄
  expect((await pane.find({ type: 'Text', text: '…외 40개' }))?.text).toBe('…외 40개')
  await pane.unmount()
})

test('[타임라인] 이 채팅의 오늘 기록도 50개까지만 남긴다(오래된 것부터 버림)', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  for (let i = 0; i < 51; i += 1) await $.prompt.submit(SUBMIT)
  const mine = store[keysOf(store)[0] ?? ''] as { entries: unknown[] }

  expect(mine.entries).toHaveLength(50)
})

test('[타임라인] 기본은 접힘: 접기 설정을 이미 저장해 둔 사용자에게도 한 번만 접어 보이고, 접기 설정을 바꾼 뒤에는 다시 접지 않는다', async ($, on) => {
  const store: Record<string, unknown> = { collapsed: ['art'] } // 이 기능이 생기기 전에 저장된 목록
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await $.prompt.submit(SUBMIT)
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 1개')
  expect(store.collapsed).toEqual(['art', 'timeline'])
  expect(store.foldedIntroduced).toEqual(['timeline'])
  await pane.press({ key: 'fold:timeline' }) // 사용자가 폈다
  expect(store.collapsed).toEqual(['art'])
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▾ 오늘 작업 기록 1개')
  await pane.unmount()
})

test('[타임라인] 처음 쓰는 사용자도 기본은 접힘이고, 펴면 저장되며 "이미 반영함" 표시가 남아 다음에 다시 접히지 않는다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await $.prompt.submit(SUBMIT)
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 1개')
  expect(store.foldedIntroduced).toBeUndefined() // 아직 아무것도 저장하지 않았다
  await pane.press({ key: 'fold:timeline' })
  expect(store.collapsed).toEqual(['commits', 'changes', 'projects']) // 기본 접힘 목록에서 작업 기록만 빠진다
  expect(store.foldedIntroduced).toEqual(['timeline'])
  await pane.unmount()
})

test('[타임라인] 이미 접기 설정을 정한 사용자(표시가 있음)가 펴 둔 기록 줄은 다음에 열어도 펴진 채로 있다', async ($, on) => {
  const clock = world(on, { stored: { collapsed: ['art'], foldedIntroduced: ['timeline'] } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await $.prompt.submit(SUBMIT)
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▾ 오늘 작업 기록 1개')
  await pane.unmount()
})

test('[타임라인] 터미널 패널에도 같은 줄이 나온다', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start({ ...START, surface: 'terminal' })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 100 }, surface: 'terminal' })

  await $.prompt.submit(SUBMIT)
  expect((await pane.find({ key: 'fold:timeline' }))?.props.label).toBe('▸ 오늘 작업 기록 1개')
  await pane.unmount()
})
