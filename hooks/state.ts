import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { GitInfo, Mood, QuickKey, RadioState, SceneId, Usage } from '../types'
import { withoutControl } from './format'
import { readGit } from './git'
import { DEFAULT_MOOD, MODES, SCENES } from './scenes'
import { addTouchedFile, syncStats } from './stats'
import { DEFAULT_VOLUME, isVolume } from './volume'

// 엔진의 검사(claude plugin validate)는 atom을 읽고 쓰는 파일 안에서 atom을 찾는다.
// 그래서 atom은 이 파일에만 두고, 바깥에는 `$`를 받는 함수로만 드러낸다.
// 모양을 바꾸면 shape 태그를 올린다. 이전 버전이 저장한 값은 기본값으로 읽힌다.
/** 접어 둔 구역(처음 한 번만 쓰는 기본값). art·usage·status·files·music은 구역, commits는 작업 현황의 커밋 로그, changes는 바뀐 파일 목록. */
const DEFAULT_COLLAPSED: string[] = ['commits', 'changes']
const mood = atom({ plugin: 'pixel-tavern', key: 'mood' } as const, DEFAULT_MOOD as Mood, { shape: 'mood-1' })
const isHidden = atom({ plugin: 'pixel-tavern', key: 'isHidden' } as const, false)
const usage = atom({ plugin: 'pixel-tavern', key: 'usage' } as const, null)
const git = atom({ plugin: 'pixel-tavern', key: 'git' } as const, null, { shape: 'git-1' }) // git-1: 바뀐 파일 목록(files)이 생겼다
const model = atom({ plugin: 'pixel-tavern', key: 'model' } as const, null)
const project = atom({ plugin: 'pixel-tavern', key: 'project' } as const, '')
const chatFiles = atom({ plugin: 'pixel-tavern', key: 'chatFiles' } as const, [])
const armedKey = atom({ plugin: 'pixel-tavern', key: 'armedKey' } as const, null)
const tick = atom({ plugin: 'pixel-tavern', key: 'tick' } as const, 0)
const radio = atom({ plugin: 'pixel-tavern', key: 'radio' } as const, 'off' as RadioState)
const radioNote = atom({ plugin: 'pixel-tavern', key: 'radioNote' } as const, '')
const volume = atom({ plugin: 'pixel-tavern', key: 'volume' } as const, DEFAULT_VOLUME)
const isFilesOpen = atom({ plugin: 'pixel-tavern', key: 'isFilesOpen' } as const, false)
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

/** 세션이 시작될 때 저장소에서 기분·숨김·오늘 통계·음량을 불러온다. 모양이 틀린 값은 버린다. */
export async function loadStored($: EngineInterface): Promise<void> {
  const [m, hidden, level, saved] = await Promise.all([
    $.store.get('mood'),
    $.store.get('isHidden'),
    $.store.get('volume'),
    $.store.get('collapsed'),
  ])

  if (isMood(m)) await update($, mood, () => m)
  if (typeof hidden === 'boolean') await update($, isHidden, () => hidden)
  if (isVolume(level)) await update($, volume, () => level)
  if (isStringList(saved)) await update($, collapsed, () => saved)
  await syncStats($) // 오늘 통계: 다른 채팅과 앞선 실행이 남긴 칸을 읽어 둔다
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

/** git·한도·모델·오늘 통계를 다시 읽고 화면을 한 번 다시 그리게 한다(남은 시간 표시도 갱신). */
export async function refresh($: EngineInterface): Promise<void> {
  const [snapshot, modelId] = await Promise.all([$.session.usage(), $.session.model(), refreshGit($), syncStats($)])

  await update($, usage, () => toUsage(snapshot))
  await update($, model, () => modelId)
  await update($, tick, n => n + 1)
}

/** 배너와 패널이 함께 쓰는 값. 그리는 중에 부르면 값이 바뀔 때 다시 그려진다. */
export async function readView($: EngineInterface) {
  const [m, u, g, mdl, proj, now, rad, note, canPlay] = await Promise.all([
    read($, mood),
    read($, usage),
    read($, git),
    read($, model),
    read($, project),
    $.clock.now(),
    read($, radio),
    read($, radioNote),
    read($, isMusicAvailable),
    read($, tick), // 1분마다 남은 시간 표시를 다시 그리게 한다
  ])

  return { scene: SCENES[currentSceneId(m)], usage: u, git: g, model: mdl, project: proj, now, radio: rad, radioNote: note, isMusicAvailable: canPlay }
}

export async function readPanel($: EngineInterface) {
  const [files, armed, level, isOpen, help, diag, folded] = await Promise.all([
    read($, chatFiles),
    read($, armedKey),
    read($, volume),
    read($, isFilesOpen),
    read($, openHelp),
    read($, isDiag),
    read($, collapsed),
  ])

  return { chatFiles: files, armedKey: armed, volume: level, isFilesOpen: isOpen, openHelp: help, isDiag: diag, collapsed: folded }
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

export async function writeArmed($: EngineInterface, armed: QuickKey | null): Promise<void> {
  await update($, armedKey, () => armed)
}

export function readFilesOpen($: EngineInterface): Promise<boolean> {
  return read($, isFilesOpen)
}

export async function writeFilesOpen($: EngineInterface, isOpen: boolean): Promise<void> {
  await update($, isFilesOpen, () => isOpen)
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

/** `isStale`이 참이면 값을 바꾸지 않는다. 이미 멈춘 재생이 늦게 보낸 신호가 상태를 덮어쓰지 못하게 한다. */
export async function writeRadio($: EngineInterface, next: RadioState, isStale: () => boolean = () => false): Promise<void> {
  await update($, radio, current => (isStale() ? current : next))
  if (next !== 'failed' && !isStale()) await update($, radioNote, () => '') // 새 시도는 옛 실패 이유를 지운다
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
}

/** Claude가 이 채팅에서 고치거나 쓴 파일을 기록한다. */
export async function trackFile($: EngineInterface, rawPath: string): Promise<void> {
  // 줄바꿈 같은 제어 문자가 든 이름은 엔진이 버튼 이름으로 그리지 못해 패널 전체가 사라진다(시험으로 확인). 프롬프트에 줄이 끼어드는 것도 함께 막힌다.
  const path = withoutControl(rawPath)

  if (path === '') return
  await update($, chatFiles, list => (list.includes(path) ? list : [...list, path].slice(-50)))
  await addTouchedFile($, path)
}
