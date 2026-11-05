export type ModeId = 'cozy' | 'adventure'
export type SceneId = 'attic' | 'tearoom' | 'dungeon' | 'neon' | 'jazz' | 'camp' | 'library' | 'arcade' | 'drive' | 'station'

/** 고른 모드와, 모드마다 마지막으로 고른 장면 */
export type Mood = { mode: ModeId; sceneByMode: Record<ModeId, SceneId> }

/**
 * 음악 재생기 상태. failed는 켜려다 실패했거나 재생기가 저절로 꺼진 경우(다시 누르면 다시 시도).
 * other는 다른 채팅에서 음악을 켜서 이 채팅의 재생이 멈춘 경우(실패가 아니다).
 */
export type RadioState = 'off' | 'connecting' | 'playing' | 'failed' | 'other'

export type QuickKey = 'review' | 'commit' | 'simplify'

/** 턴이 끝난 이유(엔진의 turn.complete와 같다): 답을 마쳤다 · 사용자가 멈췄다 · 오류 · 모델이 거절했다. */
export type TurnEnd = 'answer' | 'aborted' | 'error' | 'refusal'

/**
 * 빠른 실행 버튼의 진행 상태. waiting: 눌렀고 명령이 줄 서 있거나 모델 작업이 아직 안 시작됨 · running: 그 작업이 도는 중(turnId로 따라감)
 * · ended: 끝남(잠깐 보이고 사라진다). 모델의 답이나 프롬프트 글은 담지 않는다.
 */
export type Work =
  | { phase: 'idle' }
  | { phase: 'waiting'; key: QuickKey }
  | { phase: 'running'; key: QuickKey; turnId: string }
  | { phase: 'ended'; key: QuickKey; reason: TurnEnd; seconds: number }

/**
 * 오늘 통계. date가 오늘과 다르면 0부터 다시 센다. files는 경로가 아니라 경로의 짧은 지문이다(옛 합계 키에만 경로가 들어 있다).
 * project는 이 칸을 쓴 채팅의 프로젝트 폴더 이름(경로가 아니다). 이 값이 생기기 전의 칸과 옛 합계 키에는 없다.
 */
export type Today = { date: string; prompts: number; actions: number; files: string[]; project?: string }

/** 프로젝트(폴더 이름) 하나의 오늘 통계. 이름이 빈 글자면 프로젝트 이름이 없는 옛 기록이다. */
export type ProjectToday = Today & { project: string }

/** 할 일 하나. done은 완료(체크), star는 우선 표시. 목록은 새로 더한 것이 맨 앞이다. */
export type Todo = { id: string; text: string; done: boolean; star: boolean }

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  percent: number | null
  tokens: number | null
  window: number
  limits: Limit[]
  usd: number | null
}

/** 바뀐 파일의 종류. 새로 만든 것(+), 고친 것(~), 지운 것(-), 이름을 바꾼 것(>), 합치다 충돌한 것(!). */
export type ChangeKind = 'new' | 'modified' | 'deleted' | 'renamed' | 'conflict'

export type GitFile = { path: string; kind: ChangeKind }

export type GitInfo = {
  branch: string
  changed: number
  ahead: number
  behind: number
  commits: { hash: string; subject: string }[]
  /** 바뀐 파일. 충돌이 먼저, 나머지는 git이 준 순서. 경로는 저장소 기준이고 제어 문자는 없다. */
  files: GitFile[]
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-tavern': {
      mood: Shaped<Mood>
      isHidden: boolean
      isStill: boolean
      slot: string
      own: Shaped<Today>
      others: Shaped<Today>
      projects: ProjectToday[]
      stationChoices: Partial<Record<SceneId, string>>
      favoriteStations: string[]
      stationTab: string
      todos: Todo[]
      usage: Usage | null
      git: Shaped<GitInfo | null>
      model: string | null
      project: string
      chatFiles: string[]
      armedKey: QuickKey | null
      work: Work
      tick: number
      radio: RadioState
      radioNote: string
      volume: number
      isFilesOpen: boolean
      isMusicAvailable: boolean
      isDiag: boolean
      collapsed: string[]
      openHelp: string
    }
  }
}
