import type { Usage } from '../types'
import { fmtReset } from './format'
import type { Scene } from './scenes'
import { svgText, WARN_COLOR, WARN_PERCENT } from './svg'

export const LIMITS_WIDTH = 340
export const LIMITS_HEIGHT = 84

const SEGMENTS = 40

const segments = (y: number, percent: number, color: string): string => {
  const filled = Math.round((SEGMENTS * percent) / 100)

  return Array.from({ length: SEGMENTS }, (_, i) => {
    const fill = i < filled ? `fill="${color}"` : 'fill="#ffffff" fill-opacity=".12"'

    return `<rect x="${8 + i * 8}" y="${y}" width="6" height="8" ${fill} shape-rendering="crispEdges"/>`
  }).join('')
}

/** 5시간·주간 한도: 이름과 사용 %, 칸 막대, 리셋까지 남은 시간. */
export const limitsSvg = (scene: Scene, usage: Usage | null, now: number): string => {
  const rows = [
    { name: scene.gauges.fiveHour, kind: 'five_hour' },
    { name: scene.gauges.week, kind: 'seven_day' },
  ]
  const body = rows
    .map(({ name, kind }, i) => {
      const limit = usage?.limits.find(l => l.kind === kind)
      const percent = Math.min(100, limit?.percentUsed ?? 0)
      const color = percent >= WARN_PERCENT ? WARN_COLOR : scene.accent
      const reset = limit?.resetsAt === undefined ? '리셋 정보 없음' : `${fmtReset(limit.resetsAt, now)} 뒤 리셋`
      const y = i * 42

      return (
        svgText(8, y + 13, name, 12, scene.muted, 700) +
        svgText(332, y + 13, limit === undefined ? '정보 없음' : `${Math.round(limit.percentUsed)}% 사용`, 12, color, 700, 'end') +
        segments(y + 18, percent, color) +
        svgText(8, y + 38, reset, 11, scene.muted)
      )
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIMITS_WIDTH} ${LIMITS_HEIGHT}" ` +
    `width="${LIMITS_WIDTH}" height="${LIMITS_HEIGHT}">${body}</svg>`
  )
}
