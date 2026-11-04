// 음량은 1~5단계로 고른다. 단계마다 MediaPlayer 음량(0~1)이 정해져 있다.
export const VOLUME_GAIN = [0.1, 0.25, 0.4, 0.6, 0.85] as const
export const MIN_VOLUME = 1
export const MAX_VOLUME = VOLUME_GAIN.length
export const DEFAULT_VOLUME = 3 // 0.4: 음량 조절이 없던 때의 고정값과 같다

export const isVolume = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= MIN_VOLUME && v <= MAX_VOLUME

/** 재생기가 환경변수로 받는 글자 값. */
export const gainOf = (level: number): string => String(VOLUME_GAIN[level - 1] ?? VOLUME_GAIN[DEFAULT_VOLUME - 1])
