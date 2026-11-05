import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { GitInfo, Mood, RadioState, SceneId, Today, Usage } from '../types'
import { todayKey } from './format'
import { readGit } from './git'
import { DEFAULT_MOOD, MODES, SCENES } from './scenes'
import { DEFAULT_VOLUME, isVolume } from './volume'

// 엔진의 검사(claude plugin validate)는 atom을 읽고 쓰는 파일 안에서 atom을 찾는다.
// 그래서 atom은 이 파일에만 두고, 바깥에는 `$`를 받는 함수로만 드러낸다.
// 모양을 바꾸면 shape 태그를 올린다. 이전 버전이 저장한 값은 기본값으로 읽힌다.
const EMPTY_TODAY: Today = { date: '', prompts: 0, actions: 0, files: [] }
const mood = atom({ plugin: 'pixel-tavern', key: 'mood' } as const, DEFAULT_MOOD as Mood, { shape: 'mood-1' })
const today = atom({ plugin: 'pixel-tavern', key: 'today' } as const, EMPTY_TODAY, { shape: 'today-1' })
const isHidden = atom({ plugin: 'pixel-tavern', key: 'isHidden' } as const, false)
const usage = atom({ plugin: 'pixel-tavern', key: 'usage' } as const, null)
const git = atom({ plugin: 'pixel-tavern', key: 'git' } as const, null)
const model = atom({ plugin: 'pixel-tavern', key: 'model' } as const, null)
const project = atom({ plugin: 'pixel-tavern', key: 'project' } as const, '')
const chatFiles = atom({ plugin: 'pixel-tavern', key: 'chatFiles' } as const, [])
const isCommitArmed = atom({ plugin: 'pixel-tavern', key: 'isCommitArmed' } as const, false)
const tick = atom({ plugin: 'pixel-tavern', key: 'tick' } as const, 0)
const radio = atom({ plugin: 'pixel-tavern', key: 'radio' } as const, 'off' as RadioState)
const radioNote = atom({ plugin: 'pixel-tavern', key: 'radioNote' } as const, '')
const volume = atom({ plugin: 'pixel-tavern', key: 'volume' } as const, DEFAULT_VOLUME)
const isFilesOpen = atom({ plugin: 'pixel-tavern', key: 'isFilesOpen' } as const, false)

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

export const isToday = (v: unknown): v is Today => {
  const t = v as Partial<Today> | null

  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.date === 'string' &&
    typeof t.prompts === 'number' &&
    typeof t.actions === 'number' &&
    Array.isArray(t.files)
  )
}

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
  const [m, hidden, t, level] = await Promise.all([
    $.store.get('mood'),
    $.store.get('isHidden'),
    $.store.get('today'),
    $.store.get('volume'),
  ])

  if (isMood(m)) await update($, mood, () => m)
  if (typeof hidden === 'boolean') await update($, isHidden, () => hidden)
  if (isToday(t)) await update($, today, () => t)
  if (isVolume(level)) await update($, volume, () => level)
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

/** git·한도·모델을 다시 읽고 화면을 한 번 다시 그리게 한다(남은 시간 표시도 갱신). */
export async function refresh($: EngineInterface): Promise<void> {
  const [snapshot, modelId] = await Promise.all([$.session.usage(), $.session.model(), refreshGit($)])

  await update($, usage, () => toUsage(snapshot))
  await update($, model, () => modelId)
  await update($, tick, n => n + 1)
}

/** 배너와 패널이 함께 쓰는 값. 그리는 중에 부르면 값이 바뀔 때 다시 그려진다. */
export async function readView($: EngineInterface) {
  const [m, u, g, mdl, proj, now, rad, note] = await Promise.all([
    read($, mood),
    read($, usage),
    read($, git),
    read($, model),
    read($, project),
    $.clock.now(),
    read($, radio),
    read($, radioNote),
    read($, tick), // 1분마다 남은 시간 표시를 다시 그리게 한다
  ])

  return { scene: SCENES[currentSceneId(m)], usage: u, git: g, model: mdl, project: proj, now, radio: rad, radioNote: note }
}

export async function readPanel($: EngineInterface) {
  const [t, files, armed, level, isOpen] = await Promise.all([
    read($, today),
    read($, chatFiles),
    read($, isCommitArmed),
    read($, volume),
    read($, isFilesOpen),
  ])

  return { today: t, chatFiles: files, isCommitArmed: armed, volume: level, isFilesOpen: isOpen }
}

export function readHidden($: EngineInterface): Promise<boolean> {
  return read($, isHidden)
}

export function readMood($: EngineInterface): Promise<Mood> {
  return read($, mood)
}

export function readArmed($: EngineInterface): Promise<boolean> {
  return read($, isCommitArmed)
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

export async function writeArmed($: EngineInterface, armed: boolean): Promise<void> {
  await update($, isCommitArmed, () => armed)
}

export function readFilesOpen($: EngineInterface): Promise<boolean> {
  return read($, isFilesOpen)
}

export async function writeFilesOpen($: EngineInterface, isOpen: boolean): Promise<void> {
  await update($, isFilesOpen, () => isOpen)
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

/** 오늘 통계를 고친다. 날짜가 바뀌었으면 0부터 다시 센다. */
export async function bumpToday($: EngineInterface, change: (t: Today) => Today): Promise<void> {
  const day = todayKey(await $.clock.now())
  let saved = EMPTY_TODAY

  await update($, today, t => {
    saved = change(t.date === day ? t : { ...EMPTY_TODAY, date: day })

    return saved
  })
  await $.store.set('today', saved)
}

export function countPrompt($: EngineInterface): Promise<void> {
  return bumpToday($, t => ({ ...t, prompts: t.prompts + 1 }))
}

export function countAction($: EngineInterface): Promise<void> {
  return bumpToday($, t => ({ ...t, actions: t.actions + 1 }))
}

/** Claude가 이 채팅에서 고치거나 쓴 파일을 기록한다. */
export async function trackFile($: EngineInterface, path: string): Promise<void> {
  await update($, chatFiles, list => (list.includes(path) ? list : [...list, path].slice(-50)))
  await bumpToday($, t => ({ ...t, files: t.files.includes(path) ? t.files : [...t.files, path].slice(-500) }))
}
