import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { TimelineDay, TimelineEntry, TimelineKind, TurnEnd } from '../types'
import { fingerprint, todayKey } from './format'
import { ownSlot } from './stats'

// 오늘 작업 기록: 언제(시각) · 어떤 일(프롬프트·작업 끝·작업 중단) · 그 턴에 고친 파일 수만 남긴다.
// 파일 이름·경로와 프롬프트·답 글은 저장하지 않는다(파일은 턴 안에서 지문으로 "몇 개"만 센다). 오늘 하루만 보관하고 자정이 지나면 지운다.
// 저장 방식은 오늘 통계와 같다: 채팅마다 자기 칸(`timeline:<날짜>:<칸 이름>`)에만 쓰고, 읽는 쪽이 모든 칸을 합친다(여러 채팅이 서로 덮어쓰지 않게).
const EMPTY: TimelineDay = { date: '', entries: [] }
const own = atom({ plugin: 'pixel-tavern', key: 'timelineOwn' } as const, EMPTY) // 이 채팅의 오늘 기록
const others = atom({ plugin: 'pixel-tavern', key: 'timelineOthers' } as const, []) // 다른 칸들의 기록(마지막 동기화 때)

const PREFIX = 'timeline:'
const OWN_MAX = 50 // 채팅마다 오늘 기록을 이만큼만(오래된 것부터 버린다)
const FILES_MAX = 999
const SHOWN = 10 // 패널에 보이는 최근 기록 수
const PRUNE_MAX = 20 // 한 번의 동기화에서 지우는 옛 키의 최대 개수
const KINDS: readonly TimelineKind[] = ['prompt', 'done', 'stopped']

// 이 턴에 고친 파일(지문). 메모리에만 있고 저장하지 않으며, 턴이 끝날 때 개수만 기록한다. 다음 턴이 시작될 때 비운다(register의 turn.start).
let turnFiles = new Set<string>()

export const noteTurnFile = (path: string): void => {
  turnFiles.add(fingerprint(path))
}

export const resetTurnFiles = (): void => {
  turnFiles = new Set()
}


const isEntry = (value: unknown): value is TimelineEntry => {
  const entry = value as Partial<TimelineEntry> | null

  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    KINDS.includes(entry.kind as TimelineKind) &&
    (entry.files === undefined || (typeof entry.files === 'number' && Number.isFinite(entry.files)))
  )
}

/** 다른 채팅이 쓴 값이므로 모양을 확인하고 정리한다: 모르는 것은 버리고, 파일 수는 0~999 정수로. */
const cleanEntries = (value: unknown): TimelineEntry[] =>
  (Array.isArray(value) ? value : [])
    .filter(isEntry)
    .map(({ at, kind, files }) => ({ at, kind, ...(files === undefined ? {} : { files: Math.min(FILES_MAX, Math.max(0, Math.floor(files))) }) }))
    .slice(-OWN_MAX)

const isDay = (value: unknown): value is TimelineDay => {
  const day = value as Partial<TimelineDay> | null

  return typeof day === 'object' && day !== null && typeof day.date === 'string' && Array.isArray(day.entries)
}

// 내 칸을 쓰는 일은 한 줄로 세운다(쓰기가 뒤바뀌어 끝나 옛 값이 마지막에 남지 않게: 쓸 때 최신 값을 읽는다).
let writes: Promise<unknown> = Promise.resolve()

function persistOwn($: EngineInterface): Promise<void> {
  const next = writes.then(async () => {
    const mine = await read($, own)

    if (mine.date !== '') await $.store.set(`${PREFIX}${mine.date}:${await ownSlot($)}`, mine)
  })

  writes = next.catch(() => undefined) // 한 번 실패해도 다음 쓰기는 이어진다(실패는 부른 쪽에 그대로 알린다)

  return next
}

async function record($: EngineInterface, kind: TimelineKind, files?: number): Promise<void> {
  const at = await $.clock.now()
  const day = todayKey(at)
  const entry: TimelineEntry = { at, kind, ...(files === undefined || files === 0 ? {} : { files: Math.min(FILES_MAX, files) }) }

  await update($, own, t => ({ date: day, entries: [...(t.date === day ? t.entries : []), entry].slice(-OWN_MAX) })) // 날이 바뀌면 0부터
  await persistOwn($)
}

export function recordPrompt($: EngineInterface): Promise<void> {
  return record($, 'prompt')
}

/** 메인 대화의 턴이 끝났다: 정상(answer)이면 작업 끝, 아니면 작업 중단. 그 턴에 고친 파일 수를 함께 적는다. */
export function recordTurnEnd($: EngineInterface, reason: TurnEnd): Promise<void> {
  return record($, reason === 'answer' ? 'done' : 'stopped', turnFiles.size)
}

/**
 * 저장소의 다른 칸들을 읽어 합치고, 지난 날의 칸은 지운다. 1분마다와 시작할 때 부른다.
 * 끝에 내 칸을 한 번 더 써서, 겹쳐 쓰다 사라진 쓰기가 있었다면 바로잡는다.
 */
export async function syncTimeline($: EngineInterface): Promise<void> {
  const day = todayKey(await $.clock.now())
  const mine = await ownSlot($)
  const live: string[] = []
  const stale: string[] = []

  for (const key of await $.store.keys()) {
    if (!key.startsWith(PREFIX)) continue
    const [, keyDay = '', id = ''] = key.split(':')

    if (keyDay !== day) stale.push(key)
    else if (id !== mine) live.push(key)
  }
  const parts: TimelineEntry[] = []

  for (const key of live) {
    const value = await $.store.get(key)

    if (isDay(value) && value.date === day) parts.push(...cleanEntries(value.entries))
  }
  for (const key of stale.slice(0, PRUNE_MAX)) await $.store.delete(key)
  await update($, others, () => parts)
  if ((await read($, own)).date === day) await persistOwn($)
}

/** 화면에 보일 오늘 기록: 이 채팅 + 다른 채팅, 최근 것이 위(최대 10개)와 오늘의 전체 개수. */
export async function readTimeline($: EngineInterface): Promise<{ entries: TimelineEntry[]; count: number }> {
  const day = todayKey(await $.clock.now())
  const mine = await read($, own)
  const all = [...(mine.date === day ? mine.entries : []), ...(await read($, others))].filter(entry => todayKey(entry.at) === day).sort((a, b) => b.at - a.at)

  return { entries: all.slice(0, SHOWN), count: all.length }
}
