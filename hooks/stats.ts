import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Today } from '../types'
import { fingerprint, todayKey } from './format'

// 오늘 통계는 채팅(세션)마다 "자기 칸"에만 쓴다. 저장소에는 원자적 갱신이 없어서, 모두가 한 키를 읽고-고치고-쓰면
// 같은 순간에 늘린 것이 사라진다(시험으로 재현했다: 10에서 둘이 1씩 늘렸는데 11). 칸마다 쓰는 채팅이 하나뿐이면 서로 덮어쓸 일이 없고,
// 합계는 읽는 쪽이 모든 칸을 더해 만든다. 칸에는 증가분이 아니라 누적값을 쓰므로, 쓰기가 한 번 사라져도 다음 쓰기가 바로잡는다.
const EMPTY: Today = { date: '', prompts: 0, actions: 0, files: [] }
const slot = atom({ plugin: 'pixel-tavern', key: 'slot' } as const, '')
const own = atom({ plugin: 'pixel-tavern', key: 'own' } as const, EMPTY, { shape: 'own-1' }) // 이 채팅이 더한 것
const others = atom({ plugin: 'pixel-tavern', key: 'others' } as const, EMPTY, { shape: 'others-1' }) // 다른 칸들의 합(마지막 동기화 때)

const FILES_MAX = 500 // 수정 파일 지문을 칸마다·합계에서 이만큼만 센다
const PREFIX = 'today:' // 칸의 키: today:<날짜>:<칸 이름>
const LEGACY_KEY = 'today' // 옛 방식(모두가 한 키에 합계를 쓰던 것): 읽기만 하고 쓰지 않는다
const PRUNE_MAX = 20 // 한 번의 동기화에서 지우는 옛 키의 최대 개수

const isToday = (v: unknown): v is Today => {
  const t = v as Partial<Today> | null

  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.date === 'string' &&
    typeof t.prompts === 'number' &&
    typeof t.actions === 'number' &&
    Array.isArray(t.files)
  )
}

/** 같은 날의 여러 칸을 더한다: 숫자는 합, 파일(지문)은 합집합. 다른 날의 칸은 넣지 않는다. */
export const sumToday = (day: string, parts: Today[]): Today => {
  const sameDay = parts.filter(part => part.date === day)

  return {
    date: day,
    prompts: sameDay.reduce((total, part) => total + part.prompts, 0),
    actions: sameDay.reduce((total, part) => total + part.actions, 0),
    files: [...new Set(sameDay.flatMap(part => part.files))].slice(-FILES_MAX),
  }
}

/** 이 채팅의 칸 이름. 한 번 정하면 모드를 다시 불러와도 같다($.state에 남는다). 앱을 다시 켜면 새로 정한다(앞 칸은 저장소에 남아 합계에 든다). */
async function ownSlot($: EngineInterface): Promise<string> {
  const made = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  await update($, slot, id => (id === '' ? made : id))

  return read($, slot)
}

// 내 칸을 쓰는 일은 한 줄로 세운다: 한 채팅 안에서 여러 번 늘려도 쓰기가 뒤바뀌어 끝나 옛 값이 마지막에 남지 않게(쓸 때 최신 값을 읽는다).
let writes: Promise<unknown> = Promise.resolve()

function persistOwn($: EngineInterface): Promise<void> {
  const next = writes.then(async () => {
    const mine = await read($, own)

    if (mine.date !== '') await $.store.set(`${PREFIX}${mine.date}:${await ownSlot($)}`, mine)
  })

  writes = next.catch(() => undefined) // 한 번 실패해도 다음 쓰기는 이어진다(실패는 부른 쪽에 그대로 알린다)

  return next
}

/** 이 채팅의 오늘 통계를 고친다. 날짜가 바뀌었으면 0부터 다시 센다. */
export async function bumpToday($: EngineInterface, change: (t: Today) => Today): Promise<void> {
  const day = todayKey(await $.clock.now())

  await update($, own, t => change(t.date === day ? t : { ...EMPTY, date: day }))
  await persistOwn($)
}

export function countPrompt($: EngineInterface): Promise<void> {
  return bumpToday($, t => ({ ...t, prompts: t.prompts + 1 }))
}

export function countAction($: EngineInterface): Promise<void> {
  return bumpToday($, t => ({ ...t, actions: t.actions + 1 }))
}

/** 파일 지문 하나를 더한다: 이미 있으면 그대로, 500개를 넘으면 오래된 것부터 버린다. */
export const withFile = (t: Today, print: string): Today => ({ ...t, files: t.files.includes(print) ? t.files : [...t.files, print].slice(-FILES_MAX) })

/** 오늘 고친 파일 한 개를 더한다(경로 대신 지문으로). */
export function addTouchedFile($: EngineInterface, path: string): Promise<void> {
  return bumpToday($, t => withFile(t, fingerprint(path)))
}

/**
 * 저장소의 다른 칸들(다른 채팅과 앞선 실행)을 읽어 합을 만들고, 지난 날의 칸은 지운다. 1분마다와 시작할 때 부른다.
 * 끝에 내 칸을 한 번 더 써서, 겹쳐 쓰다 사라진 쓰기가 있었다면 바로잡는다.
 */
export async function syncStats($: EngineInterface): Promise<void> {
  const day = todayKey(await $.clock.now())
  const mine = await ownSlot($)
  const stale: string[] = []
  const live: string[] = []

  for (const key of await $.store.keys()) {
    if (key === LEGACY_KEY) live.push(key)
    else if (key.startsWith(PREFIX)) {
      const [, keyDay = '', id = ''] = key.split(':')

      if (keyDay !== day) stale.push(key)
      else if (id !== mine) live.push(key)
    }
  }
  const parts: Today[] = []

  for (const key of live) {
    const value = await $.store.get(key)

    if (!isToday(value)) continue
    if (key !== LEGACY_KEY) parts.push(value)
    else if (value.date === day) parts.push({ ...value, files: value.files.map(path => fingerprint(String(path))) }) // 옛 키에는 경로가 들어 있다
    else stale.push(key)
  }
  for (const key of stale.slice(0, PRUNE_MAX)) await $.store.delete(key)
  await update($, others, () => sumToday(day, parts))
  if ((await read($, own)).date === day) await persistOwn($)
}

/** 화면에 보일 오늘 통계: 이 채팅이 더한 것 + 다른 칸들의 합. */
export async function readToday($: EngineInterface): Promise<Today> {
  const day = todayKey(await $.clock.now())

  return sumToday(day, [await read($, own), await read($, others)])
}
