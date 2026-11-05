import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SceneId } from '../types'
import { SCENES, STATIONS, STATION_GROUPS } from './scenes'
import type { Station } from './scenes'

// 방송 고르기: 장면마다 기본 방송(scenes.ts)이 있고, 패널에서 다른 방송을 고르면 장면별로 기억한다.
// 즐겨찾기는 방송 단위이고 고르는 칸의 맨 위에 별과 함께 놓인다. 저장하는 것은 방송 이름표(id)뿐이다.
// 엔진의 검사는 atom을 읽고 쓰는 파일에서 atom을 찾는다: atom은 이 파일에만 두고 바깥에는 `$`를 받는 함수로만 드러낸다.
const choices = atom({ plugin: 'pixel-tavern', key: 'stationChoices' } as const, {})
const favorites = atom({ plugin: 'pixel-tavern', key: 'favoriteStations' } as const, [])
const stationTab = atom({ plugin: 'pixel-tavern', key: 'stationTab' } as const, '') // 보고 있는 묶음(저장하지 않는다)

const isStationId = (value: unknown): value is string => typeof value === 'string' && STATIONS.some(station => station.id === value)

/** 저장된 장면별 선택에서 모양이 맞는 것(알려진 장면 + 알려진 방송)만 남긴다. */
const cleanChoices = (value: unknown): Partial<Record<SceneId, string>> =>
  typeof value !== 'object' || value === null
    ? {}
    : Object.fromEntries(Object.entries(value).filter(([scene, id]) => scene in SCENES && isStationId(id)))

/** 저장된 즐겨찾기에서 알려진 방송만, 중복 없이 남긴다(방송이 목록에서 빠져도 안전하다). */
const cleanFavorites = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.filter(isStationId))] : [])

/** 세션이 시작될 때 저장소에서 장면별 선택과 즐겨찾기를 불러온다. 모양이 틀린 값은 버린다. */
export async function loadStations($: EngineInterface): Promise<void> {
  const [saved, stars] = await Promise.all([$.store.get('stationChoices'), $.store.get('favoriteStations')])

  await update($, choices, () => cleanChoices(saved))
  await update($, favorites, () => cleanFavorites(stars))
}

/** 이 장면에서 듣는 방송: 고른 것이 있으면 그것, 없으면 장면의 기본 방송. 그리는 중에 부르면 값이 바뀔 때 다시 그려진다. */
export async function readStation($: EngineInterface, sceneId: SceneId): Promise<Station> {
  const picked = (await read($, choices))[sceneId]

  return STATIONS.find(station => station.id === picked) ?? SCENES[sceneId].music
}

export function readFavorites($: EngineInterface): Promise<string[]> {
  return read($, favorites)
}

/** 이 장면의 방송을 고르고 저장소에 남긴다(알 수 없는 방송은 무시). */
export async function chooseStation($: EngineInterface, sceneId: SceneId, id: string): Promise<void> {
  if (!isStationId(id)) return
  let next: Partial<Record<SceneId, string>> = {}

  await update($, choices, current => {
    next = { ...current, [sceneId]: id }

    return next
  })
  await $.store.set('stationChoices', next)
}

/** 방송의 즐겨찾기를 켜고 끈다. 바꾸는 순간의 값에서 뒤집어 거의 동시에 두 번 눌러도 한 번이 사라지지 않는다. */
export async function toggleFavorite($: EngineInterface, id: string): Promise<void> {
  if (!isStationId(id)) return
  let next: string[] = []

  await update($, favorites, current => {
    next = current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]

    return next
  })
  await $.store.set('favoriteStations', next)
}

/** 즐겨찾기 모아 보기 버튼의 이름표(묶음 이름표와 같은 자리에 쓴다). */
export const FAVORITES_TAB = 'fav'

const isTab = (value: unknown): value is string => value === '' || value === FAVORITES_TAB || STATION_GROUPS.some(group => group.id === value)

/** 지금 보이는 묶음: 사용자가 고른 것이 있으면 그것, 없으면 지금 듣는 방송이 속한 묶음. */
export const tabOf = (picked: string, current: Station): string => (picked === '' ? current.group : picked)

/** 묶음 아래에 보이는 방송(목록 순서). 즐겨찾기 모아 보기는 즐겨찾기한 방송만. */
export const stationsIn = (tab: string, stars: string[]): Station[] =>
  tab === FAVORITES_TAB ? STATIONS.filter(station => stars.includes(station.id)) : STATIONS.filter(station => station.group === tab)

export function readStationTab($: EngineInterface): Promise<string> {
  return read($, stationTab)
}

/** 보이는 묶음을 바꾼다(빈 글자는 "지금 방송의 묶음"). 저장하지 않는다: 보기만 바꾸는 것이다. */
export async function showStationTab($: EngineInterface, tab: string): Promise<void> {
  if (isTab(tab)) await update($, stationTab, () => tab)
}
