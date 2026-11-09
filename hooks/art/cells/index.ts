import type { SceneId } from '../../../types'
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

/**
 * 터미널용 칸 그림 데이터(tools/gen_art.py가 만든다). 칸은 팔레트 번호 한 글자로 적는다.
 * rows: 장면 그림(게이지 0%) 85x74. gauge: 게이지가 바뀌는 상자(x, y에서 시작)의 단계별(0~20) 칸 줄.
 * emblem: 배너 띠 왼쪽 엠블럼 12x10.
 */
export type SceneCells = {
  palette: readonly string[]
  rows: readonly string[]
  gauge: { x: number; y: number; levels: readonly (readonly string[])[] }
  emblem: readonly string[]
}

export const CELLS: Record<SceneId, SceneCells> = { attic, tearoom, dungeon, neon, jazz, camp, library, arcade, drive, station, rooftop }
