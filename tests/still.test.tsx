// [움직임 끄기·효과 강도·밝기] 시험(R-07, F-25). 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { ART, composeScene } from '../hooks/art'
import { CELLS } from '../hooks/art/cells'
import { scenePicture } from '../hooks/cells'
import { shadeColor } from '../hooks/effects'
import { SCENES } from '../hooks/scenes'
import { motionSvg, stillSvg } from '../hooks/still'
import { BAND, PANE, START, world } from './kit'

const SAMPLE =
  '<svg>' +
  '<rect x="1" fill="#fff"><animate attributeName="opacity" values="1;0.15;1" dur="3s" begin="-1s" calcMode="discrete" repeatCount="indefinite"/></rect>' + // 깜박임: 속성이 없다
  '<g opacity="0"><animate attributeName="opacity" values="1;0" dur="1s" begin="-0.2s"/><path d="M0 0h1v1z"/></g>' + // 프레임 0: 보이게
  '<g opacity="0"><animate attributeName="opacity" values="0;1" dur="1s" begin="-0.2s"/><path d="M1 1h1v1z"/></g>' + // 프레임 1: 숨긴 채
  '<g><animateTransform attributeName="transform" type="translate" values="3 4;0 8" dur="1s"/><rect/></g>' + // 이동: 처음 자리
  '<ellipse fill-opacity=".1"><animate attributeName="fill-opacity" values=".2;.1" dur="2s"/></ellipse>' + // 불빛: 이미 있는 속성을 바꾼다
  '</svg>'

const STILL =
  '<svg><rect x="1" fill="#fff" opacity="1"></rect><g opacity="1"><path d="M0 0h1v1z"/></g><g opacity="0"><path d="M1 1h1v1z"/></g>' +
  '<g transform="translate(3 4)"><rect/></g><ellipse fill-opacity=".2"></ellipse></svg>'

const TAG = /<(\/?)([A-Za-z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g

/** SVG 모양의 문제를 모아 돌려준다(없으면 빈 목록): 같은 속성이 두 번 나옴, 닫는 태그가 안 맞음, 읽지 못한 `<`. */
const problemsOf = (svg: string): string[] => {
  const body = svg.replace(/<!--.*?-->/g, '')
  const tags = [...body.matchAll(TAG)]
  const open: string[] = []
  const problems: string[] = []

  for (const [, closing, name = '', attrs = '', selfClosing] of tags) {
    const names = [...attrs.matchAll(/([\w:-]+)="/g)].map(found => found[1])

    if (new Set(names).size !== names.length) problems.push(`같은 속성이 두 번: <${name}${attrs}>`)
    if (selfClosing === '/') continue
    if (closing === '/') {
      if (open.pop() !== name) problems.push(`닫는 태그가 안 맞음: </${name}>`)
    } else open.push(name)
  }
  if (open.length > 0) problems.push(`안 닫힌 태그: ${open.join(',')}`)
  if (body.split('<').length - 1 !== tags.length) problems.push('읽지 못한 <가 있음')

  return problems
}

const count = (svg: string, pattern: RegExp): number => (svg.match(pattern) ?? []).length

test('[움직임 끄기] 깜박임·프레임·이동·불빛 네 가지 모양을 첫 상태로 굳히고 움직임 태그를 지운다', async () => {
  expect(stillSvg(SAMPLE, true)).toBe(STILL)
  expect(stillSvg(SAMPLE, false)).toBe(SAMPLE) // 끄지 않으면 그대로
  expect(stillSvg(STILL, true)).toBe(STILL) // 한 번 더 해도 같다
  expect(problemsOf(SAMPLE)).toEqual([]) // 모양 검사기가 멀쩡한 그림을 문제로 보지 않는다
  expect(problemsOf('<svg><g opacity="0" opacity="1"></g></svg>')).toHaveLength(1) // 검사기가 같은 속성 두 번을 잡아낸다
})

test('[움직임 끄기] 값이 없는 움직임 태그는 그냥 지우고, 이동 종류를 안 쓰면 translate로 본다', async () => {
  expect(stillSvg('<g opacity=".5"><animate attributeName="opacity" from="1" to="0" dur="1s"/></g>', true)).toBe('<g opacity=".5"></g>')
  expect(stillSvg('<g><animateTransform attributeName="transform" values="2 3;0 0" dur="1s"/></g>', true)).toBe('<g transform="translate(2 3)"></g>')
})

test('[움직임 끄기] 진짜 그림 전부(모든 장면의 배너 띠·패널 그림·게이지 단계): 움직임이 남지 않고, 모양이 멀쩡하고, 프레임은 첫 장만 보인다', async () => {
  for (const [id, art] of Object.entries(ART)) {
    const pictures = [art.strip, ...[null, 0, 5, 42, 100].map(percent => composeScene(art, percent))]

    for (const moving of pictures) {
      const still = stillSvg(moving, true)
      const firsts = [...moving.matchAll(/<g(?: opacity="0")?><animate attributeName="opacity" values="([^"]*)"/g)].map(found => found[1]?.split(';')[0])

      expect(count(moving, /<animate/g), `${id}: 움직이는 그림이어야 시험이 뜻이 있다`).toBeGreaterThan(0)
      expect(problemsOf(moving), `${id}: 원본 모양`).toEqual([])
      expect(count(still, /<animate/g), `${id}: 남은 움직임`).toBe(0)
      expect(problemsOf(still), `${id}: 정지 그림 모양`).toEqual([])
      expect(count(still, /<g opacity="1">/g), `${id}: 첫 프레임만 보인다`).toBe(firsts.filter(value => value === '1').length)
      expect(count(still, /<g opacity="0">/g), `${id}: 나머지 프레임은 숨는다`).toBe(firsts.filter(value => value === '0').length)
      for (const tag of ['rect', 'path', 'ellipse', 'g']) {
        expect(count(still, new RegExp(`<${tag}[ >]`, 'g')), `${id}: <${tag}> 수는 그대로`).toBe(count(moving, new RegExp(`<${tag}[ >]`, 'g')))
      }
      expect(stillSvg(still, true)).toBe(still)
    }
  }
})

const LOW =
  '<svg><rect x="1" fill="#fff"><animate attributeName="opacity" values="1;0.15;1" dur="3s" begin="-1s" calcMode="discrete" repeatCount="indefinite"/></rect>' +
  '<g opacity="1"><path d="M0 0h1v1z"/></g><g opacity="0"><path d="M1 1h1v1z"/></g><g transform="translate(3 4)"><rect/></g>' +
  '<ellipse fill-opacity=".1"><animate attributeName="fill-opacity" values=".2;.1" dur="2s"/></ellipse></svg>'

test('[효과 강도] 약하게는 프레임 묶음·이동만 멈추고 깜박임·불빛은 남기며, 보통은 그대로, 끔은 모두 멈춘다', async () => {
  expect(motionSvg(SAMPLE, 'full')).toBe(SAMPLE)
  expect(motionSvg(SAMPLE, 'off')).toBe(STILL)
  expect(motionSvg(SAMPLE, 'low')).toBe(LOW)
  expect(motionSvg(LOW, 'low')).toBe(LOW) // 한 번 더 해도 같다
  expect(problemsOf(LOW)).toEqual([])
})

test('[효과 강도] 진짜 그림 전부에서 약하게는 프레임 묶음·이동 움직임이 없고 모양이 멀쩡하며, 배너 띠의 불빛 깜박임은 남는다', async () => {
  for (const [id, art] of Object.entries(ART)) {
    for (const moving of [art.strip, ...[null, 0, 42, 100].map(percent => composeScene(art, percent))]) {
      const low = motionSvg(moving, 'low')

      expect(count(low, /<animateTransform/g), `${id}: 이동`).toBe(0)
      expect(count(low, /<g(?: opacity="[01]")?><animate/g), `${id}: 프레임 묶음`).toBe(0)
      expect(problemsOf(low), `${id}: 모양`).toEqual([])
    }
    expect(count(motionSvg(art.strip, 'low'), /<animate/g), `${id}: 띠의 불빛`).toBeGreaterThan(0)
  }
})

const sourcesOf = async (banner: { find: (q: object) => Promise<{ props: Record<string, unknown> } | undefined> }, pane: { findAll: (q: object) => Promise<{ props: Record<string, unknown> }[]> }) => [
  String((await banner.find({ type: 'Svg' }))?.props.source), // 배너 띠
  String((await pane.findAll({ type: 'Svg' }))[0]?.props.source), // 패널의 장면 그림
]

const BRIGHT_SHADE = 'fill="#ffffff" fill-opacity="0.14"'
const DIM_SHADE = 'fill="#000000" fill-opacity="0.38"'

test('[효과 강도·밝기] 패널의 두 버튼이 단계를 돌리고(효과: 보통 → 약하게 → 끔, 밝기: 보통 → 밝게 → 어둡게) 배너와 패널 그림에 함께 적용되며 저장소에 남는다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async (key: string) => (await pane.find({ key }))?.props.label
  const every = async (check: (source: string) => boolean) => (await sourcesOf(banner, pane)).every(check)

  expect([await label('motion'), await label('brightness')]).toEqual(['효과 보통', '밝기 보통'])
  expect(await every(source => source.includes('<animate') && !source.includes(BRIGHT_SHADE) && !source.includes(DIM_SHADE))).toBe(true)
  await pane.press({ key: 'motion' })
  expect(await label('motion')).toBe('효과 약하게')
  expect(await every(source => !source.includes('<animateTransform'))).toBe(true)
  expect((await sourcesOf(banner, pane))[0]).toContain('<animate') // 배너 띠의 불빛은 계속 깜박인다
  expect(store.motion).toBe('low')
  await pane.press({ key: 'motion' })
  expect(await label('motion')).toBe('효과 끔')
  expect(await every(source => !source.includes('<animate'))).toBe(true)
  expect(store.motion).toBe('off')
  await pane.press({ key: 'motion' })
  expect(await label('motion')).toBe('효과 보통')
  expect(await every(source => source.includes('<animate'))).toBe(true)
  expect(store.motion).toBe('full')

  await pane.press({ key: 'brightness' })
  expect(await label('brightness')).toBe('밝기 밝게')
  expect(await every(source => source.includes(BRIGHT_SHADE))).toBe(true)
  expect(store.brightness).toBe('bright')
  await pane.press({ key: 'brightness' })
  expect(await label('brightness')).toBe('밝기 어둡게')
  expect(await every(source => source.includes(DIM_SHADE))).toBe(true)
  const scene = String((await pane.findAll({ type: 'Svg' }))[0]?.props.source)

  expect(scene.indexOf(DIM_SHADE)).toBeLessThan(scene.indexOf('컨텍스트')) // 덮개는 게이지 글자 아래: 글자는 어두워지지 않는다
  expect(store.brightness).toBe('dim')
  await pane.press({ key: 'brightness' })
  expect(await label('brightness')).toBe('밝기 보통')
  expect(await every(source => !source.includes(BRIGHT_SHADE) && !source.includes(DIM_SHADE))).toBe(true)
  expect(store.brightness).toBe('normal')
  await banner.unmount()
  await pane.unmount()
})

test('[효과 강도] 거의 동시에 두 번 눌러도 두 번 다 바뀐다(한 번이 사라지지 않는다)', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await Promise.all([pane.press({ key: 'motion' }), pane.press({ key: 'motion' })])
  expect((await pane.find({ key: 'motion' }))?.props.label).toBe('효과 끔') // 보통 → 약하게 → 끔
  expect(store.motion).toBe('off')
  await pane.unmount()
})

test('[효과 강도·밝기] 저장된 설정은 다음 세션에도 이어지고, 옛 "움직임 끔"(불리언)은 효과 끔으로 읽으며, 이상한 값은 기본으로 읽는다', async ($, on) => {
  const clock = world(on, { stored: { motion: 'off', brightness: 'dim' } })

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect([(await pane.find({ key: 'motion' }))?.props.label, (await pane.find({ key: 'brightness' }))?.props.label]).toEqual(['효과 끔', '밝기 어둡게'])
  expect((await sourcesOf(banner, pane)).some(source => source.includes('<animate'))).toBe(false)
  expect((await sourcesOf(banner, pane)).every(source => source.includes(DIM_SHADE))).toBe(true)
  await banner.unmount()
  await pane.unmount()
})

test('[효과 강도·밝기] 예전 설정(isStill: true)은 효과 끔으로 이어지고, 이상한 저장값은 보통·보통으로 읽는다', async ($, on) => {
  const legacy = world(on, { stored: { isStill: true } })

  await $.session.start(START)
  await legacy.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await pane.find({ key: 'motion' }))?.props.label).toBe('효과 끔')
  await pane.unmount()
})

test('[효과 강도·밝기] 모양이 틀린 저장값(motion 글자 아님·brightness 숫자·isStill 글자)은 기본으로 읽는다', async ($, on) => {
  const clock = world(on, { stored: { motion: 'x', brightness: 7, isStill: 'yes' } })

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect([(await pane.find({ key: 'motion' }))?.props.label, (await pane.find({ key: 'brightness' }))?.props.label]).toEqual(['효과 보통', '밝기 보통'])
  expect(String((await banner.find({ type: 'Svg' }))?.props.source)).toContain('<animate')
  await banner.unmount()
  await pane.unmount()
})

test('[밝기] 터미널: 밝기 버튼만 있고(효과 버튼은 없다), 누르면 색 블록 그림의 색이 바뀌며, 칸 색은 어둡게 62%·밝게 흰색 쪽으로 16%다', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start({ ...START, surface: 'terminal' })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 100 }, surface: 'terminal' })
  const cells = async () => String((await pane.find({ type: 'Raster', key: 'scene' }))?.props.cells)
  const normal = await cells()

  expect(await pane.find({ key: 'motion' })).toBeUndefined()
  await pane.press({ key: 'brightness' })
  expect((await pane.find({ key: 'brightness' }))?.props.label).toBe('밝기 밝게')
  const bright = await cells()

  await pane.press({ key: 'brightness' })
  const dim = await cells()

  expect(new Set([normal, bright, dim]).size).toBe(3)
  expect(shadeColor(0xffffff, 'dim')).toBe(0x9e9e9e)
  expect(shadeColor(0x000000, 'bright')).toBe(0x292929)
  expect(shadeColor(0x123456, 'normal')).toBe(0x123456)
  const fill = 0x1b1b3a

  expect(scenePicture(CELLS.attic, 42, 100, fill).cells).toBe(scenePicture(CELLS.attic, 42, 100, fill, 'normal').cells)
  expect(scenePicture(CELLS.attic, 42, 100, fill, 'dim').cells).not.toBe(scenePicture(CELLS.attic, 42, 100, fill).cells)
  expect(SCENES.attic.base).toBe('#1b1b3a') // 위의 fill이 장면 바탕색과 같다
  await pane.unmount()
})
