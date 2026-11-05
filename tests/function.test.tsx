// [기능] 시험. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { BAND, COMMIT_LABEL, PANE, START, fakePlayer, newSpy, world } from './kit'
import type { Env } from './kit'

test('[기능] 배너: ⟳는 4개 장면을 차례로 돌고, ✕로 숨겼다가 다시 연다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const title = async () => String((await ui.find({ type: 'Svg' }))?.props.source)

  expect(await title()).toContain('비 오는 밤 다락방')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('7080 다방')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('8비트 던전')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('네온 펑크 성')
  await ui.press({ key: 'shuffle' })
  expect(await title()).toContain('비 오는 밤 다락방') // 한 바퀴
  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.press({ key: 'show' })
  expect(await title()).toContain('비 오는 밤 다락방')
  await ui.unmount()
})

test('[기능] 패널: 장면을 고르면 바뀌고, 한도·프로젝트·최근 커밋이 보인다', async ($, on) => {
  const clock = world(on)

  await $.session.start({ cwd: 'C:/work/my-project', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const sources = async () => (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props.source))
  const alts = async () => (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt))

  expect(await sources()).toHaveLength(2)
  expect((await alts())[0]).toContain('비 오는 밤 다락방')
  expect((await sources())[1]).toContain('>24%<') // 5시간 사용량
  expect((await sources())[1]).toContain('>42%<') // 컨텍스트
  expect((await sources())[1]).toContain('84k/200k')
  expect((await sources())[1]).toContain('1h 37m 뒤 리셋')
  expect(await ui.find({ type: 'Text', text: /abc1234/ })).toBeUndefined() // 커밋 로그는 기본으로 접혀 있다
  await ui.press({ key: 'fold:commits' })
  expect((await ui.find({ type: 'Text', text: /abc1234/ }))?.text).toContain('배너 추가')
  expect(await ui.find({ type: 'Text', text: /변경 2개/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /올릴 커밋 1/ }))?.text).toBe('올릴 커밋 1 · 받을 커밋 2')
  await ui.select({ key: 'scene', value: 'dungeon' })
  expect((await alts())[0]).toContain('8비트 던전')
  await ui.select({ key: 'scene', value: 'neon' })
  expect((await alts())[0]).toContain('네온 펑크 성')
  await ui.unmount()
})

test('[기능] 음악: 음량 −/+는 단계를 바꾸고, 켜져 있으면 새 음량으로 다시 켠다', async ($, on) => {
  const clock = world(on)
  const seen: Env[] = []

  fakePlayer(on, clock, seen)
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bars = async () => (await pane.find({ type: 'Text', text: /^[●○]{5}$/ }))?.text

  expect(await bars()).toBe('●●●○○')
  await pane.press({ key: 'volume-up' })
  expect(await bars()).toBe('●●●●○')
  expect(seen).toHaveLength(0) // 꺼져 있으면 재생기를 켜지 않는다
  await pane.press({ key: 'radio' })
  for (let i = 0; i < 4; i++) await pane.press({ key: 'volume-down' }) // 마지막 한 번은 맨 아래라 아무 일도 없다
  expect(await bars()).toBe('●○○○○')
  expect(seen.map(env => env.TAVERN_VOLUME)).toEqual(['0.6', '0.4', '0.25', '0.1'])
  await pane.press({ key: 'radio' })
  await clock.advance(1000)
  await pane.unmount()
})

test('[기능] 빠른 실행: 바뀐 파일이 없으면 커밋은 알려 주기만 하고 실행하지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy, git: { status: '## main\n' } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual([])
  expect(spy.toasts).toContain('커밋할 변경이 없어요')
  expect((await pane.find({ key: 'commit' }))?.props.label).toBe(COMMIT_LABEL) // "한 번 더"로 바뀌지 않는다
  await pane.unmount()
})

test('[기능] 장면 통합: 선택 칸은 장면 하나뿐이고 4개 장면이 모두 들어 있다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const selects = await pane.findAll({ type: 'Select' })

  expect(selects).toHaveLength(1)
  expect(selects[0]?.key).toBe('scene')
  expect((selects[0]?.props.options as { value: string }[]).map(option => option.value)).toEqual(['attic', 'tearoom', 'dungeon', 'neon'])
  await pane.unmount()
})

test('[기능] 장면 통합: 패널에서 고른 장면에서 ⟳가 이어서 돈다(마지막 다음은 처음)', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const title = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  await pane.select({ key: 'scene', value: 'dungeon' })
  await banner.press({ key: 'shuffle' })
  expect(await title()).toContain('네온 펑크 성')
  await banner.press({ key: 'shuffle' })
  expect(await title()).toContain('비 오는 밤 다락방')
  await pane.unmount()
  await banner.unmount()
})
