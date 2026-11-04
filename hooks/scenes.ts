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
  gauges: { context: string; fiveHour: string; week: string }
  /** 24시간 인터넷 라디오. 바꾸려면 stream만 고친다. Windows 재생기는 https를 못 열어서 http 주소만 된다. */
  music: { label: string; stream: string }
}

export const MODES: { id: ModeId; label: string; scenes: SceneId[] }[] = [
  { id: 'cozy', label: '아늑', scenes: ['attic', 'tearoom'] },
  { id: 'adventure', label: '모험', scenes: ['dungeon', 'neon'] },
]

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
    gauges: { context: '촛불', fiveHour: '오늘의 의뢰 · 5H', week: '길드 장부 · 주간' },
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
    gauges: { context: '찻잔', fiveHour: '신청곡 · 5H', week: '단골 장부 · 주간' },
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
    gauges: { context: '마나', fiveHour: '스테이지 · 5H', week: '시즌 · 주간' },
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
    gauges: { context: '전기', fiveHour: '공연 · 5H', week: '투어 · 주간' },
    music: { label: 'Nightride FM 신스웨이브', stream: 'http://stream.nightride.fm/nightride.mp3' },
  },
}

export const DEFAULT_MOOD = {
  mode: 'cozy',
  sceneByMode: { cozy: 'attic', adventure: 'dungeon' },
} as const
