import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Brightness, GitInfo, Mood, Motion, QuickKey, RadioState, Reaction, SceneId, Usage } from '../types'
import { BRIGHTNESSES, MOTIONS, isBrightness, isMotion, nextOf } from './effects'
import { withoutControl } from './format'
import { readGit } from './git'
import { DEFAULT_MOOD, MODES, SCENES } from './scenes'
import { addTouchedFile, setOwnProject, syncStats } from './stats'
import { loadStations, readStation } from './stations'
import { loadStreak } from './streak'
import { loadTodos } from './todos'
import { syncTimeline } from './timeline'
import { DEFAULT_VOLUME, isVolume } from './volume'

// 엔진의 검사(claude plugin validate)는 atom을 읽고 쓰는 파일 안에서 atom을 찾는다.
// 그래서 atom은 이 파일에만 두고, 바깥에는 `$`를 받는 함수로만 드러낸다.
// 모양을 바꾸면 shape 태그를 올린다. 이전 버전이 저장한 값은 기본값으로 읽힌다.
/** 접어 둔 구역(처음 한 번만 쓰는 기본값). art·usage·status·files·music은 구역, commits는 작업 현황의 커밋 로그, changes는 바뀐 파일 목록, projects는 프로젝트별 오늘. */
const DEFAULT_COLLAPSED: string[] = ['commits', 'changes', 'projects', 'timeline']
// 새로 생긴 "기본은 접힘" 항목: 접기 설정을 이미 저장해 둔 사용자에게도 한 번만 접어서 보여 준다(저장된 목록에 없어서 펼쳐지는 것을 막는다).
// 저장소의 `foldedIntroduced`는 "저장된 목록이 이 항목들을 이미 반영했다"는 표시다(사용자가 펴 둔 것을 다음에 다시 접지 않게).
const NEW_FOLDED: string[] = ['timeline']
const mood = atom({ plugin: 'pixel-tavern', key: 'mood' } as const, DEFAULT_MOOD as Mood, { shape: 'mood-1' })
const isHidden = atom({ plugin: 'pixel-tavern', key: 'isHidden' } as const, false)
const motion = atom({ plugin: 'pixel-tavern', key: 'motion' } as const, 'full' as Motion) // 효과 강도
const brightness = atom({ plugin: 'pixel-tavern', key: 'brightness' } as const, 'normal' as Brightness) // 그림 밝기
const reaction = atom({ plugin: 'pixel-tavern', key: 'reaction' } as const, '' as Reaction) // 작업 끝·테스트 결과 반응(잠깐만 있다, 저장하지 않는다)
const usage = atom({ plugin: 'pixel-tavern', key: 'usage' } as const, null)
const git = atom({ plugin: 'pixel-tavern', key: 'git' } as const, null, { shape: 'git-1' }) // git-1: 바뀐 파일 목록(files)이 생겼다
const model = atom({ plugin: 'pixel-tavern', key: 'model' } as const, null)
const effort = atom({ plugin: 'pixel-tavern', key: 'effort' } as const, null) // 마지막 모델 요청의 effort(첫 요청 전에는 모른다)
const project = atom({ plugin: 'pixel-tavern', key: 'project' } as const, '')
const chatFiles = atom({ plugin: 'pixel-tavern', key: 'chatFiles' } as const, [])
const armedKey = atom({ plugin: 'pixel-tavern', key: 'armedKey' } as const, null)
const tick = atom({ plugin: 'pixel-tavern', key: 'tick' } as const, 0)
const radio = atom({ plugin: 'pixel-tavern', key: 'radio' } as const, 'off' as RadioState)
const radioNote = atom({ plugin: 'pixel-tavern', key: 'radioNote' } as const, '')
const songTitle = atom({ plugin: 'pixel-tavern', key: 'songTitle' } as const, '') // 지금 나오는 곡 제목(화면에만 보이고 저장하지 않는다)
const volume = atom({ plugin: 'pixel-tavern', key: 'volume' } as const, DEFAULT_VOLUME)
const isFilesOpen = atom({ plugin: 'pixel-tavern', key: 'isFilesOpen' } as const, false)
const isPickerOpen = atom({ plugin: 'pixel-tavern', key: 'isPickerOpen' } as const, false) // 음악의 방송 고르기(처음엔 접힘, 저장하지 않는다)
const isMusicAvailable = atom({ plugin: 'pixel-tavern', key: 'isMusicAvailable' } as const, true)
const openHelp = atom({ plugin: 'pixel-tavern', key: 'openHelp' } as const, '')
const isDiag = atom({ plugin: 'pixel-tavern', key: 'isDiag' } as const, false)
const collapsed = atom({ plugin: 'pixel-tavern', key: 'collapsed' } as const, DEFAULT_COLLAPSED)

export const currentSceneId = (m: Mood): SceneId => m.sceneByMode[m.mode]

const isSceneId = (v: unknown): v is SceneId => typeof v === 'string' && v in SCENES

export const isMood = (v: unknown): v is Mood => {
  const m = v as Partial<Mood> | null

  return (
    typeof m === 'object' &&
    m !== null &&
    MODES.some(mode => mode.id === m.mode) &&
    isSceneId(m.sceneByMode?.cozy) &&
    isSceneId(m.sceneByMode?.adventure)
  )
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string')

export const toUsage = (u: {
  context: { percent?: number; tokens?: number; window: number }
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}): Usage => ({
  percent: u.context.percent ?? null,
  tokens: u.context.tokens ?? null,
  window: u.context.window,
  limits: u.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })),
  usd: u.cost?.usd ?? null,
})

/** 세션이 시작될 때 저장소에서 기분·숨김·움직임·방송 선택·오늘 통계·음량을 불러온다. 모양이 틀린 값은 버린다. */
export async function loadStored($: EngineInterface): Promise<void> {
  const [m, hidden, motionStored, brightnessStored, legacyStill, level, saved, introduced] = await Promise.all([
    $.store.get('mood'),
    $.store.get('isHidden'),
    $.store.get('motion'),
    $.store.get('brightness'),
    $.store.get('isStill'),
    $.store.get('volume'),
    $.store.get('collapsed'),
    $.store.get('foldedIntroduced'),
  ])

  if (isMood(m)) await update($, mood, () => m)
  if (typeof hidden === 'boolean') await update($, isHidden, () => hidden)
  if (isMotion(motionStored)) await update($, motion, () => motionStored)
  else if (legacyStill === true) await update($, motion, () => 'off') // 예전의 "움직임 끔" 설정(불리언)
  if (isBrightness(brightnessStored)) await update($, brightness, () => brightnessStored)
  if (isVolume(level)) await update($, volume, () => level)
  if (isStringList(saved)) {
    const done = isStringList(introduced) ? introduced : []
    const fresh = NEW_FOLDED.filter(id => !done.includes(id) && !saved.includes(id))
    const folded = [...saved, ...fresh]

    await update($, collapsed, () => folded)
    if (NEW_FOLDED.some(id => !done.includes(id))) {
      await $.store.set('collapsed', folded)
      await $.store.set('foldedIntroduced', [...new Set([...done, ...NEW_FOLDED])])
    }
  }
  await loadStations($)
  await loadTodos($)
  await syncStats($) // 오늘 통계: 다른 채팅과 앞선 실행이 남긴 칸을 읽어 둔다
  await syncTimeline($) // 오늘 작업 기록도 같은 방식으로
  await loadStreak($)
}

/** 처음 한 번만 true. 안내 문구를 한 번만 보여 주려는 용도. */
export async function takeIntro($: EngineInterface): Promise<boolean> {
  if ((await $.store.get('introSeen')) === true) return false
  await $.store.set('introSeen', true)

  return true
}

/** git 상태만 다시 읽는다. Claude가 한 턴을 마치고 파일을 고쳤을 때 배너의 "+N"을 바로 맞춘다. */
export async function refreshGit($: EngineInterface): Promise<void> {
  const info = await readGit($)

  await update($, git, (): GitInfo | null => info)
}

/**
 * 메인 대화가 모델 요청을 보내기 직전에 그 요청의 모델과 effort를 기억한다(서브에이전트의 요청은 부르는 쪽이 거른다).
 * 모델은 1분마다 읽는 값보다 이쪽이 빠르다(/model로 바꾼 다음 요청부터 보인다). 바뀌지 않았으면 다시 그리지 않는다.
 */
export async function noteStep($: EngineInterface, modelId: string, level: string | number | undefined): Promise<void> {
  const next = level === undefined ? null : typeof level === 'number' ? `예산 ${level}` : level

  if ((await read($, model)) !== modelId) await update($, model, () => modelId)
  if ((await read($, effort)) !== next) await update($, effort, () => next)
}

/** git·한도·모델·오늘 통계·할 일을 다시 읽고 화면을 한 번 다시 그리게 한다(남은 시간 표시도 갱신). */
export async function refresh($: EngineInterface): Promise<void> {
  const [snapshot, modelId] = await Promise.all([$.session.usage(), $.session.model(), refreshGit($), syncStats($), syncTimeline($), loadStreak($), loadTodos($)])

  await update($, usage, () => toUsage(snapshot))
  await update($, model, () => modelId)
  await update($, tick, n => n + 1)
}

/** 배너와 패널이 함께 쓰는 값. 그리는 중에 부르면 값이 바뀔 때 다시 그려진다. */
export async function readView($: EngineInterface) {
  const [m, u, g, mdl, eff, proj, now, rad, note, title, canPlay, mot, bright, react] = await Promise.all([
    read($, mood),
    read($, usage),
    read($, git),
    read($, model),
    read($, effort),
    read($, project),
    $.clock.now(),
    read($, radio),
    read($, radioNote),
    read($, songTitle),
    read($, isMusicAvailable),
    read($, motion),
    read($, brightness),
    read($, reaction),
    read($, tick), // 1분마다 남은 시간 표시를 다시 그리게 한다
  ])

  const base = SCENES[currentSceneId(m)]

  // 배너·패널은 장면의 music을 그대로 읽는다: 고른 방송이 있으면 그것으로 바꿔 끼운다.
  return { scene: { ...base, music: await readStation($, base.id) }, usage: u, git: g, model: mdl, effort: eff, project: proj, now, radio: rad, radioNote: note, songTitle: title, isMusicAvailable: canPlay, motion: mot, brightness: bright, reaction: react }
}

export async function readPanel($: EngineInterface) {
  const [files, armed, level, isOpen, isPicking, help, diag, folded] = await Promise.all([
    read($, chatFiles),
    read($, armedKey),
    read($, volume),
    read($, isFilesOpen),
    read($, isPickerOpen),
    read($, openHelp),
    read($, isDiag),
    read($, collapsed),
  ])

  return { chatFiles: files, armedKey: armed, volume: level, isFilesOpen: isOpen, isPickerOpen: isPicking, openHelp: help, isDiag: diag, collapsed: folded }
}

export function readHidden($: EngineInterface): Promise<boolean> {
  return read($, isHidden)
}

export function readMood($: EngineInterface): Promise<Mood> {
  return read($, mood)
}

export function readArmed($: EngineInterface): Promise<QuickKey | null> {
  return read($, armedKey)
}

export function readRadio($: EngineInterface): Promise<RadioState> {
  return read($, radio)
}

export function readVolume($: EngineInterface): Promise<number> {
  return read($, volume)
}

export function readGitInfo($: EngineInterface): Promise<GitInfo | null> {
  return read($, git)
}

export async function writeMood($: EngineInterface, next: Mood): Promise<void> {
  await update($, mood, () => next)
  await $.store.set('mood', next)
}

export async function writeHidden($: EngineInterface, hidden: boolean): Promise<void> {
  await update($, isHidden, () => hidden)
  await $.store.set('isHidden', hidden)
}

/**
 * 효과 강도를 한 단계 돌리고(보통 → 약하게 → 끔 → 보통) 저장소에 남긴다(다음에 열어도 그대로). 바뀐 뒤의 값을 돌려준다.
 * 값을 읽고 따로 쓰면 거의 동시에 두 번 눌렀을 때 둘 다 같은 값을 읽어 한 번이 사라져서, 바꾸는 순간의 값에서 돌린다(시험으로 확인).
 */
export async function cycleMotion($: EngineInterface): Promise<Motion> {
  let next: Motion = 'full'

  await update($, motion, current => {
    next = nextOf(MOTIONS, current)

    return next
  })
  await $.store.set('motion', next)

  return next
}

/** 그림 밝기를 한 단계 돌리고(보통 → 밝게 → 어둡게 → 보통) 저장소에 남긴다. 바뀐 뒤의 값을 돌려준다. */
export async function cycleBrightness($: EngineInterface): Promise<Brightness> {
  let next: Brightness = 'normal'

  await update($, brightness, current => {
    next = nextOf(BRIGHTNESSES, current)

    return next
  })
  await $.store.set('brightness', next)

  return next
}

/** 반응을 보이거나(종류) 지운다(빈 글자). 저장하지 않는다. */
export async function writeReaction($: EngineInterface, next: Reaction): Promise<void> {
  await update($, reaction, () => next)
}

export async function writeArmed($: EngineInterface, armed: QuickKey | null): Promise<void> {
  await update($, armedKey, () => armed)
}

export function readFilesOpen($: EngineInterface): Promise<boolean> {
  return read($, isFilesOpen)
}

export async function writeFilesOpen($: EngineInterface, isOpen: boolean): Promise<void> {
  await update($, isFilesOpen, () => isOpen)
}

/** 방송 고르기를 펼치거나 접는다. 바꾸는 순간의 값에서 뒤집어서, 거의 동시에 두 번 눌러도 한 번이 사라지지 않는다. */
export async function togglePicker($: EngineInterface): Promise<void> {
  await update($, isPickerOpen, isOpen => !isOpen)
}

export async function writeMusicAvailable($: EngineInterface, isAvailable: boolean): Promise<void> {
  await update($, isMusicAvailable, () => isAvailable)
}

/** 측정판을 켜고 끈다. 켜져 있었는지(바꾸기 전 값)가 아니라 바뀐 뒤의 값을 돌려준다. */
export async function toggleDiag($: EngineInterface): Promise<boolean> {
  const next = !(await read($, isDiag))

  await update($, isDiag, () => next)

  return next
}

export function readCollapsed($: EngineInterface): Promise<string[]> {
  return read($, collapsed)
}

/** 접어 둔 구역을 바꾸고 저장소에 남긴다(다음에 열어도 그대로). */
export async function writeCollapsed($: EngineInterface, ids: string[]): Promise<void> {
  await update($, collapsed, () => ids)
  await $.store.set('collapsed', ids)
  await $.store.set('foldedIntroduced', NEW_FOLDED) // 사용자가 정한 목록이다: 새 항목을 다시 접지 않는다
}

export function readOpenHelp($: EngineInterface): Promise<string> {
  return read($, openHelp)
}

/** 열린 도움말(없으면 빈 글자). 하나만 열린다. */
export async function writeOpenHelp($: EngineInterface, id: string): Promise<void> {
  await update($, openHelp, () => id)
}

/** 다른 채팅이 음악을 가져갔을 때: 실패가 아니라 "다른 채팅에서 재생 중"으로 바꾼다. */
export async function yieldRadio($: EngineInterface, isStale: () => boolean): Promise<void> {
  if (isStale()) return
  await update($, radioNote, () => '')
  await update($, radio, () => 'other')
}

/** 실패 상태로 바꾸고 이유를 남긴다. 이미 멈춘 재생이면 아무것도 바꾸지 않는다. */
export async function failRadio($: EngineInterface, note: string, isStale: () => boolean): Promise<void> {
  if (isStale()) return
  await update($, radioNote, () => note)
  await update($, radio, () => 'failed')
}

/** 상태는 그대로 두고 안내 한 줄만 바꾼다(예: 다시 연결하는 중). 이미 멈춘 재생이면 아무것도 바꾸지 않는다. */
export async function noteRadio($: EngineInterface, note: string, isStale: () => boolean): Promise<void> {
  if (!isStale()) await update($, radioNote, () => note)
}

/** `isStale`이 참이면 값을 바꾸지 않는다. 이미 멈춘 재생이 늦게 보낸 신호가 상태를 덮어쓰지 못하게 한다. */
export async function writeRadio($: EngineInterface, next: RadioState, isStale: () => boolean = () => false): Promise<void> {
  await update($, radio, current => (isStale() ? current : next))
  if (next !== 'failed' && !isStale()) await update($, radioNote, () => '') // 새 시도는 옛 실패 이유를 지운다
  if (next !== 'playing' && !isStale()) await update($, songTitle, () => '') // 소리가 나오지 않으면 곡 제목도 없다(방송을 바꾸거나 끄면 지워진다)
}

/** 지금 곡의 제목을 보인다. 소리가 나오는 중(playing)이 아니거나 이미 멈춘 재생이면 무시한다. 저장소에는 쓰지 않는다. */
export async function writeTitle($: EngineInterface, title: string, isStale: () => boolean = () => false): Promise<void> {
  if (isStale() || (await read($, radio)) !== 'playing') return
  await update($, songTitle, () => title)
}

export async function writeVolume($: EngineInterface, level: number): Promise<void> {
  await update($, volume, () => level)
  await $.store.set('volume', level)
}

export async function writeUsage($: EngineInterface, next: Usage): Promise<void> {
  await update($, usage, () => next)
}

export async function writeProject($: EngineInterface, name: string): Promise<void> {
  await update($, project, () => name)
  await setOwnProject($, name) // 오늘 통계의 이 채팅 칸에도 프로젝트 이름을 남긴다
}

/** Claude가 이 채팅에서 고치거나 쓴 파일을 기록한다. */
export async function trackFile($: EngineInterface, rawPath: string): Promise<void> {
  // 줄바꿈 같은 제어 문자가 든 이름은 엔진이 버튼 이름으로 그리지 못해 패널 전체가 사라진다(시험으로 확인). 프롬프트에 줄이 끼어드는 것도 함께 막힌다.
  const path = withoutControl(rawPath)

  if (path === '') return
  await update($, chatFiles, list => (list.includes(path) ? list : [...list, path].slice(-50)))
  await addTouchedFile($, path)
}
