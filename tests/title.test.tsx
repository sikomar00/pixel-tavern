// [곡 제목] 시험: 지금 나오는 곡의 제목을 읽어 화면에 보인다(저장하지 않는다). 공용 도우미는 ./kit.tsx 에 있다.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { STATIONS } from '../hooks/scenes'
import { TITLE_SCRIPT, parseTitle, titleLine } from '../hooks/title'
import { BAND, PANE, START, fakePlayer, world } from './kit'
import type { Env, TitleFake } from './kit'

const streamOf = (id: string) => STATIONS.find(station => station.id === id)?.stream

test('[곡 제목] 스크립트의 출력 읽기: 한글·악센트가 그대로, 제어 문자는 빼고 공백은 하나로, 80글자를 넘으면 자르고, 제목 줄이 없으면 null', async () => {
  expect(parseTitle(titleLine('Artist - Song'))).toBe('Artist - Song')
  expect(parseTitle(`warning\r\n${titleLine('한글 제목 · Café – ☆')}\r\n`)).toBe('한글 제목 · Café – ☆')
  expect(parseTitle(titleLine('A\u0000\n  B\t C'))).toBe('A B C')
  expect(parseTitle(titleLine('가'.repeat(200)))).toBe(`${'가'.repeat(79)}…`)
  expect(parseTitle('title:')).toBe('') // 제목 칸은 있는데 비어 있다
  expect(parseTitle('title:65,x,-1,70000,66')).toBe('AB') // 숫자가 아니거나 범위 밖인 것은 버린다
  expect(parseTitle('')).toBeNull()
  expect(parseTitle('아무 글')).toBeNull()
})

test('[곡 제목] 조회 스크립트의 안전 조건: http만, 소켓 제한 시간, 재생기 표식 없음, 파일·프로세스·실행 명령 없음', async () => {
  expect(TITLE_SCRIPT).toContain("'http'") // http가 아니면 거부
  expect(TITLE_SCRIPT).toContain('Icy-MetaData: 1')
  expect(TITLE_SCRIPT).toContain('ReceiveTimeout')
  expect(TITLE_SCRIPT).toContain('pixel-tavern-title')
  expect(TITLE_SCRIPT).not.toContain('pixel-tavern-radio') // 새 재생기가 "다른 재생기를 끄는" 검사에 이 조회가 걸리지 않는다
  for (const word of ['Stop-Process', 'Start-Process', 'Invoke-Expression', 'iex ', 'Invoke-WebRequest', 'Set-Content', 'Out-File', 'Remove-Item', 'Get-Content']) expect(TITLE_SCRIPT, word).not.toContain(word)
})

const playing = async ($: Engine, on: Parameters<typeof mock.clock>[0], titles: TitleFake, store: Record<string, unknown> = {}) => {
  const seen: Env[] = []
  const clock = world(on, { titles, liveStore: store })

  fakePlayer(on, clock, seen)
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  return { clock, banner, pane }
}

test('[곡 제목] 소리가 나오면 3초 뒤 처음 읽고 60초마다 다시 읽어 배너와 음악 카드에 보이고, 못 읽으면 앞 제목을 두며, 제목을 안 보내는 방송이면 지우고, 끄면 지운다', async ($, on) => {
  const titles: TitleFake = {
    urls: [],
    outputs: [{ stdout: titleLine('Artist - Song') }, { stdout: titleLine('한글 제목 · Café') }, { stdout: '', exitCode: 1 }, { stdout: '' }],
  }
  const { clock, banner, pane } = await playing($, on, titles)
  const svg = async () => String((await banner.find({ type: 'Svg' }))?.props.source)
  const line = async () => (await pane.find({ type: 'Text', text: /^♪ / }))?.text

  expect(titles.urls).toHaveLength(0) // 켜지 않았으니 조회하지 않는다
  await banner.press({ key: 'music' })
  await clock.advance(2_000)
  expect(titles.urls).toHaveLength(0) // 소리가 나온 뒤 3초는 기다린다
  expect(await svg()).toContain('♪ REYFM 로파이') // 제목을 모르면 방송 이름
  await clock.advance(1_500)
  expect(titles.urls).toEqual([streamOf('reyfm')]) // 지금 방송의 주소로
  expect(await svg()).toContain('♪ Artist - Song')
  expect(await line()).toBe('♪ Artist - Song')
  await clock.advance(30_000)
  expect(titles.urls).toHaveLength(1) // 60초가 되기 전에는 다시 읽지 않는다
  expect(await line()).toBe('♪ Artist - Song')
  await clock.advance(30_000)
  expect(await line()).toBe('♪ 한글 제목 · Café')
  await clock.advance(60_000) // 조회가 실패했다: 앞 제목을 그대로 둔다
  expect(titles.urls).toHaveLength(3)
  expect(await line()).toBe('♪ 한글 제목 · Café')
  await clock.advance(60_000) // 제목을 보내지 않는 방송: 지운다
  expect(await line()).toBeUndefined()
  expect(await svg()).toContain('♪ REYFM 로파이')
  await banner.press({ key: 'music' }) // 끈다
  await clock.advance(120_000)
  expect(titles.urls).toHaveLength(4) // 끈 뒤에는 조회하지 않는다
  expect(await line()).toBeUndefined()
  await banner.unmount()
  await pane.unmount()
})

test('[곡 제목] 방송을 바꾸면 제목이 바로 지워지고, 새 방송의 주소로 다시 읽으며, 제목은 저장소에 쓰지 않고 이상한 글자는 정리해서 보인다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const titles: TitleFake = { urls: [], outputs: [{ stdout: titleLine('Secret Song\u0000\n  Name') }, { stdout: titleLine('Second Song') }] }
  const { clock, banner, pane } = await playing($, on, titles, store)
  const line = async () => (await pane.find({ type: 'Text', text: /^♪ / }))?.text

  await banner.press({ key: 'music' })
  await clock.advance(3_500)
  expect(await line()).toBe('♪ Secret Song Name') // 제어 문자는 빼고 공백은 하나로
  await pane.press({ key: 'picker' })
  await pane.press({ key: 'group:synth' })
  await pane.press({ key: 'station:nightride' }) // 켜져 있으니 새 방송으로 다시 켠다
  expect(await line()).toBeUndefined() // 옛 제목은 바로 지워진다
  await clock.advance(3_500)
  expect(titles.urls).toEqual([streamOf('reyfm'), streamOf('nightride')])
  expect(await line()).toBe('♪ Second Song')
  expect(JSON.stringify(store)).not.toContain('Song') // 곡 제목은 어디에도 저장하지 않는다
  await banner.press({ key: 'music' })
  await banner.unmount()
  await pane.unmount()
})
