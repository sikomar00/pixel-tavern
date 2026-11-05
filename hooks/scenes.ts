import type { ModeId, SceneId } from '../types'

/**
 * 고를 수 있는 라디오 방송(24시간 인터넷 라디오). 장면마다 기본 방송이 있고, 패널에서 다른 방송을 고를 수 있다.
 * 방송을 바꾸거나 더하려면 여기만 고친다. Windows 재생기는 https를 못 열어서 http 주소만 된다(시험이 확인한다).
 */
export type Station = {
  id: string
  /** 화면에 크게 보이는 이름 */
  label: string
  /** 버튼에 쓰는 짧은 이름 */
  short: string
  /** 고르는 칸에서 어느 묶음 버튼 아래에 있는가 */
  group: StationGroup
  stream: string
}

/** 방송을 분위기로 묶은 것. 고르는 칸은 묶음 하나의 방송만 버튼으로 보여 한 화면에 버튼이 많지 않다(스크롤이 없다). */
export type StationGroup = 'calm' | 'oldies' | 'game' | 'synth'

export const STATION_GROUPS: { id: StationGroup; label: string }[] = [
  { id: 'calm', label: '잔잔' },
  { id: 'oldies', label: '7080' },
  { id: 'game', label: '게임' },
  { id: 'synth', label: '신스' },
]

// 장면의 기본 방송(장면마다 하나씩)과, 분위기가 어울리는 곳끼리 묶어 둔 고를 수 있는 방송. 새 방송을 더하면 서버 이름을 tests/function.test.tsx 의 허용 목록에도 적는다.
const REYFM: Station = { id: 'reyfm', label: 'REYFM 로파이', short: 'REYFM', group: 'calm', stream: 'http://listen.reyfm.de/lofi_320kbps.mp3' }
const OLDPOP: Station = { id: 'oldpop', label: '올드팝카페', short: '올드팝카페', group: 'oldies', stream: 'http://cast.oldpopcafe.net:7080/' }
const KAAOS: Station = { id: 'kaaos', label: 'Kaaos 칩튠 라디오', short: 'Kaaos 칩튠', group: 'game', stream: 'http://stream.kaaosradio.fi:8000/chip' }
const NIGHTRIDE: Station = { id: 'nightride', label: 'Nightride FM 신스웨이브', short: 'Nightride', group: 'synth', stream: 'http://stream.nightride.fm/nightride.mp3' }

const GROOVESALAD: Station = { id: 'groovesalad', label: 'Groove Salad (SomaFM)', short: 'Groove Salad', group: 'calm', stream: 'http://ice1.somafm.com/groovesalad-128-mp3' }
const SWISSJAZZ: Station = { id: 'swissjazz', label: 'Radio Swiss Jazz', short: 'Swiss Jazz', group: 'calm', stream: 'http://stream.srg-ssr.ch/m/rsj/mp3_128' }
const ILLSTREET: Station = { id: 'illstreet', label: 'Illinois Street Lounge (SomaFM)', short: 'Ill. Street', group: 'calm', stream: 'http://ice1.somafm.com/illstreet-128-mp3' }
const VGMRADIO: Station = { id: 'vgmradio', label: 'VGM Radio', short: 'VGM Radio', group: 'game', stream: 'http://radio.vgmradio.com:8040/stream' }
const U80S: Station = { id: 'u80s', label: 'Underground 80s (SomaFM)', short: 'Underground 80s', group: 'oldies', stream: 'http://ice1.somafm.com/u80s-128-mp3' }
const DATAWAVE: Station = { id: 'datawave', label: 'Nightride Datawave', short: 'Datawave', group: 'synth', stream: 'http://stream.nightride.fm/datawave.mp3' }

/** 목록의 순서가 곧 묶음 안 버튼의 순서다. 분위기별로 묶었다: 잔잔 · 7080 · 게임 · 신스웨이브. */
export const STATIONS: Station[] = [
  REYFM,
  GROOVESALAD,
  { id: 'fluid', label: 'Fluid (SomaFM)', short: 'Fluid', group: 'calm', stream: 'http://ice1.somafm.com/fluid-128-mp3' },
  SWISSJAZZ,
  ILLSTREET,
  OLDPOP,
  { id: 'seventies', label: 'Left Coast 70s (SomaFM)', short: 'Left Coast 70s', group: 'oldies', stream: 'http://ice1.somafm.com/seventies-128-mp3' },
  { id: '7soul', label: 'Seven Inch Soul (SomaFM)', short: '7 Inch Soul', group: 'oldies', stream: 'http://ice1.somafm.com/7soul-128-mp3' },
  U80S,
  KAAOS,
  VGMRADIO,
  { id: 'paralax', label: 'Radio Paralax 칩튠', short: 'Paralax', group: 'game', stream: 'http://radio-paralax.de:8000/' },
  NIGHTRIDE,
  { id: 'chillsynth', label: 'Nightride Chillsynth', short: 'Chillsynth', group: 'synth', stream: 'http://stream.nightride.fm/chillsynth.mp3' },
  DATAWAVE,
  { id: 'darksynth', label: 'Nightride Darksynth', short: 'Darksynth', group: 'synth', stream: 'http://stream.nightride.fm/darksynth.mp3' },
]

export type Scene = {
  id: SceneId
  mode: ModeId
  title: string
  motto: string
  base: string
  accent: string
  /** 보조 포인트색(없으면 accent) */
  accent2: string
  /** 흐린 글자색 */
  muted: string
  /** 이 장면의 기본 방송. 패널에서 다른 방송을 고르면 그 선택이 우선한다(stations.ts). */
  music: Station
}

// 화면에는 보이지 않는다. 저장된 값의 모양(모드별 마지막 장면)과 장면 순서를 위해 남겨 둔다.
export const MODES: { id: ModeId; scenes: SceneId[] }[] = [
  { id: 'cozy', scenes: ['attic', 'tearoom', 'jazz', 'camp', 'library'] },
  { id: 'adventure', scenes: ['dungeon', 'neon', 'arcade', 'drive', 'station'] },
]

/** 게이지 이름. 장면마다 다른 비유 이름은 뜻이 전해지지 않아 없앴다: 어느 장면이든 기능 이름만 쓴다. */
export const GAUGE_NAMES = { context: '컨텍스트', fiveHour: '5시간', week: '주간' } as const

export const SCENES: Record<SceneId, Scene> = {
  attic: {
    id: 'attic',
    mode: 'cozy',
    title: '비 오는 밤 다락방',
    motto: '비는 오고, 코드는 따뜻하다',
    base: '#1b1b3a',
    accent: '#ffb347',
    accent2: '#ff7fb0',
    muted: '#b9b3e6',
    music: REYFM,
  },
  tearoom: {
    id: 'tearoom',
    mode: 'cozy',
    title: '7080 다방',
    motto: '한 잔 더, 한 곡 더',
    base: '#3b2417',
    accent: '#e8a317',
    accent2: '#d9603b',
    muted: '#d8bfa0',
    music: OLDPOP,
  },
  dungeon: {
    id: 'dungeon',
    mode: 'adventure',
    title: '8비트 던전',
    motto: '다음 스테이지로',
    base: '#0b2b26',
    accent: '#7cff4f',
    accent2: '#ffd84a',
    muted: '#9fd8c4',
    music: KAAOS,
  },
  neon: {
    id: 'neon',
    mode: 'adventure',
    title: '네온 펑크 성',
    motto: '시끄럽게, 선명하게',
    base: '#120a1f',
    accent: '#ff2e88',
    accent2: '#00e5ff',
    muted: '#c9a8e8',
    music: NIGHTRIDE,
  },
  jazz: {
    id: 'jazz',
    mode: 'cozy',
    title: '재즈 바',
    motto: '느리게, 깊게, 한 곡 더',
    base: '#24101c',
    accent: '#4fc3c3',
    accent2: '#e0a74a',
    muted: '#c9a9bd',
    music: SWISSJAZZ,
  },
  camp: {
    id: 'camp',
    mode: 'cozy',
    title: '숲속 캠프파이어',
    motto: '타닥타닥, 코드가 익어 간다',
    base: '#0f1d1a',
    accent: '#ff8a4c',
    accent2: '#ffd36e',
    muted: '#a9cfc0',
    music: GROOVESALAD,
  },
  library: {
    id: 'library',
    mode: 'cozy',
    title: '마법 서재',
    motto: '한 줄만 더 읽고 갈게',
    base: '#14232e',
    accent: '#c9a6ff',
    accent2: '#ffd36e',
    muted: '#a9bfd0',
    music: ILLSTREET,
  },
  arcade: {
    id: 'arcade',
    mode: 'adventure',
    title: '오락실',
    motto: '동전 하나, 한 판 더',
    base: '#0a1530',
    accent: '#ffe14d',
    accent2: '#ff4f6d',
    muted: '#9fb4e6',
    music: VGMRADIO,
  },
  drive: {
    id: 'drive',
    mode: 'adventure',
    title: '80년대 드라이브',
    motto: '석양 속으로 액셀을',
    base: '#240f3d',
    accent: '#ff8fa3',
    accent2: '#ffd36e',
    muted: '#cdb0e8',
    music: U80S,
  },
  station: {
    id: 'station',
    mode: 'adventure',
    title: '우주 정거장',
    motto: '조용한 궤도에서',
    base: '#06121f',
    accent: '#8ad7ff',
    accent2: '#ffd36e',
    muted: '#a9c1d9',
    music: DATAWAVE,
  },
}

export const DEFAULT_MOOD = {
  mode: 'cozy',
  sceneByMode: { cozy: 'attic', adventure: 'dungeon' },
} as const
