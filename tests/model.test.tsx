// [데이터] 시험: 프로젝트 이름·모델·effort 표시. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { modelText } from '../hooks/format'
import { SCENES } from '../hooks/scenes'
import { BAND, PANE, START, world } from './kit'

const STEP = { turnId: 't1', index: 0, messageCount: 1 } as const

test('[데이터] 모델 한 줄: 모델과 effort를 ·로 잇고, effort를 모르면 모델만, 모델을 모르면 빈 글자', async () => {
  expect(modelText('claude-opus-5-5', 'xhigh')).toBe('Opus 5.5 · xhigh')
  expect(modelText('claude-sonnet-5-5', null)).toBe('Sonnet 5.5')
  expect(modelText(null, 'high')).toBe('')
})

test('[데이터] 모델·effort: 시작할 때 모델을 읽고, 메인 대화의 모델 요청마다 모델과 effort를 따라가며, 서브에이전트의 요청은 무시한다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = async () => String((await banner.find({ type: 'Svg' }))?.props.source)
  const row = async () => (await pane.find({ type: 'Text', text: /^모델 / }))?.text

  expect(await svg()).toContain('Sonnet 5.5 · main +2') // 첫 요청 전: 모델만(effort는 아직 모른다)
  expect(await row()).toBe('모델 Sonnet 5.5 · effort -')
  for await (const chunk of $.turn.step({ ...STEP, model: 'claude-opus-5-5', effort: 'xhigh' })) void chunk
  expect(await svg()).toContain('Opus 5.5 · xhigh · main +2') // /model로 바꾼 모델과 effort가 다음 요청부터 보인다
  expect(await row()).toBe('모델 Opus 5.5 · effort xhigh')
  for await (const chunk of $.turn.step({ ...STEP, index: 1, model: 'claude-haiku-5-5', effort: 'low', agentId: 'agent-1' })) void chunk
  expect(await row()).toBe('모델 Opus 5.5 · effort xhigh') // 서브에이전트의 요청은 무시한다
  for await (const chunk of $.turn.step({ ...STEP, index: 2, model: 'claude-opus-5-5', effort: 8000 })) void chunk
  expect(await row()).toBe('모델 Opus 5.5 · effort 예산 8000') // 숫자 예산도 읽는다
  for await (const chunk of $.turn.step({ ...STEP, index: 3, model: 'claude-opus-5-5' })) void chunk
  expect(await row()).toBe('모델 Opus 5.5 · effort -') // effort가 없는 모델은 지운다
  await banner.unmount()
  await pane.unmount()
})

test('[데이터] 터미널 배너: 장면 이름 옆에 모델·effort, 프로젝트 이름은 굵게, 브랜치는 그 옆에 흐리게', async ($, on) => {
  const clock = world(on, { surfaces: ['terminal'] })

  await $.session.start({ ...START, surface: 'terminal' })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const text = async (query: string | RegExp) => (await band.find({ type: 'Text', text: query }))?.props

  expect((await text(/^Sonnet 5\.5$/))?.color).toBe(SCENES.attic.muted)
  for await (const chunk of $.turn.step({ ...STEP, model: 'claude-opus-5-5', effort: 'high' })) void chunk
  expect((await band.find({ type: 'Text', text: 'Opus 5.5 · high' }))?.text).toBe('Opus 5.5 · high')
  expect((await text(/^p$/))?.weight).toBe('semibold') // 프로젝트 이름(폴더 이름)
  expect((await text(/^· main \+2$/))?.color).toBe(SCENES.attic.muted) // 브랜치는 흐리게
  await band.unmount()
})
