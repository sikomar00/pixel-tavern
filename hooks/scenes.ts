import type { ModeId, SceneId } from '../types'

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
  /** 24시간 인터넷 라디오. 바꾸려면 stream만 고친다. Windows 재생기는 https를 못 열어서 http 주소만 된다. */
  music: { label: string; stream: string }
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
    music: { label: 'REYFM 로파이', stream: 'http://listen.reyfm.de/lofi_320kbps.mp3' },
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
    music: { label: '올드팝카페', stream: 'http://cast.oldpopcafe.net:7080/' },
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
    music: { label: 'Kaaos 칩튠 라디오', stream: 'http://stream.kaaosradio.fi:8000/chip' },
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
    music: { label: 'Nightride FM 신스웨이브', stream: 'http://stream.nightride.fm/nightride.mp3' },
  },
}

export const DEFAULT_MOOD = {
  mode: 'cozy',
  sceneByMode: { cozy: 'attic', adventure: 'dungeon' },
} as const
