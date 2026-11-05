import type { Usage } from '../types'
import { fmtReset, fmtTokens, isPast } from './format'
import type { Scene } from './scenes'
import { clipWidth, svgText, WARN_COLOR, WARN_PERCENT } from './svg'
import { TEXT_PRIMARY } from './theme'

// 좌표계는 340칸 폭. 패널 폭에 맞춰 줄어들어 그려지므로 글자는 화면에서 쓸 크기보다 조금 크게 잡는다.
export const USAGE_WIDTH = 340
export const USAGE_HEIGHT = 152

const SEGMENTS = 20 // 원 하나를 5% 단위 칸 20개로 나눈다
const RADIUS = 36
const STROKE = 9
const COLUMN = USAGE_WIDTH / 3
const CENTER_Y = 50
const NAME_WIDTH = 110 // 이름이 이웃 원 쪽으로 넘치지 않는 폭

/** 기능 이름이 먼저, 테마 이름(장면마다 다름)은 그 아래 작게. 테마 이름만 보고 뜻을 짐작하게 하지 않는다. */
type Gauge = { name: string; theme: string; percent: number | null; sub: string; isStale?: boolean }

const themeOf = (name: string): string => name.split(' · ')[0] ?? name

const gaugesOf = (scene: Scene, usage: Usage | null, now: number): Gauge[] => {
  const limit = (kind: string) => usage?.limits.find(l => l.kind === kind)
  const reset = (kind: string): string => {
    const found = limit(kind)

    if (found === undefined) return '정보 없음'

    return found.resetsAt === undefined ? '리셋 정보 없음' : `${fmtReset(found.resetsAt, now)} 뒤 리셋`
  }
  // 리셋 시각이 지난 한도: 사용량은 옛 값이라 보이지 않고, 다음 응답이 와야 갱신된다.
  const limitGauge = (kind: string, name: string, theme: string): Gauge => {
    const found = limit(kind)

    if (found !== undefined && isPast(found.resetsAt, now)) return { name, theme, percent: null, sub: '응답 후 갱신', isStale: true }

    return { name, theme, percent: found?.percentUsed ?? null, sub: reset(kind) }
  }
  const tokens = usage?.tokens ?? null

  return [
    {
      name: '컨텍스트',
      theme: themeOf(scene.gauges.context),
      percent: usage?.percent ?? null,
      sub: tokens === null ? '' : `${fmtTokens(tokens)}/${fmtTokens(usage?.window ?? 0)}`,
    },
    limitGauge('five_hour', '5시간 한도', themeOf(scene.gauges.fiveHour)),
    limitGauge('seven_day', '주간 한도', themeOf(scene.gauges.week)),
  ]
}

/**
 * 채울 칸 수. 한 칸이 5%라서 칸 수와 실제 %는 최대 2.5%p 어긋난다(가운데 숫자가 정확한 값이다).
 * 눈속임을 막는 두 규칙: 쓰기 시작했으면 한 칸은 채우고, 100% 미만이면 꽉 찬 원으로 보이지 않게 한다.
 */
export const filledSegments = (percent: number): number => {
  if (percent >= 100) return SEGMENTS
  const rounded = Math.round((SEGMENTS * percent) / 100)

  if (percent > 0 && rounded === 0) return 1

  return Math.min(SEGMENTS - 1, rounded)
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
  const filled = filledSegments(percent)

  return Array.from({ length: SEGMENTS }, (_, i) => {
    const stroke = i < filled ? `stroke="${color}"` : 'stroke="#ffffff" stroke-opacity=".12"'

    return `<path d="${arc(cx, i * step + 1.5, (i + 1) * step - 1.5)}" fill="none" ${stroke} stroke-width="${STROKE}"/>`
  }).join('')
}

const gaugeSvg = (g: Gauge, index: number, scene: Scene): string => {
  const cx = COLUMN * index + COLUMN / 2
  const percent = Math.max(0, g.percent ?? 0)
  const color = percent >= WARN_PERCENT ? WARN_COLOR : scene.accent
  const hasValue = g.percent !== null

  return (
    ring(cx, percent, color) +
    (g.isStale === true
      ? svgText(cx, CENTER_Y + 5, '리셋됨', 14, scene.muted, 700, 'middle')
      : svgText(cx, CENTER_Y + 6, hasValue ? `${Math.round(percent)}%` : '-', 19, color, 700, 'middle')) +
    (hasValue ? svgText(cx, CENTER_Y + 20, '사용', 11, scene.muted, 400, 'middle') : '') +
    svgText(cx, 108, clipWidth(g.name, 14, NAME_WIDTH), 14, TEXT_PRIMARY, 600, 'middle') +
    svgText(cx, 124, clipWidth(g.theme, 11.5, NAME_WIDTH), 11.5, scene.muted, 400, 'middle') +
    svgText(cx, 143, g.sub, 12.5, scene.muted, 400, 'middle')
  )
}

/**
 * 사용량 원 3개를 한 줄에: 컨텍스트 · 5시간 한도 · 주간 한도. 원은 "쓴 양"이다(남은 양이 아니다).
 * 가운데는 쓴 %, 아래는 기능 이름 · 테마 이름 · 토큰 수 또는 리셋까지 남은 시간.
 */
export const usageSvg = (scene: Scene, usage: Usage | null, now: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${USAGE_WIDTH} ${USAGE_HEIGHT}" width="${USAGE_WIDTH}" height="${USAGE_HEIGHT}">` +
  gaugesOf(scene, usage, now)
    .map((g, i) => gaugeSvg(g, i, scene))
    .join('') +
  '</svg>'
