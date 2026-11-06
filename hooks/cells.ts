import type { Brightness } from '../types'
import { gaugeLevel } from './art'
import type { SceneCells } from './art/cells'
import { shadeColor } from './effects'

// 터미널의 색 블록 그림(Raster)을 만드는 순수 함수들. 데이터(`art/cells/<장면>.ts`)는 tools/gen_art.py가 만든 칸 그림이고,
// 칸 하나는 팔레트 번호 한 글자다. 글자 칸 하나에 위아래 두 칸을 담는다(▀: 글자색 = 위 칸, 배경색 = 아래 칸).

/** [y][x] = 0xRRGGBB. */
export type Pixels = number[][]

export type Picture = { columns: number; rows: number; cells: string }

/** tools/cellart.py의 SYMBOLS와 같은 표: 큰따옴표·역슬래시·작은따옴표·백틱·$를 뺀 눈에 보이는 ASCII 89개. */
export const SYMBOLS = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i))
  .filter(char => !'"\\\'`$'.includes(char))
  .join('')

export const SCENE_COLUMNS = 85 // 장면 그림의 가로 칸 수(원본)

const HALF_BLOCK = 0x2580 // ▀

export const hexToInt = (hex: string): number => parseInt(hex.slice(1), 16)

const decodeRow = (colors: number[], text: string): number[] => Array.from(text, char => colors[SYMBOLS.indexOf(char)] ?? 0)

/** 장면 그림에 게이지 단계(컨텍스트 %)를 끼운 칸 격자. */
export const sceneGrid = (cells: SceneCells, percent: number | null): Pixels => {
  const colors = cells.palette.map(hexToInt)
  const grid = cells.rows.map(row => decodeRow(colors, row))
  const { x, y, levels } = cells.gauge
  const crop = levels[gaugeLevel(percent)] ?? []

  crop.forEach((text, dy) =>
    decodeRow(colors, text).forEach((color, dx) => {
      const row = grid[y + dy]

      if (row !== undefined) row[x + dx] = color
    }),
  )

  return grid
}

export const emblemGrid = (cells: SceneCells): Pixels => {
  const colors = cells.palette.map(hexToInt)

  return cells.emblem.map(row => decodeRow(colors, row))
}

const brightness = (color: number): number => ((color >> 16) & 255) * 0.299 + ((color >> 8) & 255) * 0.587 + (color & 255) * 0.114

/** 블록 안에서 가장 많은 색(같으면 더 밝은 색: 작은 불빛이 어둠에 먹히지 않게). */
const dominant = (colors: number[], fill: number): number => {
  const counts = new Map<number, number>()

  for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1)
  let best = fill
  let bestCount = 0

  for (const [color, count] of counts) {
    if (count > bestCount || (count === bestCount && brightness(color) > brightness(best))) {
      best = color
      bestCount = count
    }
  }

  return best
}

/** 가로·세로 factor칸을 한 칸으로 줄인다(factor 1이면 그대로). 모자라는 가장자리는 있는 칸만 센다. */
export const shrink = (grid: Pixels, factor: number, fill: number): Pixels => {
  if (factor <= 1) return grid
  const width = Math.ceil((grid[0]?.length ?? 0) / factor)
  const height = Math.ceil(grid.length / factor)

  return Array.from({ length: height }, (_, by) =>
    Array.from({ length: width }, (_, bx) => {
      const block: number[] = []

      for (let y = by * factor; y < (by + 1) * factor; y += 1) {
        for (let x = bx * factor; x < (bx + 1) * factor; x += 1) {
          const color = grid[y]?.[x]

          if (color !== undefined) block.push(color)
        }
      }

      return dominant(block, fill)
    }),
  )
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 표준 base64(= 채움 포함). 엔진 실행 환경의 `toBase64`에 기대지 않고 직접 만든다. */
export const base64 = (bytes: Uint8Array): string => {
  const out: string[] = []

  for (let i = 0; i < bytes.length; i += 3) {
    const word = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)

    out.push(
      BASE64.charAt((word >> 18) & 63),
      BASE64.charAt((word >> 12) & 63),
      i + 1 < bytes.length ? BASE64.charAt((word >> 6) & 63) : '=',
      i + 2 < bytes.length ? BASE64.charAt(word & 63) : '=',
    )
  }

  return out.join('')
}

/**
 * 칸 격자를 Raster의 cells로: 글자 칸마다 [글자, 글자색, 배경색] 세 개의 u32(리틀 엔디언)를 이어 붙인 뒤 base64.
 * 줄 수가 홀수면 마지막 줄은 fill로 채운다.
 */
export const halfBlocks = (grid: Pixels, fill: number): Picture => {
  const columns = grid[0]?.length ?? 0
  const rows = Math.ceil(grid.length / 2)
  const bytes = new Uint8Array(columns * rows * 12)
  const view = new DataView(bytes.buffer)
  let at = 0

  for (let row = 0; row < rows; row += 1) {
    for (let x = 0; x < columns; x += 1) {
      view.setUint32(at, HALF_BLOCK, true)
      view.setUint32(at + 4, grid[row * 2]?.[x] ?? fill, true)
      view.setUint32(at + 8, grid[row * 2 + 1]?.[x] ?? fill, true)
      at += 12
    }
  }

  return { columns, rows, cells: base64(bytes) }
}

/** 쓸 수 있는 글자 칸 수에 맞는 줄임 배율: 85칸이 들어가면 1, 43칸이 들어가면 2, 아니면 4. */
export const shrinkFor = (available: number): number => (available >= SCENE_COLUMNS ? 1 : available >= Math.ceil(SCENE_COLUMNS / 2) ? 2 : 4)

const shaded = (grid: Pixels, brightness: Brightness): Pixels => (brightness === 'normal' ? grid : grid.map(row => row.map(color => shadeColor(color, brightness))))

/** 패널 장면 그림. `available`은 패널 본문의 글자 칸 수, `fill`은 장면 바탕색, `brightness`는 그림 밝기. */
export const scenePicture = (cells: SceneCells, percent: number | null, available: number, fill: number, brightness: Brightness = 'normal'): Picture =>
  halfBlocks(shaded(shrink(sceneGrid(cells, percent), shrinkFor(available), fill), brightness), shadeColor(fill, brightness))

/** 배너 왼쪽 엠블럼(12x5 글자 칸). */
export const emblemPicture = (cells: SceneCells, fill: number, brightness: Brightness = 'normal'): Picture => halfBlocks(shaded(emblemGrid(cells), brightness), shadeColor(fill, brightness))
