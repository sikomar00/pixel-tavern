import type { EngineInterface, Timer } from 'claude-code'

import type { Mood, RadioState, SceneId } from '../types'
import { startRadio, stopRadio } from './radio'
import { MODES, SCENES } from './scenes'
import {
  currentSceneId,
  readArmed,
  readCollapsed,
  readFilesOpen,
  readGitInfo,
  readMood,
  readOpenHelp,
  toggleDiag,
  refreshGit,
  readRadio,
  writeArmed,
  writeCollapsed,
  writeFilesOpen,
  writeHidden,
  writeMood,
  writeOpenHelp,
  writeRadio,
  writeVolume,
} from './state'
import { isVolume } from './volume'

export const PANE_ID = 'tavern'
export const PANE_TITLE = '여관'

export type QuickKey = 'review' | 'commit' | 'simplify'

export const QUICK: { key: QuickKey; label: string; command: string }[] = [
  { key: 'review', label: '코드 리뷰', command: 'code-review' },
  { key: 'commit', label: '변경 커밋', command: 'commit-commands:commit' },
  { key: 'simplify', label: '코드 정리', command: 'simplify' },
]

const ARM_MS = 5000 // 커밋 버튼을 한 번 누른 뒤 다시 누를 수 있는 시간

export type Actions = {
  openPanel: () => Promise<void>
  shuffle: () => Promise<void>
  setHidden: (hidden: boolean) => Promise<void>
  setScene: (id: SceneId) => Promise<void>
  quick: (key: QuickKey) => Promise<void>
  mentionFile: (path: string) => Promise<void>
  toggleRadio: () => Promise<void>
  setVolume: (level: number) => Promise<void>
  toggleHelp: (id: string) => Promise<void>
  toggleDiag: () => Promise<boolean>
  toggleSection: (id: string) => Promise<void>
  toggleFiles: () => Promise<void>
}

async function openPane($: EngineInterface, base: string): Promise<void> {
  await $.ui.open({ id: PANE_ID, title: PANE_TITLE, backgroundColor: base })
}

/** 방송이 켜지는 중이거나 나오는 중인가(꺼짐·실패는 아니다). */
const isRunning = (state: RadioState): boolean => state === 'connecting' || state === 'playing'

/** git 저장소가 아니면(null) 막지 않는다: 커밋 명령이 스스로 이유를 알려 준다. */
async function hasChanges($: EngineInterface): Promise<boolean> {
  await refreshGit($) // 저장된 값은 낡았을 수 있어 누른 순간 다시 읽는다
  const info = await readGitInfo($)

  return info === null || info.changed > 0
}

// 커밋 버튼: 눌림 하나를 처리하는 동안 들어온 누름은 무시하고(더블클릭이 두 번 실행되는 것을 막는다),
// 새로 대기시킬 때는 옛 타이머를 끊는다(옛 타이머가 새 대기를 일찍 끝내지 못하게).
let isCommitBusy = false
let armTimer: Timer | null = null

/** 커밋 버튼 한 번의 누름을 처리한다. 지금 실행해야 하면 true. */
async function pressCommit($: EngineInterface): Promise<boolean> {
  if (!(await hasChanges($))) {
    $.ui.toast('커밋할 변경이 없어요')

    return false
  }
  armTimer?.cancel()
  armTimer = null
  if (await readArmed($)) {
    await writeArmed($, false)

    return true
  }
  await writeArmed($, true)
  armTimer = $.clock.after(ARM_MS, () => void writeArmed($, false))

  return false
}

/** 기분을 저장하고, 이미 열린 패널이면 바깥 배경색도 새 장면 색으로 바꾼다. */
async function saveMood($: EngineInterface, next: Mood): Promise<void> {
  const before = currentSceneId(await readMood($))

  await writeMood($, next)

  if ((await $.ui.panes()).some(pane => pane.id === PANE_ID)) {
    await openPane($, SCENES[currentSceneId(next)].base)
  }
  // 음악이 켜져 있으면 새 장면의 방송으로 바꾼다.
  if (currentSceneId(next) === before) return
  const radio = await readRadio($)

  if (isRunning(radio)) await startRadio($, currentSceneId(next))
  else if (radio === 'failed' || radio === 'other') await writeRadio($, 'off') // 옛 방송의 실패·가로채임 표시는 장면을 바꾸면 지운다
}

export function makeActions($: EngineInterface): Actions {
  const setScene = async (id: SceneId): Promise<void> => {
    const { mode } = SCENES[id]
    const m = await readMood($)

    await saveMood($, { mode, sceneByMode: { ...m.sceneByMode, [mode]: id } })
  }

  const run = async (command: string): Promise<void> => {
    try {
      await $.command.run({ command })
    } catch (error) {
      $.ui.toast(`/${command} 를 실행하지 못했어요: ${String(error)}`)
    }
  }

  return {
    setScene,
    shuffle: async () => {
      const m = await readMood($)
      const ids = MODES.flatMap(entry => entry.scenes) // 4개 장면을 모드와 상관없이 차례로
      const next = ids[(ids.indexOf(currentSceneId(m)) + 1) % ids.length]

      if (next !== undefined) await setScene(next)
    },
    setHidden: hidden => writeHidden($, hidden),
    // "?"를 누르면 그 설명이 패널 안에서 펼쳐지고, 다시 누르면 접힌다(하나만 열린다).
    toggleHelp: async id => writeOpenHelp($, (await readOpenHelp($)) === id ? '' : id),
    toggleDiag: () => toggleDiag($),
    toggleSection: async id => {
      const ids = await readCollapsed($)

      await writeCollapsed($, ids.includes(id) ? ids.filter(entry => entry !== id) : [...ids, id])
    },
    toggleFiles: async () => writeFilesOpen($, !(await readFilesOpen($))),
    // 음량은 재생기를 켤 때 정해지므로, 켜져 있으면 새 음량으로 다시 켠다.
    setVolume: async level => {
      if (!isVolume(level)) return
      await writeVolume($, level)
      if (isRunning(await readRadio($))) await startRadio($, currentSceneId(await readMood($)))
    },
    // 켜져 있으면 끄고, 꺼져 있거나 실패한 뒤라면 켠다(다시 시도).
    toggleRadio: async () =>
      isRunning(await readRadio($)) ? stopRadio($) : startRadio($, currentSceneId(await readMood($))),
    // 데스크톱은 file: 링크를 열어 주지 않는다. 프롬프트 칸에 @경로를 넣고, 칸이 없으면 경로를 알려 준다.
    mentionFile: async path => {
      const filled = await $.prompt.fill({ text: `@${path} `, mode: 'append' })

      if (!filled.isFilled) $.ui.toast(`파일 경로: ${path}`)
    },
    openPanel: async () => openPane($, SCENES[currentSceneId(await readMood($))].base),
    quick: async key => {
      const item = QUICK.find(entry => entry.key === key)

      if (item === undefined) return
      if (key !== 'commit') return run(item.command)
      if (isCommitBusy) return
      isCommitBusy = true
      let shouldRun = false

      try {
        shouldRun = await pressCommit($)
      } finally {
        isCommitBusy = false
      }
      if (shouldRun) await run(item.command)
    },
  }
}
