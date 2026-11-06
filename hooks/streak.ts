import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Streak } from '../types'
import { todayKey } from './format'

// 연속 기록: 프롬프트를 보낸 날을 "일한 날"로 세고, 며칠 연속인지(하루라도 빠지면 0부터)와 최고 기록을 보인다. 점수가 아니라 날짜 기록이다.
// 저장하는 것은 마지막으로 일한 날(날짜), 연속 일수, 최고 일수 숫자뿐이다(프롬프트·경로·시각은 없다). 모든 채팅이 한 키(`streak`)를 쓰지만
// 같은 날에는 누가 써도 같은 값이라(오늘 이미 기록했으면 아무것도 쓰지 않는다) 서로 덮어써도 사라지는 것이 없다.
const EMPTY: Streak = { last: '', count: 0, best: 0 }
const streak = atom({ plugin: 'pixel-tavern', key: 'streak' } as const, EMPTY)
const KEY = 'streak'
const DAY = /^\d{4}-\d{1,2}-\d{1,2}$/

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000

const isStreak = (value: unknown): value is Streak => {
  const s = value as Partial<Streak> | null

  return typeof s === 'object' && s !== null && typeof s.last === 'string' && (s.last === '' || DAY.test(s.last)) && isCount(s.count) && isCount(s.best)
}

/** 어제의 날짜 키(`2026-11-3`). 날짜 계산은 달력으로 해서 달·해가 바뀌어도 맞는다. */
export const dayBefore = (key: string): string => {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number)

  return todayKey(new Date(year, month - 1, day - 1).getTime())
}

/** 오늘 보이는 연속 일수: 마지막 일한 날이 오늘이거나 어제면 그 연속(오늘 아직 안 했어도 어제까지는 이어진다), 더 오래되면 0. */
export const aliveCount = (value: Streak, today: string): number => (value.last === today || value.last === dayBefore(today) ? value.count : 0)

/** 저장소의 연속 기록을 읽는다(시작할 때와 1분마다: 다른 채팅이 쓴 것을 따라간다). 모양이 틀린 값은 버린다. */
export async function loadStreak($: EngineInterface): Promise<void> {
  const stored = await $.store.get(KEY)

  if (isStreak(stored)) await update($, streak, () => stored)
}

/** 프롬프트를 보냈다: 오늘을 일한 날로 센다. 오늘 이미 셌으면 아무것도 하지 않고, 어제까지 이어졌으면 하루를 더하고, 아니면 1부터 다시 센다. */
export async function recordWorkDay($: EngineInterface): Promise<void> {
  const today = todayKey(await $.clock.now())
  const stored = await $.store.get(KEY)
  const base = isStreak(stored) ? stored : await read($, streak) // 다른 채팅이 쓴 최신 값이 있으면 그 위에 이어서 센다

  if (base.last === today) {
    await update($, streak, () => base)

    return
  }
  const count = base.last === dayBefore(today) ? base.count + 1 : 1
  const next: Streak = { last: today, count, best: Math.max(base.best, count) }

  await update($, streak, () => next)
  await $.store.set(KEY, next)
}

/** 화면에 보일 연속 기록: 지금 이어지는 일수와 최고 일수. */
export async function readStreak($: EngineInterface): Promise<{ count: number; best: number }> {
  const value = await read($, streak)
  const today = todayKey(await $.clock.now())

  return { count: aliveCount(value, today), best: value.best }
}
