// [상태] 시험. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { MODES, SCENES } from '../hooks/scenes'
import { ARMED_LABEL, BAND, COMMIT_LABEL, PANE, START, fakePlayer, newSpy, world } from './kit'
import type { Env } from './kit'

test('[상태] 빠른 실행: 커밋은 두 번 눌러야 실행된다', async ($, on) => {
  const spy = newSpy()
  const { ran } = spy
  const clock = world(on, { spy })

  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await ui.press({ key: 'review' })
  expect(ran).toEqual(['code-review'])
  await ui.press({ key: 'commit' })
  expect(ran).toEqual(['code-review'])
  expect((await ui.find({ key: 'commit' }))?.props.label).toBe(ARMED_LABEL)
  await ui.press({ key: 'commit' })
  expect(ran).toEqual(['code-review', 'commit-commands:commit'])
  expect((await ui.find({ key: 'commit' }))?.props.label).toBe(COMMIT_LABEL)
  await ui.unmount()
})

test('[상태] 음악: ▶는 이 장면의 방송을 켜고 ■는 끈다. 장면을 바꾸면 방송도 바뀐다', async ($, on) => {
  const clock = world(on)
  const urls: string[] = []

  // 재생기 프로세스 대신: 연결 → 재생 신호를 보내고, 반 초마다 "."을 쓴다.
  on('process.spawn', async function* (_, e) {
    urls.push(String(e.env?.TAVERN_URL))
    yield { stream: 'stdout', text: 'connecting\n' }
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  for (const id of MODES.flatMap(mode => mode.scenes)) {
    expect(SCENES[id].music.stream, id).toMatch(/^http:\/\//) // Windows 재생기는 https를 못 연다
  }
  await $.session.start({ cwd: 'C:/work/p', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const icon = async () => (await banner.find({ type: 'Button' }))?.props.label
  const paneButtons = async () => (await pane.findAll({ type: 'Button' })).map(b => b.props.label)

  expect(await icon()).toBe('▶')
  expect(await paneButtons()).toContain('▶ 재생')
  await banner.press({ key: 'music' })
  expect(await icon()).toBe('■')
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).toContain(`♪ ${SCENES.attic.music.label}`)
  expect(await paneButtons()).toContain('■ 정지')
  expect(await pane.find({ type: 'Text', text: /● 재생 중/ })).toBeDefined()
  expect(urls).toEqual([SCENES.attic.music.stream])
  await banner.press({ key: 'shuffle' })
  expect(urls).toEqual([SCENES.attic.music.stream, SCENES.tearoom.music.stream])
  expect(await icon()).toBe('■')
  await banner.press({ key: 'music' })
  expect(await icon()).toBe('▶')
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).not.toContain('♪')
  await clock.advance(1000) // 옛 재생기들이 정지 신호를 보고 끝난다
  expect(await icon()).toBe('▶')
  expect(urls).toHaveLength(2)
  await banner.unmount()
  await pane.unmount()
})

for (const [saved, shown] of [
  [5, '●●●●●'],
  [9, '●●●○○'], // 범위 밖 값은 버린다
] as const) {
  test(`[상태] 음량: 저장된 ${saved}은 ${shown}로 보인다`, async ($, on) => {
    const clock = world(on, { stored: { volume: saved } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await pane.find({ type: 'Text', text: /^[●○]{5}$/ }))?.text).toBe(shown)
    await pane.unmount()
  })
}

test('[상태] 음악: 30초가 지나도 연결 중이면 알려 준다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  const slow = () => spy.toasts.filter(text => text.includes('아직 연결하지 못했어요'))

  fakePlayer(on, clock, [], true)
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await banner.press({ key: 'music' })
  await clock.advance(29_000)
  expect(slow()).toHaveLength(0)
  await clock.advance(2_000)
  expect(slow()).toHaveLength(1)
  await banner.press({ key: 'music' })
  await clock.advance(1000)
  await banner.unmount()
})

test('[상태] 커밋 첫 클릭은 대기 상태를 보이고, 5초가 지나면 처음으로 돌아간다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'commit' }))?.props.label
  const waiting = async () => (await pane.find({ type: 'Text', text: /5초 안에 한 번 더 누르면 변경을 커밋해요/ })) !== undefined

  await pane.press({ key: 'commit' })
  expect(await label()).toBe(ARMED_LABEL)
  expect(await waiting()).toBe(true)
  await clock.advance(4_000)
  expect(await label()).toBe(ARMED_LABEL)
  await clock.advance(2_000)
  expect(await label()).toBe(COMMIT_LABEL)
  expect(await waiting()).toBe(false)
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' }) // 초기화된 뒤에는 다시 두 번 눌러야 한다
  expect(spy.ran).toEqual([])
  await pane.press({ key: 'commit' })
  expect(spy.ran).toEqual(['commit-commands:commit'])
  await pane.unmount()
})

test('[상태] 실행 직후 다시 대기시켜도 예전 타이머가 대기를 일찍 끝내지 않는다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'commit' }))?.props.label

  await pane.press({ key: 'commit' }) // 0초: 대기(5초 타이머 시작)
  await pane.press({ key: 'commit' }) // 실행
  await clock.advance(4_000)
  await pane.press({ key: 'commit' }) // 4초: 다시 대기(9초까지)
  await clock.advance(2_000) // 6초: 첫 타이머의 5초가 지났다
  expect(await label()).toBe(ARMED_LABEL)
  await clock.advance(4_000) // 10초
  expect(await label()).toBe(COMMIT_LABEL)
  expect(spy.ran).toEqual(['commit-commands:commit'])
  await pane.unmount()
})

test('[상태] 대기 중인 커밋 버튼을 연달아 눌러도 커밋은 한 번만 실행된다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'commit' })
  await Promise.all([pane.press({ key: 'commit' }), pane.press({ key: 'commit' }), pane.press({ key: 'commit' })])
  expect(spy.ran.filter(command => command === 'commit-commands:commit').length).toBeLessThanOrEqual(1)
  await pane.unmount()
})

test('[상태] 음악: 재생기를 켜지 못하면 연결 실패로 보이고, ▶로 다시 시도한다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  const seen: Env[] = []

  // eslint-disable-next-line require-yield
  on('process.spawn', async function* () {
    throw new Error('spawn failed')
  })
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text

  expect(await status()).toBe('○ 멈춤')
  await banner.press({ key: 'music' })
  expect(await status()).toBe('✕ 연결 실패')
  expect(await pane.find({ type: 'Text', text: /Windows에서만/ })).toBeDefined() // 이유가 한 줄 붙는다
  expect((await pane.find({ key: 'radio' }))?.props.label).toBe('▶ 다시 시도')
  expect((await banner.find({ key: 'music' }))?.props.label).toBe('▶') // 배너 버튼도 다시 누를 수 있다
  expect(spy.toasts.some(text => text.includes('음악을 켜지 못했어요'))).toBe(true)
  expect(seen).toHaveLength(0)
  await pane.unmount()
  await banner.unmount()
})

test('[상태] 음악: 재생기가 저절로 끝나면 연결 실패, 새 시도는 실패 표시를 지운다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })
  let attempts = 0

  on('process.spawn', async function* () {
    attempts += 1
    yield { stream: 'stdout', text: 'connecting\n' }
    if (attempts === 1) return { value: { code: 0, signal: null } } // 첫 시도: 재생기가 곧바로 끝난다
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text

  await pane.press({ key: 'radio' })
  await clock.settle()
  expect(await status()).toBe('✕ 연결 실패')
  expect(spy.toasts.some(text => text.includes('음악 연결 실패'))).toBe(true)
  await pane.press({ key: 'radio' }) // 다시 시도
  expect(await status()).toBe('● 재생 중')
  expect(await pane.find({ type: 'Text', text: /재생기가 멈췄어요/ })).toBeUndefined() // 옛 실패 이유는 지워진다
  await pane.press({ key: 'radio' })
  await clock.advance(1000)
  await pane.unmount()
})

test('[상태] 음악: 실패한 뒤에는 장면을 바꾸면 표시가 지워지고, 음량을 바꿔도 저절로 다시 켜지 않는다', async ($, on) => {
  const clock = world(on)
  let spawns = 0

  // eslint-disable-next-line require-yield
  on('process.spawn', async function* () {
    spawns += 1
    throw new Error('nope')
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text

  await pane.press({ key: 'radio' })
  expect(await status()).toBe('✕ 연결 실패')
  expect(spawns).toBe(1)
  await pane.press({ key: 'volume-up' })
  expect(spawns).toBe(1) // 켜져 있을 때만 새 음량으로 다시 켠다
  await pane.select({ key: 'scene', value: 'dungeon' })
  expect(await status()).toBe('○ 멈춤')
  expect(spawns).toBe(1)
  await pane.unmount()
})

test('[상태] 음악: 다른 채팅이 가져가면 연결 실패가 아니라 "다른 채팅에서 재생 중"으로 보이고, 여기서 다시 켤 수 있다', async ($, on) => {
  const spy = newSpy()
  const store: Record<string, unknown> = {} // 채팅끼리 공유되는 저장소 역할
  const clock = world(on, { spy, liveStore: store })
  const kills = new Set<number>()
  let spawns = 0

  on('process.spawn', async function* () {
    const mine = (spawns += 1)

    yield { stream: 'stdout', text: 'connecting\n' }
    yield { stream: 'stdout', text: 'playing\n' }
    for (;;) {
      await clock.sleep(500)
      if (kills.has(mine)) return { value: { code: 1, signal: null } } // 다른 채팅의 재생기가 이 재생기를 껐다
      yield { stream: 'stdout', text: '.\n' }
    }
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const status = async () => (await pane.find({ type: 'Text', text: /^(○ 멈춤|◌ 연결 중…|● 재생 중|✕ 연결 실패|◇ 다른 채팅에서 재생 중)$/ }))?.text
  const takeOver = async (spawn: number) => {
    store.radioOwner = 'another-chat' // 다른 채팅이 음악을 켜며 저장소에 남기는 표시
    kills.add(spawn)
    await clock.advance(1000)
  }

  await pane.press({ key: 'radio' })
  expect(await status()).toBe('● 재생 중')
  await takeOver(1)
  expect(await status()).toBe('◇ 다른 채팅에서 재생 중')
  expect((await pane.find({ key: 'radio' }))?.props.label).toBe('▶ 여기서 켜기')
  expect((await banner.find({ key: 'music' }))?.props.label).toBe('▶')
  expect(spy.toasts.some(text => text.includes('다른 채팅에서 음악을 켜서'))).toBe(true)
  expect(spy.toasts.some(text => text.includes('연결 실패'))).toBe(false) // 실패로 알리지 않는다
  await pane.press({ key: 'radio' }) // 여기서 다시 켠다
  expect(await status()).toBe('● 재생 중')
  expect(typeof store.radioOwner).toBe('string') // 다시 켤 때 소유 표시를 내 이름표로 되돌린다
  expect(store.radioOwner).not.toBe('another-chat')
  await takeOver(2)
  expect(await status()).toBe('◇ 다른 채팅에서 재생 중')
  await pane.select({ key: 'scene', value: 'dungeon' }) // 장면을 바꾸면 옛 표시는 지워지고, 저절로 켜지지도 않는다
  expect(await status()).toBe('○ 멈춤')
  expect(spawns).toBe(2)
  await pane.unmount()
  await banner.unmount()
})

test('[상태] 구역을 접으면 머리글 한 줄과 요약만 남고, 편 상태로 되돌리면 본문이 돌아오며, 상태는 저장된다', async ($, on) => {
  const store: Record<string, unknown> = { collapsed: ['art', 'usage', 'status', 'files', 'music'] } // 이전에 접어 둔 상태
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svgs = async () => (await pane.findAll({ type: 'Svg' })).length
  const has = async (text: string | RegExp) => (await pane.find({ type: 'Text', text })) !== undefined

  expect(await svgs()).toBe(0) // 그림도 사용량도 접혀 있다
  expect(await pane.find({ key: 'radio' })).toBeUndefined()
  for (const title of ['사용량', '작업 현황', '이 채팅에서 만진 파일', '음악']) expect(await has(new RegExp(`^${title}$`)), title).toBe(true) // 머리글은 남는다
  expect(await has('컨텍스트 42% · 5시간 24% · 주간 7%')).toBe(true)
  expect(await has('p · main +2')).toBe(true)
  expect(await has('이 채팅 0개')).toBe(true)
  expect(await has('○ 멈춤')).toBe(true) // 음악의 한 줄 요약
  expect(await has(/^오늘 누적$/)).toBe(false)
  await pane.press({ key: 'fold:usage' })
  expect(await svgs()).toBe(1)
  expect(store.collapsed).toEqual(['art', 'status', 'files', 'music']) // 저장소에 남는다
  await pane.press({ key: 'fold:art' })
  expect(await svgs()).toBe(2)
  await pane.press({ key: 'fold:music' })
  expect(await pane.find({ key: 'radio' })).toBeDefined()
  expect(store.collapsed).toEqual(['status', 'files'])
  await pane.unmount()
})
