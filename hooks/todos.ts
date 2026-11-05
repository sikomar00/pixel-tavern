import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Todo } from '../types'
import { withoutControl } from './format'

// 할 일 목록: 항목 · 체크박스(완료) · 우선 표시(★)뿐이다. 모든 채팅이 같은 목록을 쓰므로 저장소(`$.store`)의 `todos` 한 키에 담는다.
// 엔진의 검사는 atom을 읽고 쓰는 파일에서 atom을 찾는다: atom은 이 파일에만 두고 바깥에는 `$`를 받는 함수로만 드러낸다.
const todos = atom({ plugin: 'pixel-tavern', key: 'todos' } as const, [])

export const TODOS_MAX = 50 // 목록에 둘 수 있는 항목 수(저장 크기를 작게 둔다)
const TEXT_MAX = 80 // 항목 하나의 글자 수

const cleanText = (value: string): string => withoutControl(value).trim().slice(0, TEXT_MAX)

const isTodo = (value: unknown): value is Todo => {
  const t = value as Partial<Todo> | null

  return typeof t === 'object' && t !== null && typeof t.id === 'string' && t.id !== '' && typeof t.text === 'string' && typeof t.done === 'boolean' && typeof t.star === 'boolean'
}

/** 저장된 값에서 모양이 맞는 항목만 남긴다: 같은 id는 앞의 것만, 글자는 정리하고, 빈 항목은 버리고, 50개까지. */
const cleanTodos = (value: unknown): Todo[] => {
  const seen = new Set<string>()
  const list: Todo[] = []

  for (const item of Array.isArray(value) ? value : []) {
    if (!isTodo(item) || seen.has(item.id)) continue
    seen.add(item.id)
    const text = cleanText(item.text)

    if (text !== '') list.push({ id: item.id, text, done: item.done, star: item.star })
  }

  return list.slice(0, TODOS_MAX)
}

/** 화면에 보이는 순서: 우선(★)인 안 한 일이 위, 그다음 안 한 일, 완료한 것은 아래. 같은 묶음 안에서는 목록 순서(새것이 위). */
export const orderTodos = (list: Todo[]): Todo[] => [
  ...list.filter(t => !t.done && t.star),
  ...list.filter(t => !t.done && !t.star),
  ...list.filter(t => t.done),
]

// 목록을 바꾸는 일은 한 줄로 세운다(같은 채팅에서 거의 동시에 더해도 서로 지우지 않게). 바꿀 때마다 저장소의 최신 목록을 읽고 그 위에 바꾼다:
// 다른 채팅이 그동안 더한 항목을 덮어쓰지 않는다.
let writes: Promise<unknown> = Promise.resolve()

function queue(work: () => Promise<void>): Promise<void> {
  const next = writes.then(work)

  writes = next.catch(() => undefined) // 한 번 실패해도 다음 일은 이어진다(실패는 부른 쪽에 그대로 알린다)

  return next
}

function change($: EngineInterface, edit: (list: Todo[]) => Todo[]): Promise<void> {
  return queue(async () => {
    const edited = cleanTodos(edit(cleanTodos(await $.store.get('todos'))))

    await $.store.set('todos', edited)
    await update($, todos, () => edited)
  })
}

/** 저장소의 목록을 읽어 화면의 값으로 삼는다. 시작할 때와 1분마다(다른 채팅이 바꾼 것이 보이게) 부른다. */
export function loadTodos($: EngineInterface): Promise<void> {
  return queue(async () => {
    const latest = cleanTodos(await $.store.get('todos'))

    await update($, todos, () => latest)
  })
}

export function readTodos($: EngineInterface): Promise<Todo[]> {
  return read($, todos)
}

const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 새 항목을 맨 위에 더한다. 빈 글자는 무시하고, 50개가 차 있으면 더하지 않는다. */
export async function addTodo($: EngineInterface, text: string): Promise<'added' | 'empty' | 'full'> {
  const clean = cleanText(text)
  let result: 'added' | 'empty' | 'full' = 'empty'

  if (clean === '') return result
  await change($, list => {
    result = list.length >= TODOS_MAX ? 'full' : 'added'

    return result === 'full' ? list : [{ id: newId(), text: clean, done: false, star: false }, ...list]
  })

  return result
}

/** 완료(체크)를 켜고 끈다. */
export function toggleTodo($: EngineInterface, id: string): Promise<void> {
  return change($, list => list.map(t => (t.id === id ? { ...t, done: !t.done } : t)))
}

/** 우선 표시(★)를 켜고 끈다. */
export function starTodo($: EngineInterface, id: string): Promise<void> {
  return change($, list => list.map(t => (t.id === id ? { ...t, star: !t.star } : t)))
}

/** 완료한 항목을 모두 지운다. */
export function clearDoneTodos($: EngineInterface): Promise<void> {
  return change($, list => list.filter(t => !t.done))
}
