import type { Brightness, Motion, Reaction } from '../types'

// 그림의 밝기와 효과(작업 끝·테스트 결과 반응의 반짝임). 데스크톱은 SVG 위에 사각형을 덮고, 터미널은 칸 색을 직접 바꾼다.

export const MOTIONS: readonly Motion[] = ['full', 'low', 'off']
export const BRIGHTNESSES: readonly Brightness[] = ['normal', 'bright', 'dim']

export const isMotion = (value: unknown): value is Motion => MOTIONS.includes(value as Motion)
export const isBrightness = (value: unknown): value is Brightness => BRIGHTNESSES.includes(value as Brightness)

export const MOTION_LABEL: Record<Motion, string> = { full: '효과 보통', low: '효과 약하게', off: '효과 끔' }
export const BRIGHTNESS_LABEL: Record<Brightness, string> = { normal: '밝기 보통', bright: '밝기 밝게', dim: '밝기 어둡게' }

/** 다음 단계(끝에서 처음으로). 버튼을 누를 때마다 한 단계씩 돈다. */
export const nextOf = <T>(order: readonly T[], current: T): T => order[(order.indexOf(current) + 1) % order.length] ?? order[0] ?? current

/** 반응(작업 끝·테스트 결과)의 배너 문구와 종류. 실패·오류는 경고색, 중단은 흐리게, 나머지는 강조색이다. */
export const REACTION_TEXT: Record<Exclude<Reaction, ''>, { text: string; tone: 'good' | 'bad' | 'quiet' }> = {
  done: { text: '✓ 작업 끝', tone: 'good' },
  stopped: { text: '○ 작업 중단', tone: 'quiet' },
  failed: { text: '✕ 작업 실패', tone: 'bad' },
  testPass: { text: '✓ 테스트 통과', tone: 'good' },
  testFail: { text: '✕ 테스트 실패', tone: 'bad' },
}

const SHADE_SVG = { dim: { color: '#000000', alpha: 0.38 }, bright: { color: '#ffffff', alpha: 0.14 } } as const
const FLASH_SECONDS = 3

/** 그림 밝기를 바꾸는 덮개 사각형(보통이면 빈 글자). 그림 위, 게이지·글자 아래에 끼운다. */
export const shadeSvg = (brightness: Brightness, width: number, height: number): string =>
  brightness === 'normal' ? '' : `<rect width="${width}" height="${height}" fill="${SHADE_SVG[brightness].color}" fill-opacity="${SHADE_SVG[brightness].alpha}"/>`

/** 반응이 있을 때 3초 동안 밝아졌다 돌아오는 사각형(실패·오류는 붉게). 효과가 꺼져 있거나 반응이 없으면 빈 글자. */
export const flashSvg = (reaction: Reaction, motion: Motion, width: number, height: number): string => {
  if (reaction === '' || motion === 'off') return ''
  const color = REACTION_TEXT[reaction].tone === 'bad' ? '#ff7a7a' : '#ffffff'

  return `<rect width="${width}" height="${height}" fill="${color}" fill-opacity="0"><animate attributeName="fill-opacity" values="0.4;0" dur="${FLASH_SECONDS}s"/></rect>`
}

const channel = (color: number, shift: number): number => (color >> shift) & 255

/** 터미널 칸 색(0xRRGGBB)의 밝기: 어둡게는 62%로, 밝게는 흰색 쪽으로 16%. */
export const shadeColor = (color: number, brightness: Brightness): number => {
  if (brightness === 'normal') return color
  const mix = (shift: number): number => {
    const value = channel(color, shift)

    return Math.round(brightness === 'dim' ? value * 0.62 : value + (255 - value) * 0.16)
  }

  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}
