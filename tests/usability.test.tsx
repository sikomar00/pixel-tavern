// [사용성] 시험. 공용 도우미는 ./kit.tsx 에 있다.
import { expect, test } from 'claude-code/testing'
import { QUICK } from '../hooks/actions'
import { HELP } from '../hooks/help'
import { ARMED_LABEL, BAND, PANE, START, USAGE, counter, fakePlayer, newSpy, world } from './kit'

// 엔진이 명령에 붙여 주는 입력(/tavern-diag를 사람이 입력한 것). 시험은 엔진 역할이라 모든 필드를 적는다.
const DIAG_COMMAND = { command: 'tavern-diag', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('[사용성] 배너를 숨겨도 음악이 켜져 있으면 끄는 버튼은 남는다', async ($, on) => {
  const clock = world(on)

  fakePlayer(on, clock, [])
  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await banner.press({ key: 'hide' })
  expect(await banner.find({ key: 'music' })).toBeUndefined() // 꺼져 있으면 ▣ 여관만 남는다
  await banner.press({ key: 'show' })
  await banner.press({ key: 'music' })
  await banner.press({ key: 'hide' })
  expect((await banner.find({ key: 'music' }))?.props.label).toBe('■')
  await banner.press({ key: 'music' })
  expect(await banner.find({ key: 'music' })).toBeUndefined()
  await clock.advance(1000)
  await banner.unmount()
})

test('[사용성] 패널: 한도 정보가 비어 있으면 이유를 알려 준다', async ($, on) => {
  const clock = world(on, { usage: { ...USAGE, rateLimits: [] } })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await pane.find({ type: 'Text', text: /받은 한도 정보가 없어요/ })).toBeDefined()
  await pane.unmount()
})

test('[사용성] 처음 한 번만 안내 문구를 보여 준다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  await $.session.start(START)
  await clock.settle()
  expect(spy.toasts.filter(text => text.includes('픽셀 여관이 열렸어요'))).toHaveLength(1)
})

test('[사용성] 만진 파일은 기본 4개만 보이고, 전체 보기·접기로 펼친다(이 채팅 목록은 50개까지만 기억)', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const fileButtons = async () => (await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file:'))
  const toggle = async () => (await pane.find({ key: 'files-toggle' }))?.props.label
  const edit = async (from: number, to: number) => {
    for (let i = from; i <= to; i++) await $.tool.call({ tool: 'Edit', file_path: `C:/work/p/f${i}.ts`, old_string: 'a', new_string: 'b' })
  }

  await edit(1, 4)
  expect(await fileButtons()).toHaveLength(4)
  expect(await toggle()).toBeUndefined() // 4개 이하면 펼칠 것이 없다
  await edit(5, 12)
  expect(await fileButtons()).toHaveLength(4) // 기본은 최근 4개
  expect((await fileButtons())[0]?.props.label).toBe('p/f12.ts') // 가장 최근이 맨 위
  expect(await toggle()).toBe('전체 보기 (12)')
  expect(await pane.find({ type: 'Text', text: '이 채팅 12개' })).toBeDefined()
  await pane.press({ key: 'files-toggle' })
  expect(await fileButtons()).toHaveLength(12)
  expect(await toggle()).toBe('접기')
  await pane.press({ key: 'files-toggle' })
  expect(await fileButtons()).toHaveLength(4)
  await edit(13, 60)
  await pane.press({ key: 'files-toggle' })
  expect(await fileButtons()).toHaveLength(50) // 수집 한도는 그대로 50개
  expect(await counter(pane, '수정 파일')).toBe('60') // 오늘 누적은 따로 센다
  await pane.unmount()
})

test('[사용성] 빠른 실행은 버튼만 한 줄에 두고, 설명은 늘어놓지 않으며, 커밋 대기에는 안내가 덧붙는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const waiting = async () => (await pane.find({ type: 'Text', text: /5초 안에 한 번 더 누르면 변경을 커밋해요/ })) !== undefined
  const labels = async () => Promise.all(QUICK.map(async item => (await pane.find({ key: item.key }))?.props.label))
  const names = QUICK.map(item => item.label)

  expect(names).toEqual(['코드 리뷰', '변경 커밋', '코드 정리']) // 무엇을 하는 버튼인지 이름만으로 알 수 있다
  expect(await labels()).toEqual(names)
  expect((await pane.findAll({ type: 'Box' })).filter(node => node.props.minWidth !== undefined)).toHaveLength(0)
  expect(await pane.find({ type: 'Text', text: /^(바뀐 코드를 검토해요|코드를 다듬어요)$/ })).toBeUndefined() // 설명은 "?"에만 있다
  expect(await waiting()).toBe(false)
  await pane.press({ key: 'commit' })
  expect(await labels()).toEqual([names[0], ARMED_LABEL, names[2]]) // 대기 중에도 다른 버튼 라벨은 그대로, 줄 길이도 비슷하다
  expect(await waiting()).toBe(true)
  await pane.unmount()
})

test('[사용성] 도움말: 항목마다 ? 하나와 숨겨진 설명 창이 짝을 이루고, 누르면 패널 안에서 펼쳐진다', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const marks = (await pane.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('help:'))
  const tips = (await pane.findAll({ type: 'Box' })).filter(node => node.props.display === 'none')
  const ids = marks.map(button => String(button.key).slice('help:'.length))

  expect([...ids].sort()).toEqual(Object.keys(HELP).sort()) // HELP에 적은 항목이 모두, 그리고 그것만 화면에 있다
  expect(tips).toHaveLength(ids.length) // ? 하나에 설명 창 하나
  expect(marks.every(button => button.props.label === '?')).toBe(true)
  expect(tips.every(tip => tip.props.position === 'absolute' && tip.props.right === 0 && typeof tip.props.width === 'number')).toBe(true)
  for (const line of HELP.quick) expect(await pane.find({ type: 'Text', text: line })).toBeDefined()
  expect(HELP.quick.join(' ')).toContain('두 번 눌러야 실행')
  expect(Object.keys(HELP)).not.toContain('files') // 한 줄이면 되는 안내는 화면에 직접 적는다
  // 누르면 패널 안에서 펼쳐진다(하나만 열린다): 설명 카드가 생기고, 그 항목의 호버 창은 빠지고, 표시는 ×가 된다.
  expect(await pane.find({ key: 'help-card:quick' })).toBeUndefined()
  await pane.press({ key: 'help:quick' })
  expect(await pane.find({ key: 'help-card:quick' })).toBeDefined()
  expect((await pane.find({ key: 'help:quick' }))?.props.label).toBe('×')
  expect((await pane.findAll({ type: 'Box' })).filter(node => node.props.display === 'none')).toHaveLength(ids.length - 1)
  await pane.press({ key: 'help:usage' })
  expect(await pane.find({ key: 'help-card:quick' })).toBeUndefined() // 다른 걸 열면 앞의 것은 닫힌다
  expect(await pane.find({ key: 'help-card:usage' })).toBeDefined()
  await pane.press({ key: 'help:usage' })
  expect(await pane.find({ key: 'help-card:usage' })).toBeUndefined()
  expect(spy.toasts).not.toContain(HELP.quick.join(' · ')) // 알림으로 띄우지 않는다
  await pane.unmount()
})

test('[사용성] 윈도우가 아니면 음악 버튼 대신 이유만 보이고, 배너에도 음악 버튼이 없다', async ($, on) => {
  const clock = world(on, { whereExit: 1 }) // where.exe가 PowerShell을 못 찾는 환경

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await banner.find({ key: 'music' })).toBeUndefined()
  expect(await banner.find({ key: 'panel' })).toBeDefined() // 나머지 버튼은 그대로
  expect(await pane.find({ key: 'radio' })).toBeUndefined()
  expect(await pane.find({ key: 'volume-up' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^음악은 Windows에서만 쓸 수 있어요$/ })).toBeDefined()
  await banner.unmount()
  await pane.unmount()
})

test('[사용성] /tavern-diag: 측정판이 켜지고 꺼지며, 열·줄 수와 px 기준자가 있다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const board = async () => pane.find({ type: 'Text', text: /^측정판/ })
  const rulers = async () => (await pane.findAll({ type: 'Svg' })).filter(svg => String(svg.props.alt).includes('기준자'))

  expect(await board()).toBeUndefined() // 평소에는 보이지 않는다
  expect(await rulers()).toHaveLength(0)
  const on1 = await $.command.run(DIAG_COMMAND)

  expect(String((on1 as { text?: string }).text)).toContain('측정판을 켰어요')
  expect(await board()).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '열 40 · 줄 20 · dock · desktop' })).toBeDefined() // 렌더 훅이 받은 틀 정보
  expect((await rulers()).map(svg => svg.props.width)).toEqual([100, 300]) // 선언한 px 그대로
  // 간격 5단계·글자 5크기 표본이 모두 있다
  for (const step of ['xs', 'sm', 'md', 'lg', 'xl']) expect(await pane.find({ type: 'Text', text: new RegExp(`^${step}$`) })).toBeDefined()
  for (const size of ['caption', 'footnote', 'body', 'heading', 'title']) expect(await pane.find({ type: 'Text', text: new RegExp(`^${size} 가나다`) })).toBeDefined()
  expect(await pane.find({ key: 'quick' })).toBeUndefined() // 측정판의 버튼이 진짜 기능 버튼과 섞이지 않는다
  const off = await $.command.run(DIAG_COMMAND)

  expect(String((off as { text?: string }).text)).toContain('껐어요')
  expect(await board()).toBeUndefined()
  expect(await rulers()).toHaveLength(0)
  await pane.unmount()
})

test('[사용성] 접기 표시: 구역마다 ▾가 있고, 커밋 로그는 기본으로 접혀 있으며 눌러서 펴고 접는다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async (key: string) => (await pane.find({ key }))?.props.label

  for (const id of ['usage', 'status', 'files', 'music']) expect(await label(`fold:${id}`), id).toBe('▾') // 처음에는 모두 펴져 있다
  expect(await label('fold:art')).toBe('그림 ▾')
  expect(await label('fold:commits')).toBe('▸ 최근 커밋 2개')
  expect(await pane.find({ type: 'Text', text: /abc1234/ })).toBeUndefined()
  await pane.press({ key: 'fold:commits' })
  expect(await label('fold:commits')).toBe('▾ 최근 커밋 2개')
  expect(await pane.find({ type: 'Text', text: /abc1234/ })).toBeDefined()
  await pane.press({ key: 'fold:commits' })
  expect(await pane.find({ type: 'Text', text: /abc1234/ })).toBeUndefined()
  await pane.unmount()
})

test('[사용성] 사용량이 90%를 넘으면 한 번만 알림이 뜬다(측정이 올 때마다 확인)', async ($, on) => {
  const spy = newSpy()
  const clock = world(on, { spy })

  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start(START)
  await clock.settle()
  const measure = async (percent: number) => {
    await $.session.measure({ ...USAGE, context: { ...USAGE.context, percent }, changed: ['context'] })
    await clock.settle()
  }
  const alerts = () => spy.toasts.filter(text => text.startsWith('컨텍스트가'))

  await measure(80)
  expect(alerts()).toHaveLength(0)
  await measure(92)
  expect(alerts()).toEqual(['컨텍스트가 92%예요. /compact 로 정리하거나 새 채팅을 여는 게 좋아요'])
  await measure(95)
  expect(alerts()).toHaveLength(1)
  await measure(70)
  await measure(93)
  expect(alerts()).toHaveLength(2)
})

test('[사용성] 배너를 숨겨도 사용량은 한 줄로 보이고, 다시 열면 그 줄은 사라진다', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.settle()
  const banner = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const line = async () => banner.find({ type: 'Text', text: /^컨텍스트 42% · 5시간 24% · 주간 7%$/ })

  expect(await line()).toBeUndefined() // 펴져 있을 때는 배너 그림에 게이지가 있다
  await banner.press({ key: 'hide' })
  expect(await line()).toBeDefined()
  expect(await banner.find({ key: 'show' })).toBeDefined()
  await banner.press({ key: 'show' })
  expect(await line()).toBeUndefined()
  await banner.unmount()
})


// ── 할 일(구글 태스크처럼 간단히): 항목 · 체크박스 · 우선 표시 ──
type StoredTodo = { id: string; text: string; done: boolean; star: boolean }

const todosOf = (store: Record<string, unknown>): StoredTodo[] => (store.todos ?? []) as StoredTodo[]

const idOf = (store: Record<string, unknown>, text: string): string => todosOf(store).find(item => item.text === text)?.id ?? ''

/** 화면에 보이는 항목 글자들(위에서 아래 순서). */
const shownTodos = async (pane: { findAll: (query: object) => Promise<{ text?: string }[]> }, names: string[]): Promise<string[]> =>
  (await pane.findAll({ type: 'Text' })).map(node => String(node.text)).filter(text => names.includes(text))

test('[사용성] 할 일: 칸에 적고 Enter로 더하면 맨 위에 쌓이고, ☐로 완료(☑)·☆로 우선(★)이 되며, 우선은 위로 완료는 아래로 가고, 완료한 것은 한꺼번에 지운다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const names = ['우유 사기', '빨래', '보고서 쓰기']
  const label = async (key: string) => (await pane.find({ key }))?.props.label

  expect(await pane.find({ type: 'Text', text: /할 일이 없어요/ })).toBeDefined()
  for (const text of names) await pane.input({ key: 'todo:new', text })
  expect(todosOf(store).map(item => item.text)).toEqual(['보고서 쓰기', '빨래', '우유 사기']) // 새 일이 맨 위
  expect(await shownTodos(pane, names)).toEqual(['보고서 쓰기', '빨래', '우유 사기'])
  expect(await pane.find({ type: 'Text', text: /할 일이 없어요/ })).toBeUndefined()
  const wash = idOf(store, '빨래')

  expect(await label(`todo:star:${wash}`)).toBe('☆')
  await pane.press({ key: `todo:star:${wash}` })
  expect(await label(`todo:star:${wash}`)).toBe('★')
  expect(await shownTodos(pane, names)).toEqual(['빨래', '보고서 쓰기', '우유 사기']) // 우선이 위로
  expect(await label(`todo:done:${wash}`)).toBe('☐')
  await pane.press({ key: `todo:done:${wash}` })
  expect(await label(`todo:done:${wash}`)).toBe('☑')
  expect(await shownTodos(pane, names)).toEqual(['보고서 쓰기', '우유 사기', '빨래']) // 완료는 아래로(우선이어도)
  expect(await label('todo:clear')).toBe('완료한 것 지우기 (1)')
  await pane.press({ key: 'todo:clear' })
  expect(todosOf(store).map(item => item.text)).toEqual(['보고서 쓰기', '우유 사기']) // 완료한 것만 지워진다
  expect(await pane.find({ key: 'todo:clear' })).toBeUndefined() // 지울 것이 없으면 버튼도 없다
  await pane.press({ key: `todo:done:${idOf(store, '우유 사기')}` }) // 다시 눌러 완료를 되돌릴 수도 있다
  await pane.press({ key: `todo:done:${idOf(store, '우유 사기')}` })
  expect(todosOf(store).find(item => item.text === '우유 사기')?.done).toBe(false)
  await pane.unmount()
})

test('[사용성] 할 일: 빈 입력은 무시하고, 줄바꿈 같은 제어 문자는 빼고, 80글자로 자르고, 50개가 차면 더하지 않고 알려 준다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const spy = newSpy()
  const clock = world(on, { liveStore: store, spy })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.input({ key: 'todo:new', text: '   ' })
  expect(todosOf(store)).toHaveLength(0) // 빈 입력은 저장하지 않는다
  await pane.input({ key: 'todo:new', text: '줄\n바꿈\u0000' })
  await pane.input({ key: 'todo:new', text: '가'.repeat(100) })
  expect(todosOf(store).map(item => item.text)).toEqual(['가'.repeat(80), '줄바꿈'])
  for (let i = 0; i < 48; i += 1) await pane.input({ key: 'todo:new', text: `일 ${i}` })
  expect(todosOf(store)).toHaveLength(50)
  expect(spy.toasts.filter(text => text.includes('50개까지'))).toHaveLength(0)
  await pane.input({ key: 'todo:new', text: '51번째' })
  expect(todosOf(store)).toHaveLength(50) // 더하지 않는다
  expect(todosOf(store).some(item => item.text === '51번째')).toBe(false)
  expect(spy.toasts.filter(text => text.includes('50개까지'))).toHaveLength(1)
  await pane.unmount()
})

test('[사용성] 할 일: 저장된 목록은 다음 세션에도 이어지고(모양이 틀린 항목은 버림), 다른 채팅이 더한 일은 1분 안에 보이고, 내가 더해도 그 일이 지워지지 않는다', async ($, on) => {
  const store: Record<string, unknown> = {
    todos: [
      { id: 'a', text: '저장된 일', done: false, star: true },
      { id: 'a', text: '같은 id라 버린다', done: false, star: false },
      { id: 'b', text: 7, done: false, star: false },
      { id: 'c', text: '   ', done: false, star: false },
      'garbage',
    ],
  }
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const names = ['저장된 일', '같은 id라 버린다', '다른 채팅의 일', '또 다른 일', '내 일']

  expect(await shownTodos(pane, names)).toEqual(['저장된 일'])
  expect((await pane.find({ key: 'todo:star:a' }))?.props.label).toBe('★') // 우선 표시도 이어진다
  store.todos = [{ id: 'a', text: '저장된 일', done: false, star: true }, { id: 'z', text: '다른 채팅의 일', done: false, star: false }] // 다른 채팅이 더함
  await clock.advance(60_000) // 1분마다 오는 갱신
  expect(await shownTodos(pane, names)).toEqual(['저장된 일', '다른 채팅의 일'])
  store.todos = [...todosOf(store), { id: 'y', text: '또 다른 일', done: false, star: false }] // 이 채팅이 아직 모르는 사이에 또 더함
  await pane.input({ key: 'todo:new', text: '내 일' })
  expect(todosOf(store).map(item => item.text).sort()).toEqual(['내 일', '또 다른 일', '다른 채팅의 일', '저장된 일'].sort()) // 아무것도 지워지지 않았다
  await pane.unmount()
})

test('[사용성] 할 일: 거의 동시에 여러 개를 더해도 모두 남고, 접으면 남은 개수만 보인다', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, { liveStore: store })

  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await Promise.all(['가', '나', '다'].map(text => pane.input({ key: 'todo:new', text })))
  expect(todosOf(store).map(item => item.text).sort()).toEqual(['가', '나', '다'])
  await pane.press({ key: `todo:done:${idOf(store, '나')}` })
  await pane.press({ key: 'fold:todo' })
  expect(await pane.find({ key: 'todo:new' })).toBeUndefined() // 접으면 입력 칸과 항목이 사라지고
  expect(await pane.find({ type: 'Text', text: '남은 2개' })).toBeDefined() // 남은 개수(완료 빼고)만 남는다
  await pane.press({ key: 'fold:todo' })
  expect(await pane.find({ key: 'todo:new' })).toBeDefined()
  await pane.unmount()
})
