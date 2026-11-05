export type ModeId = 'cozy' | 'adventure'
export type SceneId = 'attic' | 'tearoom' | 'dungeon' | 'neon'

/** 고른 모드와, 모드마다 마지막으로 고른 장면 */
export type Mood = { mode: ModeId; sceneByMode: Record<ModeId, SceneId> }

/**
 * 음악 재생기 상태. failed는 켜려다 실패했거나 재생기가 저절로 꺼진 경우(다시 누르면 다시 시도).
 * other는 다른 채팅에서 음악을 켜서 이 채팅의 재생이 멈춘 경우(실패가 아니다).
 */
export type RadioState = 'off' | 'connecting' | 'playing' | 'failed' | 'other'

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

export type GitInfo = {
  branch: string
  changed: number
  ahead: number
  behind: number
  commits: { hash: string; subject: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-tavern': {
      mood: Shaped<Mood>
      isHidden: boolean
      today: Shaped<Today>
      usage: Usage | null
      git: GitInfo | null
      model: string | null
      project: string
      chatFiles: string[]
      isCommitArmed: boolean
      tick: number
      radio: RadioState
      radioNote: string
      volume: number
      isFilesOpen: boolean
      isMusicAvailable: boolean
      isDiag: boolean
      openHelp: string
    }
  }
}
