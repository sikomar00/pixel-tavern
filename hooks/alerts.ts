import type { Usage } from '../types'
import { fmtReset, isPast } from './format'

const ALERT_AT = 90 // 이 %를 넘으면 한 번 알린다
const REARM_BELOW = 80 // 이 % 아래로 내려오면(컨텍스트를 정리했거나 한도가 리셋됐다) 다음에 다시 알린다

/** 이미 알렸는지. true인 동안은 같은 구간에서 다시 알리지 않는다. */
export type Alerted = { context: boolean; five_hour: boolean; seven_day: boolean }

export const NO_ALERTS: Alerted = { context: false, five_hour: false, seven_day: false }

type Reading = { key: keyof Alerted; percent: number | null; message: (percent: number) => string }

/**
 * 측정이 올 때마다 부른다. 90% 이상이 처음 되는 순간에만 알림 글을 돌려주고, 80% 아래로 내려오면 다시 알릴 준비를 한다.
 * 80~90%는 상태를 그대로 둔다(경계에서 알림이 깜박이지 않게). 리셋 시각이 지난 한도는 값이 옛 것이라 읽지 않는다.
 */
export const checkAlerts = (usage: Usage, alerted: Alerted, now: number): { messages: string[]; alerted: Alerted } => {
  const limit = (kind: string) => {
    const found = usage.limits.find(entry => entry.kind === kind)

    return found === undefined || isPast(found.resetsAt, now) ? undefined : found
  }
  const reset = (kind: string): string => fmtReset(limit(kind)?.resetsAt, now)
  const readings: Reading[] = [
    { key: 'context', percent: usage.percent, message: p => `컨텍스트가 ${p}%예요. /compact 로 정리하거나 새 채팅을 여는 게 좋아요` },
    { key: 'five_hour', percent: limit('five_hour')?.percentUsed ?? null, message: p => `5시간 한도 ${p}% 사용 · ${reset('five_hour')} 뒤 리셋` },
    { key: 'seven_day', percent: limit('seven_day')?.percentUsed ?? null, message: p => `주간 한도 ${p}% 사용 · ${reset('seven_day')} 뒤 리셋` },
  ]
  const next = { ...alerted }
  const messages: string[] = []

  for (const { key, percent, message } of readings) {
    if (percent === null || percent < REARM_BELOW) {
      next[key] = false
    } else if (percent >= ALERT_AT && !alerted[key]) {
      next[key] = true
      messages.push(message(Math.round(percent)))
    }
  }

  return { messages, alerted: next }
}
