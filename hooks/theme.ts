import type { Scene } from './scenes'

/**
 * 간격 체계. 데스크톱은 이름(xs~xl)마다 자기 크기로 그린다.
 * 같은 성격의 요소는 늘 같은 단계를 쓴다.
 */
export type Gap = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export const SPACE: Record<'edge' | 'band' | 'stack' | 'line' | 'control', Gap> = {
  edge: 'md', // 구역 안쪽 좌우 여백
  band: 'md', // 구역 안쪽 위아래 여백
  stack: 'sm', // 한 구역 안에서 덩어리 사이(머리글 ↔ 내용, 내용 ↔ 내용)
  line: 'xs', // 같은 덩어리 안의 줄 사이
  control: 'sm', // 버튼·칩 사이
}

/** 밝은 글자(주요 정보)와 SVG 안 글자에 쓰는 색. 보조 글자는 장면의 muted를 쓴다. */
export const TEXT_PRIMARY = '#f2f0f7'

/** hex 색에 흰색을 amount(0~1)만큼 섞는다. 카드 배경을 "바탕보다 한 단계 밝게" 만들 때 쓴다. */
export const lift = (hex: string, amount: number): string => {
  const mix = (offset: number): string => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16)

    return Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')
  }

  return `#${mix(1)}${mix(3)}${mix(5)}`
}

/** 카드(음악·사용량)와 숫자 칸의 배경. */
export const surfaceOf = (scene: Scene): string => lift(scene.base, 0.07)

/** 카드 안의 작은 칩(git 상태 등)의 배경. */
export const chipOf = (scene: Scene): string => lift(scene.base, 0.15)
