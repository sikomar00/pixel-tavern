import type { SceneId } from '../../types'
import { arcade } from './arcade'
import { attic } from './attic'
import { camp } from './camp'
import { drive } from './drive'
import { dungeon } from './dungeon'
import { jazz } from './jazz'
import { library } from './library'
import { neon } from './neon'
import { rooftop } from './rooftop'
import { station } from './station'
import { tearoom } from './tearoom'

export type SceneArt = {
  base: string
  scene: string
  gauges: readonly string[]
  labelSvg: string
  labelName: string
  strip: string
}

export const ART: Record<SceneId, SceneArt> = { attic, tearoom, dungeon, neon, jazz, camp, library, arcade, drive, station, rooftop }

const LEVELS = 20 // 게이지 그림은 5% 단위

/** 컨텍스트 사용률(null이면 0)이 가리키는 게이지 단계(0~20). */
export const gaugeLevel = (percent: number | null): number => Math.min(LEVELS, Math.max(0, Math.round((percent ?? 0) / 5)))

/** 컨텍스트 사용률을 그림 속 게이지와 글자로 끼워 넣은 SVG. null이면 빈 게이지에 `-`. */
export const composeScene = (art: SceneArt, percent: number | null, overlay = ''): string => {
  const level = gaugeLevel(percent)
  const label = art.labelSvg.replace('{{P}}%', percent === null ? '-' : `${Math.round(percent)}%`)

  // overlay(밝기 덮개·반짝임)는 게이지 자리 바로 앞에 끼운다: 그림은 어둡게·밝게 되고 게이지와 글자는 그대로 또렷하다.
  return art.scene.replace('<!--G-->', overlay + (art.gauges[level] ?? '') + label)
}
