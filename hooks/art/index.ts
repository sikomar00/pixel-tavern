import type { SceneId } from '../../types'
import { arcade } from './arcade'
import { attic } from './attic'
import { camp } from './camp'
import { drive } from './drive'
import { dungeon } from './dungeon'
import { jazz } from './jazz'
import { library } from './library'
import { neon } from './neon'
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

export const ART: Record<SceneId, SceneArt> = { attic, tearoom, dungeon, neon, jazz, camp, library, arcade, drive, station }

const LEVELS = 20 // 게이지 그림은 5% 단위

/** 컨텍스트 사용률(null이면 0)이 가리키는 게이지 단계(0~20). */
export const gaugeLevel = (percent: number | null): number => Math.min(LEVELS, Math.max(0, Math.round((percent ?? 0) / 5)))

/** 컨텍스트 사용률을 그림 속 게이지와 글자로 끼워 넣은 SVG. null이면 빈 게이지에 `-`. */
export const composeScene = (art: SceneArt, percent: number | null): string => {
  const level = gaugeLevel(percent)
  const label = art.labelSvg.replace('{{P}}%', percent === null ? '-' : `${Math.round(percent)}%`)

  return art.scene.replace('<!--G-->', (art.gauges[level] ?? '') + label)
}
