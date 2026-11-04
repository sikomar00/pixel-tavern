import type { SceneId } from '../../types'
import { attic } from './attic'
import { dungeon } from './dungeon'
import { neon } from './neon'
import { tearoom } from './tearoom'

export type SceneArt = {
  base: string
  scene: string
  gauges: readonly string[]
  labelSvg: string
  labelName: string
  strip: string
}

export const ART: Record<SceneId, SceneArt> = { attic, tearoom, dungeon, neon }

const LEVELS = 20 // 게이지 그림은 5% 단위

/** 컨텍스트 사용률을 그림 속 게이지와 글자로 끼워 넣은 SVG. null이면 빈 게이지에 `-`. */
export const composeScene = (art: SceneArt, percent: number | null): string => {
  const level = Math.min(LEVELS, Math.max(0, Math.round((percent ?? 0) / 5)))
  const label = art.labelSvg.replace('{{P}}%', percent === null ? '-' : `${Math.round(percent)}%`)

  return art.scene.replace('<!--G-->', (art.gauges[level] ?? '') + label)
}
