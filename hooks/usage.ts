import type { Usage } from '../types'
import { fmtReset, fmtTokens } from './format'
import type { Scene } from './scenes'
import { clipWidth, svgText, WARN_COLOR, WARN_PERCENT } from './svg'
import { TEXT_PRIMARY } from './theme'

// 좌표계는 340칸 폭. 패널 폭에 맞춰 줄어들어 그려지므로 글자는 화면에서 쓸 크기보다 조금 크게 잡는다.
export const USAGE_WIDTH = 340
export const USAGE_HEIGHT = 134

const SEGMENTS = 20 // 원 하나를 5% 단위 칸 20개로 나눈다
const RADIUS = 36
const STROKE = 9
const COLUMN = USAGE_WIDTH / 3
const CENTER_Y = 50
const NAME_WIDTH = 110 // 이름이 이웃 원 쪽으로 넘치지 않는 폭

type Gauge = { name: string; percent: number | null; sub: string }

const gaugesOf = (scene: Scene, usage: Usage | null, now: number): Gauge[] => {
  const limit = (kind: string) => usage?.limits.find(l => l.kind === kind)
  const reset = (kind: string): string => {
    const found = limit(kind)

    if (found === undefined) return '정보 없음'

    return found.resetsAt === undefined ? '리셋 정보 없음' : `${fmtReset(found.resetsAt, now)} 뒤 리셋`
  }
  const tokens = usage?.tokens ?? null

  return [
    {
      name: scene.gauges.context,
      percent: usage?.percent ?? null,
      sub: tokens === null ? '' : `${fmtTokens(tokens)}/${fmtTokens(usage?.window ?? 0)}`,
    },
    { name: scene.gauges.fiveHour, percent: limit('five_hour')?.percentUsed ?? null, sub: reset('five_hour') },
    { name: scene.gauges.week, percent: limit('seven_day')?.percentUsed ?? null, sub: reset('seven_day') },
  ]
}

/** 12시에서 시계 방향으로 도는 호 하나(각도는 도). */
const arc = (cx: number, from: number, to: number): string => {
  const point = (deg: number): string => {
    const rad = ((deg - 90) * Math.PI) / 180

    return `${(cx + RADIUS * Math.cos(rad)).toFixed(2)} ${(CENTER_Y + RADIUS * Math.sin(rad)).toFixed(2)}`
  }

  return `M${point(from)}A${RADIUS} ${RADIUS} 0 0 1 ${point(to)}`
}

/** 쓴 만큼 색이 채워진 칸 원. 칸 사이는 비워 픽셀 느낌을 낸다. */
const ring = (cx: number, percent: number, color: string): string => {
  const step = 360 / SEGMENTS
  const filled = Math.round((SEGMENTS * percent) / 100)

  return Array.from({ length: SEGMENTS }, (_, i) => {
    const stroke = i < filled ? `stroke="${color}"` : 'stroke="#ffffff" stroke-opacity=".12"'

    return `<path d="${arc(cx, i * step + 1.5, (i + 1) * step - 1.5)}" fill="none" ${stroke} stroke-width="${STROKE}"/>`
  }).join('')
}

const gaugeSvg = (g: Gauge, index: number, scene: Scene): string => {
  const cx = COLUMN * index + COLUMN / 2
  const percent = Math.min(100, g.percent ?? 0)
  const color = percent >= WARN_PERCENT ? WARN_COLOR : scene.accent
  const hasValue = g.percent !== null

  return (
    ring(cx, percent, color) +
    svgText(cx, CENTER_Y + 6, hasValue ? `${Math.round(g.percent ?? 0)}%` : '-', 18, color, 700, 'middle') +
    (hasValue ? svgText(cx, CENTER_Y + 20, '사용', 10.5, scene.muted, 400, 'middle') : '') +
    svgText(cx, 109, clipWidth(g.name, 13, NAME_WIDTH), 13, TEXT_PRIMARY, 600, 'middle') +
    svgText(cx, 126, g.sub, 12, scene.muted, 400, 'middle')
  )
}

/**
 * 사용량 원 3개를 한 줄에: 컨텍스트 · 5시간 · 주간. 원은 "쓴 양"이다(남은 양이 아니다).
 * 가운데는 쓴 %, 아래는 이름, 그 아래는 토큰 수 또는 리셋까지 남은 시간.
 */
export const usageSvg = (scene: Scene, usage: Usage | null, now: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${USAGE_WIDTH} ${USAGE_HEIGHT}" width="${USAGE_WIDTH}" height="${USAGE_HEIGHT}">` +
  gaugesOf(scene, usage, now)
    .map((g, i) => gaugeSvg(g, i, scene))
    .join('') +
  '</svg>'
