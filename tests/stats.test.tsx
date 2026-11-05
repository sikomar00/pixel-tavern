// [통계] 시험: 오늘 통계가 여러 채팅이 겹쳐 쓰는 상황에서도 정확한지(채팅마다 자기 칸에 쓰고 합계는 칸들의 합).
// 옛 방식(모두가 today 키 하나를 읽고-고치고-쓰기)은 10에서 두 채팅이 1씩 늘리면 11이 됐다 — 실제로 재현했다(docs/review 참고).
import { expect, test } from 'claude-code/testing'
import { fingerprint } from '../hooks/format'
import { withFile } from '../hooks/stats'
import { PANE, START, counter, slotsOf, world } from './kit'

const DAY = '2026-11-4' // kit의 NOON이 있는 날
const B = `today:${DAY}:chat-b` // 다른 채팅의 칸
const bash = { tool: 'Bash', command: 'ls' } as const

const slot = (prompts: number, actions: number, files: string[] = []) => ({ date: DAY, prompts, actions, files })

const total = (store: Record<string, unknown>, field: 'prompts' | 'actions'): number => slotsOf(store, DAY).reduce((sum, item) => sum + item[field], 0)

const mount = async ($: Parameters<Parameters<typeof test>[1]>[0], clock: { settle: () => Promise<void> }) => {
  await $.session.start(START)
  await clock.settle()

  return $.ui.mount({ ...PANE, surface: 'desktop' })
}

test('[통계] 두 채팅이 같은 순간에 늘려도 한 번도 사라지지 않고, 화면은 다음 갱신에서 따라온다', async ($, on) => {
  const store: Record<string, unknown> = { [B]: slot(0, 10) } // 지금까지 도구 실행 10번(채팅 B)
  let isArmed = false
  const clock = world(on, {
    liveStore: store,
    storeHooks: {
      afterGet: key => {
        if (!isArmed || key !== B) return
        isArmed = false
        store[B] = slot(0, 11) // 이 채팅(A)이 B의 칸(10)을 읽어 간 직후, B가 1번 늘렸다
      },
    },
  })
  const pane = await mount($, clock)

  isArmed = true
  await clock.advance(60_000) // A의 1분 갱신이 B의 칸을 읽는다(10)
  await $.tool.call(bash) // A도 1번 늘린다
  expect(total(store, 'actions')).toBe(12) // 저장소에는 둘 다 남아 있다(옛 방식은 11)
  expect(await counter(pane, '도구 실행')).toBe('11') // 화면은 B의 마지막 1번을 아직 모른다
  await clock.advance(60_000)
  expect(await counter(pane, '도구 실행')).toBe('12') // 다음 갱신에서 따라온다
  await pane.unmount()
})

test('[통계] 이 채팅의 기록은 자기 칸에만 쓰고, 다른 채팅의 칸과 옛 합계 키는 건드리지 않는다', async ($, on) => {
  const legacy = { date: DAY, prompts: 7, actions: 9, files: [] }
  const store: Record<string, unknown> = { [B]: slot(2, 5), today: legacy }
  const clock = world(on, { liveStore: store })
  const pane = await mount($, clock)

  for (let i = 0; i < 3; i += 1) await $.tool.call(bash)
  await $.prompt.submit({ text: '안녕', origin: { kind: 'composer' } } as never)
  const mine = slotsOf(store, DAY).filter(item => item.actions === 3)

  expect(mine).toEqual([{ date: DAY, prompts: 1, actions: 3, files: [] }])
  expect(store[B]).toEqual(slot(2, 5))
  expect(store.today).toEqual(legacy)
  expect(Object.keys(store).filter(key => key.startsWith('today:'))).toHaveLength(2) // B의 칸과 이 채팅의 칸
  expect(await counter(pane, '프롬프트')).toBe('10') // 7(옛 합계) + 2(B) + 1(이 채팅)
  expect(await counter(pane, '도구 실행')).toBe('17') // 9 + 5 + 3
  await pane.unmount()
})

test('[통계] 두 채팅이 번갈아 늘리면 저장소 합과 화면이 모두 실제 횟수와 같다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })
  const pane = await mount($, clock)

  for (let i = 1; i <= 5; i += 1) {
    await $.tool.call(bash) // 이 채팅(A)
    store[B] = slot(0, i) // 다른 채팅(B)도 그만큼
    await clock.advance(60_000)
  }
  expect(total(store, 'actions')).toBe(10)
  expect(await counter(pane, '도구 실행')).toBe('10')
  await pane.unmount()
})

test('[통계] 같은 칸을 여러 번 읽어도(갱신이 겹쳐도) 합계가 늘지 않는다', async ($, on) => {
  const store: Record<string, unknown> = { [B]: slot(3, 4) }
  const clock = world(on, { liveStore: store })
  const pane = await mount($, clock)

  for (let i = 0; i < 4; i += 1) await clock.advance(60_000)
  expect(await counter(pane, '프롬프트')).toBe('3')
  expect(await counter(pane, '도구 실행')).toBe('4')
  await pane.unmount()
})

test('[통계] 두 채팅이 같은 파일을 고쳐도 한 번만 세고, 저장소에는 경로가 아니라 지문만 남는다', async ($, on) => {
  const store: Record<string, unknown> = { [B]: slot(0, 1, [fingerprint('C:/work/p/a.ts')]) }
  const clock = world(on, { liveStore: store })
  const pane = await mount($, clock)

  expect(await counter(pane, '수정 파일')).toBe('1') // B가 고친 a.ts
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\work\\p\\a.ts', old_string: 'a', new_string: 'b' }) // 같은 파일(역슬래시 경로)
  expect(await counter(pane, '수정 파일')).toBe('1')
  await $.tool.call({ tool: 'Write', file_path: 'C:/work/p/b.ts', content: 'x' })
  expect(await counter(pane, '수정 파일')).toBe('2')
  expect(slotsOf(store, DAY).flatMap(item => item.files).sort()).toEqual([fingerprint('C:/work/p/a.ts'), fingerprint('C:/work/p/a.ts'), fingerprint('C:/work/p/b.ts')].sort())
  expect(JSON.stringify(store)).not.toContain('work/p') // 절대 경로는 저장하지 않는다
  await pane.unmount()
})

test('[통계] 날짜가 바뀌면 오늘 숫자는 0부터 다시 세고, 지난 날의 칸과 옛 합계 키는 지워진다', async ($, on) => {
  const store: Record<string, unknown> = {
    [B]: slot(1, 1),
    'today:2026-11-3:old': { date: '2026-11-3', prompts: 9, actions: 9, files: [] },
    today: { date: '2026-11-3', prompts: 50, actions: 90, files: ['C:/old.ts'] },
  }
  const clock = world(on, { liveStore: store, now: Date.parse('2026-11-04T23:58:00') }) // 자정 2분 전에서 시작(1분 갱신이 몇 번만 돌게)
  const pane = await mount($, clock)

  await $.tool.call(bash)
  expect(await counter(pane, '도구 실행')).toBe('2') // B 1 + 이 채팅 1(어제 칸·옛 합계는 섞이지 않는다)
  await clock.advance(3 * 60_000) // 자정을 넘긴 새벽 0시 1분
  expect(await counter(pane, '도구 실행')).toBe('0')
  expect(Object.keys(store).filter(key => key === 'today' || key.startsWith('today:'))).toEqual([]) // 어제까지의 칸과 옛 합계 키가 모두 정리됐다(저장소가 불어나지 않는다)
  await $.tool.call(bash)
  expect(await counter(pane, '도구 실행')).toBe('1')
  expect(slotsOf(store, '2026-11-5').map(item => item.actions)).toEqual([1])
  await pane.unmount()
})

test('[통계] 앱을 껐다 켜도(앞선 실행의 칸이 남아 있음) 오늘 합계가 바로 이어진다', async ($, on) => {
  const store: Record<string, unknown> = { [`today:${DAY}:prev-run`]: slot(4, 20, [fingerprint('C:/x.ts')]) }
  const clock = world(on, { liveStore: store })
  const pane = await mount($, clock) // 갱신 시각이 오기 전에도 시작할 때 읽어 둔다

  expect(await counter(pane, '프롬프트')).toBe('4')
  expect(await counter(pane, '도구 실행')).toBe('20')
  expect(await counter(pane, '수정 파일')).toBe('1')
  await $.tool.call(bash)
  expect(await counter(pane, '도구 실행')).toBe('21')
  expect(store[`today:${DAY}:prev-run`]).toEqual(slot(4, 20, [fingerprint('C:/x.ts')])) // 앞 칸은 그대로
  await pane.unmount()
})

test('[통계] 옛 합계 키(경로가 든 것)는 읽기만 하고 중복해서 세지 않으며, 같은 파일은 지문으로 맞춘다', async ($, on) => {
  const legacy = { date: DAY, prompts: 7, actions: 9, files: ['C:/work/p/a.ts', 'C:/work/p/b.ts'] }
  const store: Record<string, unknown> = { today: legacy }
  const clock = world(on, { liveStore: store })
  const pane = await mount($, clock)

  expect(await counter(pane, '도구 실행')).toBe('9')
  expect(await counter(pane, '수정 파일')).toBe('2')
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/a.ts', old_string: 'a', new_string: 'b' }) // 옛 합계에 이미 있는 파일
  expect(await counter(pane, '도구 실행')).toBe('10')
  expect(await counter(pane, '수정 파일')).toBe('2')
  for (let i = 0; i < 3; i += 1) await clock.advance(60_000)
  expect(await counter(pane, '도구 실행')).toBe('10') // 갱신이 거듭돼도 늘지 않는다
  expect(store.today).toEqual(legacy)
  await pane.unmount()
})

test('[통계] 한 칸의 수정 파일은 500개까지만 담고, 같은 파일은 다시 더하지 않으며, 오래된 것부터 버린다', () => {
  let t = { date: DAY, prompts: 0, actions: 0, files: [] as string[] }

  for (let i = 0; i < 505; i += 1) t = withFile(t, `p${i}`)
  expect(t.files).toHaveLength(500)
  expect(t.files[0]).toBe('p5') // 처음 5개가 밀려났다
  expect(t.files[499]).toBe('p504')
  expect(withFile(t, 'p300').files).toEqual(t.files) // 이미 있는 것은 다시 더하지 않는다(순서도 그대로)
})

test('[통계] 한 채팅에서 동시에 늘리고 쓰기가 뒤바뀌어 끝나도, 마지막에 저장된 값이 최신이다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store, storeHooks: { setDelayMs: (key, nth) => (key.startsWith('today:') && nth === 0 ? 5_000 : 0) } }) // 첫 쓰기만 느리다
  const pane = await mount($, clock)
  const calls = Promise.all([$.tool.call(bash), $.tool.call(bash), $.tool.call(bash)])

  await clock.advance(6_000)
  await calls
  expect(slotsOf(store, DAY).map(item => item.actions)).toEqual([3]) // 느린 첫 쓰기의 옛 값(1)이 마지막에 남지 않는다
  expect(await counter(pane, '도구 실행')).toBe('3')
  await pane.unmount()
})

test('[통계] 파일 지문: 8자리 16진수이고, 역슬래시·슬래시 경로가 같고, 서로 다른 경로는 겹치지 않는다', () => {
  expect(fingerprint('C:/work/p/a.ts')).toMatch(/^[0-9a-f]{8}$/)
  expect(fingerprint('C:\\work\\p\\a.ts')).toBe(fingerprint('C:/work/p/a.ts'))
  expect(fingerprint('C:/work/p/a.ts')).not.toBe(fingerprint('C:/work/p/b.ts'))
  expect(fingerprint('한글/문서.md')).toMatch(/^[0-9a-f]{8}$/)
  const prints = new Set(Array.from({ length: 2000 }, (_, i) => fingerprint(`C:/w/dir${i % 7}/file${i}.ts`)))

  expect(prints.size).toBe(2000)
})
