import type { Usage } from '../types'
import { fmtReset } from './format'
import type { Scene } from './scenes'
import { svgText, WARN_COLOR, WARN_PERCENT } from './svg'
import { TEXT_PRIMARY } from './theme'

// 좌표계는 340칸 폭. 패널 폭에 맞춰 줄어들어 그려지므로 글자는 화면에서 쓸 크기보다 조금 크게 잡는다.
export const LIMITS_WIDTH = 340
export const LIMITS_HEIGHT = 130

const SEGMENTS = 40
const GROUP = 64 // 한도 하나(이름·수치·막대·리셋)가 쓰는 높이

const segments = (y: number, percent: number, color: string): string => {
  const filled = Math.round((SEGMENTS * percent) / 100)

  return Array.from({ length: SEGMENTS }, (_, i) => {
    const fill = i < filled ? `fill="${color}"` : 'fill="#ffffff" fill-opacity=".12"'

    return `<rect x="${12 + i * 8}" y="${y}" width="6" height="8" ${fill} shape-rendering="crispEdges"/>`
  }).join('')
}

/**
 * 5시간·주간 한도. 한도마다 한 덩어리: 이름(왼쪽)과 쓴 %(오른쪽, 크게), 칸 막대, 리셋까지 남은 시간(작게).
 * 막대는 "쓴 양"이다. 남은 양이 아니다.
 */
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
      const y = 4 + i * GROUP

      return (
        svgText(12, y + 16, name, 15, TEXT_PRIMARY, 600) +
        svgText(328, y + 16, limit === undefined ? '정보 없음' : `${Math.round(limit.percentUsed)}% 사용`, 17, color, 700, 'end') +
        segments(y + 26, percent, color) +
        svgText(12, y + 53, reset, 13, scene.muted)
      )
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIMITS_WIDTH} ${LIMITS_HEIGHT}" ` +
    `width="${LIMITS_WIDTH}" height="${LIMITS_HEIGHT}">${body}</svg>`
  )
}
