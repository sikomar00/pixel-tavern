import type { ModeId, SceneId } from '../types'

/**
 * 고를 수 있는 라디오 방송(24시간 인터넷 라디오). 장면마다 기본 방송이 있고, 패널에서 다른 방송을 고를 수 있다.
 * 방송을 바꾸거나 더하려면 여기만 고친다. Windows 재생기는 https를 못 열어서 http 주소만 된다(시험이 확인한다).
 */
export type Station = { id: string; label: string; stream: string }

// 장면의 기본 방송(맨 앞 4개: 장면마다 하나씩)과, 분위기가 어울리는 곳끼리 묶어 둔 고를 수 있는 방송. 새 방송을 더하면 서버 이름을 tests/function.test.tsx 의 허용 목록에도 적는다.
const REYFM: Station = { id: 'reyfm', label: 'REYFM 로파이', stream: 'http://listen.reyfm.de/lofi_320kbps.mp3' }
const OLDPOP: Station = { id: 'oldpop', label: '올드팝카페', stream: 'http://cast.oldpopcafe.net:7080/' }
const KAAOS: Station = { id: 'kaaos', label: 'Kaaos 칩튠 라디오', stream: 'http://stream.kaaosradio.fi:8000/chip' }
const NIGHTRIDE: Station = { id: 'nightride', label: 'Nightride FM 신스웨이브', stream: 'http://stream.nightride.fm/nightride.mp3' }

/** 목록의 순서가 곧 고르는 칸의 순서다(즐겨찾기는 그중에서 위로 올라온다). 분위기별로 묶었다: 잔잔 · 7080 · 게임 · 신스웨이브. */
export const STATIONS: Station[] = [
  REYFM,
  { id: 'groovesalad', label: 'Groove Salad (SomaFM)', stream: 'http://ice1.somafm.com/groovesalad-128-mp3' },
  { id: 'fluid', label: 'Fluid (SomaFM)', stream: 'http://ice1.somafm.com/fluid-128-mp3' },
  { id: 'swissjazz', label: 'Radio Swiss Jazz', stream: 'http://stream.srg-ssr.ch/m/rsj/mp3_128' },
  { id: 'illstreet', label: 'Illinois Street Lounge (SomaFM)', stream: 'http://ice1.somafm.com/illstreet-128-mp3' },
  OLDPOP,
  { id: 'seventies', label: 'Left Coast 70s (SomaFM)', stream: 'http://ice1.somafm.com/seventies-128-mp3' },
  { id: '7soul', label: 'Seven Inch Soul (SomaFM)', stream: 'http://ice1.somafm.com/7soul-128-mp3' },
  { id: 'u80s', label: 'Underground 80s (SomaFM)', stream: 'http://ice1.somafm.com/u80s-128-mp3' },
  KAAOS,
  { id: 'vgmradio', label: 'VGM Radio', stream: 'http://radio.vgmradio.com:8040/stream' },
  { id: 'paralax', label: 'Radio Paralax 칩튠', stream: 'http://radio-paralax.de:8000/' },
  NIGHTRIDE,
  { id: 'chillsynth', label: 'Nightride Chillsynth', stream: 'http://stream.nightride.fm/chillsynth.mp3' },
  { id: 'datawave', label: 'Nightride Datawave', stream: 'http://stream.nightride.fm/datawave.mp3' },
  { id: 'darksynth', label: 'Nightride Darksynth', stream: 'http://stream.nightride.fm/darksynth.mp3' },
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
  { id: 'cozy', scenes: ['attic', 'tearoom'] },
  { id: 'adventure', scenes: ['dungeon', 'neon'] },
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
}

export const DEFAULT_MOOD = {
  mode: 'cozy',
  sceneByMode: { cozy: 'attic', adventure: 'dungeon' },
} as const
