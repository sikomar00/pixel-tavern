// [터미널] 시험: 터미널 화면(색 블록 그림 Raster, 글자 막대)과 그림 데이터. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { CELLS } from '../hooks/art/cells'
import { SCENE_COLUMNS, SYMBOLS, base64, emblemGrid, halfBlocks, hexToInt, sceneGrid, scenePicture, shrink, shrinkFor } from '../hooks/cells'
import { MODES, SCENES } from '../hooks/scenes'
import { barCells } from '../hooks/usage'
import { BAND, PANE, START, world } from './kit'

const TERMINAL_START = { ...START, surface: 'terminal' } as const
const ids = MODES.flatMap(mode => mode.scenes)
const terminalPane = (columns: number) => ({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' }) as const

test('[터미널] 배너: 엠블럼 색 블록 그림·장면 이름·게이지 셋(글자 막대)·버튼 넷으로 그려지고 Svg는 없다', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start(TERMINAL_START)
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await band.findAll({ type: 'Text' })).map(node => node.text)
  const emblem = await band.find({ type: 'Raster', key: 'emblem' })

  expect(await band.find({ type: 'Svg' })).toBeUndefined()
  expect([emblem?.props.columns, emblem?.props.rows]).toEqual([12, 5]) // 엠블럼 12x10칸 = 글자 칸 12x5
  expect(String(emblem?.props.cells)).toHaveLength(960) // 12*5칸 x 12바이트 = 720바이트의 base64
  for (const text of [SCENES.attic.title, '컨텍스트', '5시간', '주간', '42%', '24%', '7%']) expect(texts, text).toContain(text)
  // 막대는 12칸: 42% → 5칸, 23.5% → 3칸, 7% → 1칸(쓰기 시작했으면 한 칸은 채운다)
  for (const [filled, empty] of [[5, 7], [3, 9], [1, 11]] as const) {
    expect(texts, `채움 ${filled}`).toContain('█'.repeat(filled))
    expect(texts, `빔 ${empty}`).toContain('░'.repeat(empty))
  }
  const buttons = await band.findAll({ type: 'Button' })

  expect(buttons.map(button => [button.key, button.props.label])).toEqual([['music', '▶'], ['panel', '▤'], ['shuffle', '⟳'], ['hide', '✕']])
  await band.unmount()
})

test('[터미널] 배너 버튼: ⟳는 다음 장면, ✕는 한 줄로 숨기고 ▣ 여관으로 되돌리며, ▤는 터미널 크기(30줄·56칸)로 패널을 연다', async ($, on) => {
  const opened: object[] = []
  const clock = world(on, { surfaces: ['terminal'], opened })

  await $.session.start(TERMINAL_START)
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const next = SCENES[ids[1] ?? 'attic']

  await band.press({ key: 'shuffle' })
  expect((await band.find({ type: 'Text', text: next.title }))?.text).toBe(next.title)
  await band.press({ key: 'hide' })
  expect(await band.find({ type: 'Raster' })).toBeUndefined()
  expect((await band.find({ key: 'show' }))?.props.label).toBe('▣ 여관')
  expect((await band.find({ type: 'Text', text: /컨텍스트 42%/ }))?.text).toContain('주간') // 숨겨도 사용량 한 줄은 남는다
  await band.press({ key: 'show' })
  expect(await band.find({ type: 'Raster', key: 'emblem' })).toBeDefined()
  await band.press({ key: 'panel' })
  expect(opened).toEqual([{ id: 'tavern', title: '여관', rows: 30, columns: 56 }])
  await band.unmount()
})

test('[터미널] 프롬프트 위 띠가 다섯 줄보다 낮으면 그림 없이 한 줄 글자 띠로 대신한다(▶ 버튼은 남는다)', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start(TERMINAL_START)
  await clock.settle()
  const low = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 3 }, surface: 'terminal' })

  expect(await low.find({ type: 'Raster' })).toBeUndefined()
  expect((await low.find({ type: 'Text', text: /컨텍스트/ }))?.text).toContain('main')
  expect((await low.find({ type: 'Button' }))?.props.label).toBe('▶')
  await low.unmount()
})

test('[터미널] 패널을 열 때 크기 요청은 터미널이 붙어 있을 때만 보낸다(데스크톱의 패널 크기는 그대로)', async ($, on) => {
  const opened: object[] = []
  const clock = world(on, { opened }) // 데스크톱만

  await $.session.start(START)
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await band.press({ key: 'panel' })
  expect(opened).toEqual([{ id: 'tavern', title: '여관' }])
  await band.unmount()
})

test('[터미널] 패널: 데스크톱과 같은 여섯 구역 차례, 폭에 맞춘 장면 그림(85·43·22칸), 사용량은 글자 막대이고 Svg·움직임 버튼은 없다', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start(TERMINAL_START)
  await clock.settle()
  for (const [columns, width, rows] of [[100, 85, 37], [56, 43, 19], [30, 22, 10]] as const) {
    const pane = await $.ui.mount(terminalPane(columns))
    const picture = await pane.find({ type: 'Raster', key: 'scene' })

    expect([picture?.props.columns, picture?.props.rows], `${columns}열`).toEqual([width, rows])
    expect(await pane.find({ type: 'Svg' })).toBeUndefined()
    expect(await pane.find({ key: 'still' })).toBeUndefined() // 터미널 그림은 늘 정지 그림이다
    await pane.unmount()
  }
  const pane = await $.ui.mount(terminalPane(100))
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)
  const order = ['음악', '빠른 실행', '할 일', '사용량', '작업 현황', '이 채팅에서 만진 파일'].map(title => texts.indexOf(title))

  expect(order.every(index => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order) // 위에서 아래로 이 순서
  for (const text of ['컨텍스트', '5시간 한도', '주간 한도', '42%', '24%', '7%', '84k/200k']) expect(texts, text).toContain(text)
  const boxes = await pane.findAll({ type: 'Box' })

  expect(boxes.filter(node => node.props.width === 1 && node.props.backgroundColor === SCENES.attic.accent)).toHaveLength(6) // 카드마다 막대
  await pane.press({ key: 'fold:art' })
  expect(await pane.find({ type: 'Raster' })).toBeUndefined() // 그림을 접으면 그림이 사라진다
  await pane.press({ key: 'fold:usage' })
  expect((await pane.find({ type: 'Text', text: /컨텍스트 42%/ }))?.text).toContain('주간') // 사용량을 접으면 한 줄 요약
  await pane.unmount()
})

test('[터미널] 패널 버튼: 음악·할 일·방송 바꾸기가 데스크톱과 똑같이 동작한다', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start(TERMINAL_START)
  await clock.settle()
  const pane = await $.ui.mount(terminalPane(100))

  await pane.press({ key: 'picker' })
  expect((await pane.findAll({ type: 'Button' })).some(button => String(button.key).startsWith('station:'))).toBe(true)
  await pane.press({ key: 'station:groovesalad' })
  expect((await pane.find({ type: 'Text', text: /Groove Salad/ }))?.text).toContain('Groove Salad')
  await pane.input({ key: 'todo:new', text: '터미널에서 더함' })
  expect((await pane.find({ type: 'Text', text: '터미널에서 더함' }))?.text).toBe('터미널에서 더함')
  await pane.unmount()
})

test('[터미널] 그림 데이터: 장면 10개 모두 85x74 칸·팔레트 안의 번호·게이지 21단계·엠블럼 12x10이고, 게이지가 차면 그림이 달라진다', async () => {
  expect(SYMBOLS).toHaveLength(89)
  for (const id of ids) {
    const cells = CELLS[id]
    const grid = sceneGrid(cells, 0)

    expect(cells.palette.length, id).toBeLessThanOrEqual(SYMBOLS.length)
    for (const hex of cells.palette) expect(hex, id).toMatch(/^#[0-9a-f]{6}$/)
    expect(grid, id).toHaveLength(74)
    for (const row of cells.rows) expect(row, id).toHaveLength(SCENE_COLUMNS)
    const used = [...new Set([...cells.rows, ...cells.gauge.levels.flat(), ...cells.emblem].join(''))].map(char => SYMBOLS.indexOf(char))

    expect(Math.min(...used), id).toBeGreaterThanOrEqual(0) // 모르는 글자가 없다
    expect(Math.max(...used), id).toBeLessThan(cells.palette.length) // 번호가 팔레트 안에 있다
    expect(cells.gauge.levels, id).toHaveLength(21)
    for (const level of cells.gauge.levels) expect(level.length, id).toBe(cells.gauge.levels[0]?.length)
    expect(emblemGrid(cells), id).toHaveLength(10)
    expect(emblemGrid(cells)[0], id).toHaveLength(12)
    expect(sceneGrid(cells, 100), `${id} 게이지가 가득 차면 달라진다`).not.toEqual(grid)
    expect(sceneGrid(cells, 100), id).toEqual(sceneGrid(cells, 120)) // 100을 넘어도 마지막 단계
    expect(sceneGrid(cells, null), id).toEqual(grid) // 값이 없으면 빈 게이지
    expect(scenePicture(cells, 50, 100, hexToInt(SCENES[id].base)).cells, id).not.toBe(scenePicture(cells, 0, 100, hexToInt(SCENES[id].base)).cells)
  }
})

test('[터미널] 칸 그림 변환: base64, 줄이기(많은 색 · 같으면 밝은 색), 반 칸 블록 묶기(▀: 위는 글자색 · 아래는 배경색), 폭에 맞춘 배율', async () => {
  const text = (value: string) => base64(Uint8Array.from(value, char => char.charCodeAt(0)))

  expect([text('Man'), text('Ma'), text('M'), text('')]).toEqual(['TWFu', 'TWE=', 'TQ==', '']) // 표준 base64(채움 포함)
  // 2x2 한 블록: 셋이 같으면 그 색, 둘씩 갈리면 더 밝은 색
  expect(shrink([[1, 1], [1, 2]], 2, 0)).toEqual([[1]])
  expect(shrink([[0x101010, 0x202020], [0x101010, 0x202020]], 2, 0)).toEqual([[0x202020]])
  expect(shrink([[5, 6, 7]], 2, 9)).toEqual([[6, 7]]) // 가장자리 블록은 있는 칸만 센다(둘씩 갈리면 밝은 6)
  expect(shrink([[1]], 1, 0)).toEqual([[1]])
  // [[a, b], [c, d]] → 글자 칸 둘: (▀, a, c), (▀, b, d), 각 셋은 리틀 엔디언 u32
  const a = 0x112233
  const b = 0x445566
  const c = 0x778899
  const d = 0xaabbcc
  const picture = halfBlocks([[a, b], [c, d]], 0)
  const word = (value: number) => [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255]

  expect([picture.columns, picture.rows]).toEqual([2, 1])
  expect(picture.cells).toBe(base64(Uint8Array.from([0x2580, a, c, 0x2580, b, d].flatMap(word))))
  expect(halfBlocks([[a]], 0x123456).cells).toBe(base64(Uint8Array.from([0x2580, a, 0x123456].flatMap(word)))) // 줄이 홀수면 아래는 fill
  expect([shrinkFor(100), shrinkFor(85), shrinkFor(84), shrinkFor(43), shrinkFor(42), shrinkFor(10)]).toEqual([1, 1, 2, 2, 4, 4])
  expect([barCells(0, 12), barCells(0.5, 12), barCells(42, 12), barCells(99, 12), barCells(100, 12), barCells(150, 12)]).toEqual([0, 1, 5, 11, 12, 12])
})
