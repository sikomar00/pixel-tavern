// 그림의 움직임은 모두 "요소 바로 안의 <animate…/> 하나"다(tools/artlib.py의 blink·frames·drift, 장면별 불빛 깜박임).
// 정지 그림은 그 첫 값을 요소의 속성으로 굳히고 <animate>를 지운다: 깜박임은 켜진 모양, 프레임은 첫 프레임만 보이고, 이동은 처음 자리.
import type { Motion } from '../types'

const MOVING = /<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*>\s*<(animateTransform|animate)((?:\s+[\w-]+="[^"]*")*)\s*\/>/g

const valueOf = (attrs: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1]

/** 속성이 이미 있으면 값을 바꾸고 없으면 붙인다(같은 속성이 두 번 나오면 SVG가 깨진다). */
const withAttr = (attrs: string, name: string, value: string): string => {
  const own = new RegExp(`(\\s${name}=")[^"]*(")`)

  return own.test(attrs) ? attrs.replace(own, (_, open: string, close: string) => open + value + close) : `${attrs} ${name}="${value}"`
}

/** 움직임 태그 하나를 첫 값으로 굳힌 열린 태그로 바꾼다. */
const freeze = (tag: string, attrs: string, kind: string, motion: string): string => {
  const name = valueOf(motion, 'attributeName')
  const first = valueOf(motion, 'values')?.split(';')[0]

  if (name === undefined || first === undefined) return `<${tag}${attrs}>`
  const value = kind === 'animateTransform' ? `${valueOf(motion, 'type') ?? 'translate'}(${first})` : first

  return `<${tag}${withAttr(attrs, name, value)}>`
}

/** isStill이 참이면 움직이는 그림을 멈춘 그림으로 바꾼다. 거짓이면 그대로 돌려준다. */
export const stillSvg = (svg: string, isStill: boolean): string => (isStill ? svg.replace(MOVING, (_, tag: string, attrs: string, kind: string, motion: string) => freeze(tag, attrs, kind, motion)) : svg)

/**
 * 효과 강도에 맞게 그림을 바꾼다. 보통(full)은 그대로, 끔(off)은 모두 멈추고, 약하게(low)는 큰 움직임(프레임 묶음 `<g>`·이동)만 멈추고
 * 등불 같은 깜박임(`<rect>`·`<path>` 등 요소 하나의 투명도)은 남긴다.
 */
export const motionSvg = (svg: string, motion: Motion): string => {
  if (motion === 'full') return svg
  if (motion === 'off') return stillSvg(svg, true)

  return svg.replace(MOVING, (whole, tag: string, attrs: string, kind: string, anim: string) => (tag === 'g' || kind === 'animateTransform' ? freeze(tag, attrs, kind, anim) : whole))
}
