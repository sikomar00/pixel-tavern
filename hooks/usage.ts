import type { Usage } from '../types'
import { fmtReset, fmtTokens, isPast } from './format'
import type { Scene } from './scenes'
import { clipWidth, svgText, WARN_COLOR, WARN_PERCENT } from './svg'
import { TEXT_PRIMARY } from './theme'

// 그림 1칸 = 화면 1px(앱에서 잰 값: 패널 안에서 줄어들지 않는다). 폭은 기본 340이고, 패널이 더 넓으면 usageWidthFor가 넓힌다.
export const USAGE_WIDTH = 340
const CELL_PX = 7.6 // 글자 칸 하나의 화면 폭(실측 7.7px, 조금 작게 잡아 패널보다 넓어지지 않게)
const MAX_WIDTH = 480
export const USAGE_HEIGHT = 152

const SEGMENTS = 20 // 원 하나를 5% 단위 칸 20개로 나눈다
const RADIUS = 36
const STROKE = 9
const CENTER_Y = 50

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

/** 패널 열 수에 맞는 그림 폭. 기본보다 좁은 패널에서는 기본 폭을 쓴다(그림이 줄어들며 글자도 작아진다). */
export const usageWidthFor = (columns: number): number => Math.max(USAGE_WIDTH, Math.min(MAX_WIDTH, Math.floor(columns * CELL_PX)))

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

const gaugeSvg = (g: Gauge, index: number, scene: Scene, width: number): string => {
  const column = width / 3
  const nameWidth = Math.min(130, column - 6) // 이름이 이웃 원 쪽으로 넘치지 않는 폭
  const cx = column * index + column / 2
  const percent = Math.max(0, g.percent ?? 0)
  const color = percent >= WARN_PERCENT ? WARN_COLOR : scene.accent
  const hasValue = g.percent !== null

  return (
    ring(cx, percent, color) +
    (g.isStale === true
      ? svgText(cx, CENTER_Y + 5, '리셋됨', 14, scene.muted, 700, 'middle')
      : svgText(cx, CENTER_Y + 6, hasValue ? `${Math.round(percent)}%` : '-', 19, color, 700, 'middle')) +
    (hasValue ? svgText(cx, CENTER_Y + 20, '사용', 11, scene.muted, 400, 'middle') : '') +
    svgText(cx, 108, clipWidth(g.name, 14, nameWidth), 14, TEXT_PRIMARY, 600, 'middle') +
    svgText(cx, 124, clipWidth(g.theme, 11.5, nameWidth), 11.5, scene.muted, 400, 'middle') +
    svgText(cx, 143, g.sub, 12.5, scene.muted, 400, 'middle')
  )
}

/**
 * 사용량 원 3개를 한 줄에: 컨텍스트 · 5시간 한도 · 주간 한도. 원은 "쓴 양"이다(남은 양이 아니다).
 * 가운데는 쓴 %, 아래는 기능 이름 · 테마 이름 · 토큰 수 또는 리셋까지 남은 시간.
 */
export const usageSvg = (scene: Scene, usage: Usage | null, now: number, width = USAGE_WIDTH): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${USAGE_HEIGHT}" width="${width}" height="${USAGE_HEIGHT}">` +
  gaugesOf(scene, usage, now)
    .map((g, i) => gaugeSvg(g, i, scene, width))
    .join('') +
  '</svg>'
