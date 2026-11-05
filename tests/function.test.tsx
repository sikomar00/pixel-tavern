// [기능] 시험. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { SCENES, STATIONS } from '../hooks/scenes'
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

test('[기능] 장면 통합: 장면 선택 칸은 하나뿐이고(방송 고르기는 음악 구역에 따로) 4개 장면이 모두 들어 있다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const selects = await pane.findAll({ type: 'Select' })

  const scenes = selects.filter(select => select.key === 'scene')

  expect(selects.map(select => select.key).sort()).toEqual(['scene', 'station']) // 모드 선택 같은 칸은 없고, 방송 고르기만 더 있다
  expect(scenes).toHaveLength(1)
  expect((scenes[0]?.props.options as { value: string }[]).map(option => option.value)).toEqual(['attic', 'tearoom', 'dungeon', 'neon'])
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

type Options = { value: string; label: string }[]

/** 고르는 칸의 기대 순서: 즐겨찾기(목록 순서)가 위, 나머지(목록 순서)가 아래. 방송 목록이 늘어도 맞는다. */
const expectedOrder = (stars: string[]): string[] => [...STATIONS.filter(station => stars.includes(station.id)), ...STATIONS.filter(station => !stars.includes(station.id))].map(station => station.id)

const optionsOf = async (pane: { find: (q: object) => Promise<{ props: Record<string, unknown> } | undefined> }): Promise<Options> => ((await pane.find({ key: 'station' }))?.props.options ?? []) as Options

// 사용자가 승인한 방송 서버. 목록에 새 서버가 몰래 들어오지 않게 하는 울타리다(새 방송을 더하면 사용자에게 보여 주고 승인받은 뒤 여기에도 적는다).
const APPROVED_HOSTS = ['listen.reyfm.de', 'cast.oldpopcafe.net', 'stream.kaaosradio.fi', 'stream.nightride.fm', 'ice1.somafm.com', 'stream.srg-ssr.ch', 'radio.vgmradio.com', 'radio-paralax.de']

test('[기능] 방송 목록: 주소는 모두 http이고 승인한 서버뿐이며, 이름표·이름·주소가 겹치지 않고, 모든 장면의 기본 방송이 목록에 있다', async () => {
  expect(STATIONS).toHaveLength(16) // 장면의 기본 4곳 + 승인받은 12곳
  for (const station of STATIONS) expect(APPROVED_HOSTS, station.id).toContain(new URL(station.stream).hostname)
  for (const station of STATIONS) {
    expect(station.stream, station.id).toMatch(/^http:\/\//) // Windows 재생기는 https를 못 연다
    expect(station.id, station.id).toMatch(/^[a-z0-9]+$/)
    expect(station.label.trim(), station.id).not.toBe('')
  }
  for (const field of ['id', 'label', 'stream'] as const) expect(new Set(STATIONS.map(station => station[field])).size, field).toBe(STATIONS.length)
  for (const scene of Object.values(SCENES)) expect(STATIONS, scene.id).toContain(scene.music)
})

test('[기능] 방송 고르기: 장면마다 따로 고르고 기억하며, 켜져 있으면 새 방송으로 다시 켜고, 꺼져 있으면 켜지 않는다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const seen: Env[] = []
  const clock = world(on, { liveStore: store })
  const url = (id: string) => STATIONS.find(station => station.id === id)?.stream

  fakePlayer(on, clock, seen)
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const value = async () => (await pane.find({ key: 'station' }))?.props.value
  const note = async () => String((await banner.find({ type: 'Svg' }))?.props.source)

  expect(await value()).toBe('reyfm') // 다락방의 기본 방송
  await pane.select({ key: 'station', value: 'kaaos' }) // 꺼져 있을 때 고르기: 켜지지는 않는다
  expect(seen).toHaveLength(0)
  expect(await value()).toBe('kaaos')
  expect(await note()).not.toContain('♪')
  expect(store.stationChoices).toEqual({ attic: 'kaaos' })
  await banner.press({ key: 'music' })
  expect(seen.map(env => env.TAVERN_URL)).toEqual([url('kaaos')])
  expect(await note()).toContain('♪ Kaaos 칩튠 라디오') // 배너도 고른 방송을 보인다
  await pane.select({ key: 'station', value: 'nightride' }) // 켜져 있을 때 고르기: 새 방송으로 다시 켠다
  expect(seen.map(env => env.TAVERN_URL)).toEqual([url('kaaos'), url('nightride')])
  expect(await note()).toContain('♪ Nightride FM 신스웨이브')
  await pane.select({ key: 'station', value: 'nightride' }) // 같은 방송을 또 고르면 아무 일도 없다
  expect(seen).toHaveLength(2)
  await banner.press({ key: 'shuffle' }) // 7080 다방: 고른 적이 없으니 기본 방송
  expect(await value()).toBe('oldpop')
  expect(seen[2]?.TAVERN_URL).toBe(url('oldpop'))
  await banner.press({ key: 'shuffle' })
  await banner.press({ key: 'shuffle' })
  await banner.press({ key: 'shuffle' }) // 한 바퀴 돌아 다락방: 고른 방송이 그대로
  expect(await value()).toBe('nightride')
  expect(seen[seen.length - 1]?.TAVERN_URL).toBe(url('nightride'))
  expect(store.stationChoices).toEqual({ attic: 'nightride' }) // 다른 장면은 고르지 않았으니 기록이 없다
  await banner.press({ key: 'music' })
  await clock.advance(1000)
  await pane.unmount()
  await banner.unmount()
})

test('[기능] 방송 고르기: 저장된 선택은 다음 세션에도 이어지고, 알 수 없는 방송·장면이나 모양이 틀린 값은 버린다(다시 저장할 때도 남지 않는다)', async ($, on) => {
  const store: Record<string, unknown> = { stationChoices: { attic: 'kaaos', tearoom: 'nope', ghost: 'kaaos' }, favoriteStations: ['kaaos', 'nope', 'kaaos', 7] }
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'station' }))?.props.value).toBe('kaaos') // 다락방에서 고른 방송이 이어진다
  expect((await pane.find({ key: 'favorite' }))?.props.label).toBe('★ 즐겨찾기')
  expect((await optionsOf(pane)).map(option => option.value)).toEqual(expectedOrder(['kaaos'])) // 즐겨찾기(중복·모르는 방송은 버림)가 맨 위
  expect((await optionsOf(pane))[0]?.value).toBe('kaaos')
  await pane.select({ key: 'scene', value: 'tearoom' })
  expect((await pane.find({ key: 'station' }))?.props.value).toBe('oldpop') // 모르는 방송이 저장돼 있어도 기본 방송으로
  await pane.select({ key: 'scene', value: 'attic' })
  await pane.select({ key: 'station', value: 'reyfm' })
  expect(store.stationChoices).toEqual({ attic: 'reyfm' }) // 다시 저장할 때 알 수 없는 장면·방송은 따라오지 않는다
  await pane.press({ key: 'favorite' })
  expect(store.favoriteStations).toEqual(['kaaos', 'reyfm']) // 모르는 방송과 중복도 정리돼 저장된다
  await pane.unmount()
})

test('[기능] 방송 고르기: 모양이 완전히 틀린 저장값은 기본 방송으로 읽는다', async ($, on) => {
  const clock = world(on, { stored: { stationChoices: 'garbage', favoriteStations: { a: 1 } } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'station' }))?.props.value).toBe('reyfm')
  expect((await pane.find({ key: 'favorite' }))?.props.label).toBe('☆ 즐겨찾기')
  await pane.unmount()
})

test('[기능] 즐겨찾기: 별로 켜고 끄며, 고르는 칸의 맨 위에 ★와 함께 놓이고, 저장되며, 거의 동시에 두 번 눌러도 한 번이 사라지지 않는다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await pane.find({ key: 'favorite' }))?.props.label
  const order = async () => (await optionsOf(pane)).map(option => option.value)

  expect(await label()).toBe('☆ 즐겨찾기')
  expect((await optionsOf(pane)).find(option => option.value === 'reyfm')?.label).toBe('REYFM 로파이 · 기본') // 이 장면(다락방)의 기본 방송 표시
  await pane.press({ key: 'favorite' })
  expect(await label()).toBe('★ 즐겨찾기')
  expect(store.favoriteStations).toEqual(['reyfm'])
  await pane.select({ key: 'station', value: 'nightride' })
  expect((await optionsOf(pane)).find(option => option.value === 'reyfm')?.label).toBe('★ REYFM 로파이 · 기본') // 고른 방송이 바뀌어도 기본 표시는 장면의 방송에 붙어 있다
  await pane.press({ key: 'favorite' })
  expect(store.favoriteStations).toEqual(['reyfm', 'nightride'])
  expect(await order()).toEqual(expectedOrder(['reyfm', 'nightride'])) // 즐겨찾기가 위(목록 순서대로), 나머지는 그 아래
  expect((await order()).slice(0, 2)).toEqual(['reyfm', 'nightride'])
  expect((await optionsOf(pane)).map(option => option.label.startsWith('★ '))).toEqual(STATIONS.map((_, index) => index < 2))
  await pane.press({ key: 'favorite' }) // 지금 방송(nightride)의 별을 끈다
  expect(store.favoriteStations).toEqual(['reyfm'])
  expect(await label()).toBe('☆ 즐겨찾기')
  await Promise.all([pane.press({ key: 'favorite' }), pane.press({ key: 'favorite' })]) // 거의 동시에 두 번: 켰다가 끈다
  expect(store.favoriteStations).toEqual(['reyfm'])
  expect(await label()).toBe('☆ 즐겨찾기')
  await pane.unmount()
})

test('[기능] 방송 고르기: 연결 실패 표시가 남아 있을 때 다른 방송을 고르면 그 표시는 지워지고 멈춤이 된다', async ($, on) => {
  const clock = world(on)

  on('process.spawn', async function* () {
    yield { stream: 'stdout', text: 'connecting\n' }
    yield { stream: 'stdout', text: 'gaveup\n' } // 옛 방송에 연결하지 못하고 포기
  })
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await banner.press({ key: 'music' })
  expect(await pane.find({ type: 'Text', text: /✕ 연결 실패/ })).toBeDefined()
  await pane.select({ key: 'station', value: 'kaaos' })
  expect(await pane.find({ type: 'Text', text: /✕ 연결 실패/ })).toBeUndefined() // 새로 고른 방송에 옛 실패가 붙어 있지 않다
  expect(await pane.find({ type: 'Text', text: /○ 멈춤/ })).toBeDefined()
  await pane.unmount()
  await banner.unmount()
})
