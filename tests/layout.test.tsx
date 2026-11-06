// [레이아웃] 시험. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { bannerSvg } from '../hooks/banner'
import { USAGE_HEIGHT, usageSvg, usageWidthFor } from '../hooks/usage'
import { SCENES, MODES } from '../hooks/scenes'
import { WARN_COLOR, clipWidth } from '../hooks/svg'
import { TEXT_PRIMARY, chipOf, lift, surfaceOf } from '../hooks/theme'
import { BAND, METAPHOR_NAMES, NOON, PANE, START, contrast, luminance, world } from './kit'

test('[레이아웃] 글자 폭 자르기: 한글은 넓게, 영문은 좁게 센다', async () => {
  expect(clipWidth('abc', 3, 10)).toBe('abc')
  expect(clipWidth('가나다라마바사', 3, 10)).toBe('가나…')
  expect(clipWidth('abcdefghij', 3, 10)).toBe('abcd…')
})

test('[레이아웃] 배너 게이지: 100%여도 기능 이름이 그대로 보이고 비유 이름은 없다', async () => {
  const at = (percentUsed: number) =>
    bannerSvg({
      scene: SCENES.attic,
      usage: { limits: [{ kind: 'five_hour', percentUsed }] } as never,
      git: null,
      model: null,
      effort: null, songTitle: '',
      project: 'p',
      now: NOON,
      radio: 'off',
      isMusicAvailable: true,
      isStill: false,
    })

  for (const percent of [3, 100]) {
    for (const name of ['컨텍스트', '5시간', '주간']) expect(at(percent), `${percent}% ${name}`).toContain(`>${name}<`)
    for (const old of METAPHOR_NAMES) expect(at(percent)).not.toContain(`>${old}<`)
  }
})

test('[레이아웃] 4개 장면의 글자색 대비가 4.5 이상이다', async () => {
  for (const scene of Object.values(SCENES)) {
    expect(contrast(scene.muted, scene.base), `${scene.id} 흐린 글자`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(scene.accent, scene.base), `${scene.id} 강조색`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(WARN_COLOR, scene.base), `${scene.id} 경고색`).toBeGreaterThanOrEqual(4.5)
  }
})

test('[레이아웃] 프로젝트 이름이 길면 배너는 칸 안에서 자르고 패널은 한 줄로 줄인다', async ($, on) => {
  const long = 'a-very-long-project-name-that-keeps-going-2026-11-04-980f42'
  const korean = '아주아주아주긴프로젝트이름이계속됩니다'
  const svg = (project: string) =>
    bannerSvg({ scene: SCENES.attic, usage: null, git: null, model: null, effort: null, songTitle: '', project, now: NOON, radio: 'off', isMusicAvailable: true, isStill: false })

  for (const name of [long, korean]) {
    expect(svg(name)).not.toContain(`>${name}<`)
    expect(svg(name)).toContain('…<')
  }
  const clock = world(on)

  await $.session.start({ ...START, cwd: `C:/work/${long}` })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ type: 'Text', text: long }))?.props.wrap).toBe('truncate-end')
  await pane.unmount()
})

test('[레이아웃] 카드·칩 배경은 바탕보다 밝고, 그 위 글자 대비도 4.5 이상이다', async () => {
  expect(lift('#000000', 0.5)).toBe('#808080')
  expect(lift('#ffffff', 0.3)).toBe('#ffffff')
  for (const scene of Object.values(SCENES)) {
    for (const [name, bg] of [['카드', surfaceOf(scene)], ['칩', chipOf(scene)]] as const) {
      expect(luminance(bg), `${scene.id} ${name}은 바탕보다 밝다`).toBeGreaterThan(luminance(scene.base))
      expect(contrast(scene.muted, bg), `${scene.id} ${name} 위 흐린 글자`).toBeGreaterThanOrEqual(4.5)
      // 강조색은 카드 위에서는 글자(4.5), 칩 위에서는 점(3)으로만 쓴다.
      expect(contrast(scene.accent, bg), `${scene.id} ${name} 위 강조색`).toBeGreaterThanOrEqual(name === '카드' ? 4.5 : 3)
      expect(contrast(TEXT_PRIMARY, bg), `${scene.id} ${name} 위 밝은 글자`).toBeGreaterThanOrEqual(7)
      if (name === '카드') expect(contrast(WARN_COLOR, bg), `${scene.id} 카드 위 경고색`).toBeGreaterThanOrEqual(4.5) // 음악 카드의 "연결 실패"
    }
  }
})

test('[레이아웃] 패널 구역이 정해진 순서로 이름표를 달고 나온다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await pane.findAll({ type: 'Text' })).map(node => node.text)
  const order = ['음악', '빠른 실행', '할 일', '사용량', '작업 현황', '이 채팅에서 만진 파일'].map(title => texts.indexOf(title))

  expect(order.every(index => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order) // 위에서 아래로 이 순서
  await pane.unmount()
})

test('[레이아웃] 만진 파일은 소제목으로 작업 현황 바로 아래에 붙는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const title = async (text: string) => (await pane.find({ type: 'Text', text: new RegExp(`^${text}$`) }))?.props // 숨겨진 설명 글자와 섞이지 않게 정확히
  const headline = await title('작업 현황')
  const sub = await title('이 채팅에서 만진 파일')

  expect(headline?.weight).toBe('semibold')
  expect(headline?.size).toBeUndefined() // 머리글은 본문 크기
  expect(sub?.size).toBe('footnote') // 소제목은 한 단계 작다
  expect(sub?.color).toBe(SCENES.attic.muted) // 강조색이 아니라 흐린 글자
  await pane.unmount()
})

test('[레이아웃] 좁은 패널에서 줄바꿈되는 줄과 긴 파일명 처리', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/p/a-really-long-file-name-that-would-overflow-the-narrow-panel.test.tsx', old_string: 'a', new_string: 'b' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const boxes = await pane.findAll({ type: 'Box' })

  // 음악(상태·조작), git 칩, 숫자 칸: 폭이 모자라면 아래 줄로 내려간다.
  expect(boxes.filter(node => node.props.flexWrap === 'wrap').length).toBeGreaterThanOrEqual(4)
  // 파일 한 줄은 넘치는 부분을 잘라 낸다.
  expect(boxes.filter(node => node.props.overflow === 'hidden')).toHaveLength(1)
  await pane.unmount()
})

test('[레이아웃] 제목 블록: 패널 그림은 296px로 잘려 있고 제목·모토 글자를 그리지 않는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const art = (await pane.findAll({ type: 'Svg' }))[0]

  expect(art?.props.height).toBe(296)
  expect(String(art?.props.source)).not.toContain('비는 오고')
  await pane.unmount()
})

for (const id of MODES.flatMap(mode => mode.scenes)) {
  test(`[레이아웃] 장면 ${id}: 패널과 사용량 원이 기능 이름·테마 이름과 함께 그려진다`, async ($, on) => {
    const mood = { mode: SCENES[id].mode, sceneByMode: { cozy: 'attic', adventure: 'dungeon', [SCENES[id].mode]: id } }
    const clock = world(on, { stored: { mood } })

    await $.session.start(START)
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const svgs = await pane.findAll({ type: 'Svg' })

    expect(String(svgs[0]?.props.alt)).toContain(SCENES[id].title)
    expect(svgs[0]?.props.height).toBe(296)
    expect(String(svgs[1]?.props.source)).toContain('>컨텍스트<')
    for (const name of ['컨텍스트', '5시간 한도', '주간 한도']) expect(String(svgs[1]?.props.source), `${id} ${name}`).toContain(`>${name}<`)
    for (const old of METAPHOR_NAMES) expect(String(svgs[1]?.props.source), `${id} ${old}`).not.toContain(`>${old}<`)
    expect((await pane.find({ type: 'Text', text: SCENES[id].music.label }))?.text).toBe(SCENES[id].music.label)
    await pane.unmount()
  })
}

test('[레이아웃] 사용량 그림 폭은 패널 열 수에 맞추되 기본(340)보다 좁아지지 않고 480을 넘지 않는다', async () => {
  expect(usageWidthFor(40)).toBe(340) // 좁은 패널: 기본 폭(앱이 줄여 그린다)
  expect(usageWidthFor(51)).toBe(387) // 실측한 패널(열 51, 칸 7.7px ≈ 394px)에 맞춘다
  expect(usageWidthFor(200)).toBe(480)
  const wide = usageSvg(SCENES.attic, null, NOON, 387)

  expect(wide).toContain(`viewBox="0 0 387 ${USAGE_HEIGHT}"`)
  expect(wide).toContain('width="387"')
  expect(usageSvg(SCENES.attic, null, NOON)).toContain(`viewBox="0 0 340 ${USAGE_HEIGHT}"`) // 폭을 안 주면 예전과 같다
  // 세 원이 넓어진 폭을 고르게 나눠 쓴다(가운데 원은 한가운데).
  expect(wide).toContain('x="193.5"')
})

test('[레이아웃] 패널 열이 51이면 사용량 그림을 카드 막대를 뺀 380px로 그리고, 숫자 칸의 숫자는 title 크기다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 51 }, surface: 'desktop' })
  const svgs = await pane.findAll({ type: 'Svg' })

  expect(svgs[1]?.props.width).toBe(380) // 패널 51열 − 카드 막대 1열 = 50열
  expect(String(svgs[1]?.props.source)).toContain(`viewBox="0 0 380 ${USAGE_HEIGHT}"`)
  expect(svgs[0]?.props.width).toBe(340) // 그림(픽셀 아트)은 4배 그대로: 선명도를 지킨다
  const texts = await pane.findAll({ type: 'Text' })
  const index = texts.findIndex(node => node.text === '프롬프트')

  expect(texts[index - 1]?.props.size).toBe('title')
  await pane.unmount()
})

test('[레이아웃] 구역 여섯은 모두 같은 카드(밝은 배경 + 왼쪽 강조 막대)이고, 카드 사이는 바탕이 비쳐 보이는 간격이다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await pane.findAll({ type: 'Box' })
  const scene = SCENES.attic
  const cards = all.filter(node => node.props.flexDirection === 'row' && node.props.alignItems === 'stretch' && node.props.backgroundColor === surfaceOf(scene))
  const stripes = all.filter(node => node.props.width === 1 && node.props.backgroundColor === scene.accent)
  const counters = all.filter(node => node.props.flexGrow === 1 && node.props.backgroundColor === chipOf(scene))

  expect(cards).toHaveLength(6) // 음악, 빠른 실행, 할 일, 사용량, 작업 현황, 만진 파일: 하나도 바탕 위에 그냥 놓이지 않는다
  expect(stripes).toHaveLength(6) // 카드마다 강조 막대 하나
  expect(counters).toHaveLength(3) // 숫자 칸은 카드 위에서 보이도록 카드보다 한 단계 더 밝다
  expect(all[0]?.props.backgroundColor).toBe(scene.base) // 맨 바깥은 바탕
  expect(all[0]?.props.gap).toBe('md') // 카드 사이로 바탕이 비쳐 보인다
  await pane.unmount()
})

test('[레이아웃] 음악 첫 줄: 방송 이름이 길면 이름이 잘리고, 상태 글자(다른 채팅에서 재생 중 등)는 줄어들지 않는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await pane.findAll({ type: 'Box' })

  expect((await pane.find({ type: 'Text', text: SCENES.attic.music.label }))?.props.wrap).toBe('truncate-end')
  expect(all.filter(node => node.props.flexShrink === 0)).toHaveLength(1) // 상태 글자 칸 하나
  await pane.unmount()
})
