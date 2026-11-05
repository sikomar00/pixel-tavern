export const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif"

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const svgText = (
  x: number,
  y: number,
  s: string,
  size: number,
  fill: string,
  weight = 400,
  anchor: 'start' | 'middle' | 'end' = 'start',
): string =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ` +
  `text-anchor="${anchor}" font-family="${FONT}">${esc(s)}</text>`

export const clip = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s

/** 한도가 이 값 이상이면 배너와 패널이 같은 경고색으로 그린다. */
export const WARN_PERCENT = 85
export const WARN_COLOR = '#ff7a7a' // 4개 장면의 배경·카드 위에서 글자 대비 4.5 이상

const HANGUL_OR_HAN = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u4e00-\u9fff]/

const NARROW = /[\s.,:;·'|!]/

const emOf = (ch: string): number => {
  if (HANGUL_OR_HAN.test(ch)) return 1

  return NARROW.test(ch) ? 0.3 : 0.58
}

/** 글자 폭(칸). 한글은 1em, 공백·구두점은 0.3em, 나머지 영문·숫자는 0.58em로 센다. */
export const textWidth = (s: string, size: number): number =>
  Array.from(s).reduce((sum, ch) => sum + emOf(ch) * size, 0)

/** 글자 폭(칸)이 maxWidth를 넘으면 …로 자른다. */
export const clipWidth = (s: string, size: number, maxWidth: number): string => {
  const chars = Array.from(s)
  const widths = chars.map(ch => emOf(ch) * size)

  if (textWidth(s, size) <= maxWidth) return s
  let used = 0.6 * size // 말줄임표 자리
  let end = 0

  while (end < chars.length && used + (widths[end] ?? 0) <= maxWidth) {
    used += widths[end] ?? 0
    end += 1
  }

  return `${chars.slice(0, end).join('')}…`
}
