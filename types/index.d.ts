export type ModeId = 'cozy' | 'adventure'
export type SceneId = 'attic' | 'tearoom' | 'dungeon' | 'neon'

/** 고른 모드와, 모드마다 마지막으로 고른 장면 */
export type Mood = { mode: ModeId; sceneByMode: Record<ModeId, SceneId> }

/**
 * 음악 재생기 상태. failed는 켜려다 실패했거나 재생기가 저절로 꺼진 경우(다시 누르면 다시 시도).
 * other는 다른 채팅에서 음악을 켜서 이 채팅의 재생이 멈춘 경우(실패가 아니다).
 */
export type RadioState = 'off' | 'connecting' | 'playing' | 'failed' | 'other'

export type QuickKey = 'review' | 'commit' | 'simplify'

/** 오늘 통계. date가 오늘과 다르면 0부터 다시 센다. */
export type Today = { date: string; prompts: number; actions: number; files: string[] }

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
      today: Shaped<Today>
      usage: Usage | null
      git: Shaped<GitInfo | null>
      model: string | null
      project: string
      chatFiles: string[]
      armedKey: QuickKey | null
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
