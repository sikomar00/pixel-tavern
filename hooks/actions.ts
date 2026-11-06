import type { EngineInterface, Timer } from 'claude-code'

import type { Mood, QuickKey, RadioState, SceneId } from '../types'
import { startRadio, stopRadio } from './radio'
import { MODES, SCENES } from './scenes'
import { chooseStation, readStation, showStationTab, toggleFavorite } from './stations'
import { TODOS_MAX, addTodo, clearDoneTodos, starTodo, toggleTodo } from './todos'
import {
  currentSceneId,
  readArmed,
  readCollapsed,
  readFilesOpen,
  readGitInfo,
  readMood,
  readOpenHelp,
  toggleDiag,
  togglePicker,
  toggleStill,
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
import { clearWork, settleWaiting, startWaiting } from './work'

export const PANE_ID = 'tavern'
export const PANE_TITLE = '여관'

type QuickItem = {
  key: QuickKey
  label: string
  command: string
  /** 있으면 두 번 눌러야 실행된다(파일을 바꾸는 명령). notice: 대기 중 안내, empty: 바뀐 파일이 없을 때의 알림. */
  confirm?: { notice: string; empty: string }
}

export const QUICK: QuickItem[] = [
  { key: 'review', label: '코드 리뷰', command: 'code-review' },
  {
    key: 'commit',
    label: '변경 커밋',
    command: 'commit-commands:commit',
    confirm: { notice: '5초 안에 한 번 더 누르면 변경을 커밋해요', empty: '커밋할 변경이 없어요' },
  },
  {
    key: 'simplify',
    label: '코드 정리',
    command: 'simplify',
    confirm: { notice: '5초 안에 한 번 더 누르면 코드를 고쳐요', empty: '정리할 변경이 없어요' },
  },
]

const ARM_MS = 5000 // 확인이 필요한 버튼(커밋·정리)을 한 번 누른 뒤 다시 누를 수 있는 시간

export type Actions = {
  openPanel: () => Promise<void>
  shuffle: () => Promise<void>
  moveScene: (delta: number) => Promise<void>
  setHidden: (hidden: boolean) => Promise<void>
  quick: (key: QuickKey) => Promise<void>
  mentionFile: (path: string) => Promise<void>
  toggleRadio: () => Promise<void>
  setVolume: (level: number) => Promise<void>
  setStation: (id: string) => Promise<void>
  showGroup: (tab: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  toggleHelp: (id: string) => Promise<void>
  toggleDiag: () => Promise<boolean>
  toggleStill: () => Promise<boolean>
  toggleSection: (id: string) => Promise<void>
  toggleFiles: () => Promise<void>
  togglePicker: () => Promise<void>
  addTodo: (text: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  starTodo: (id: string) => Promise<void>
  clearDoneTodos: () => Promise<void>
}

// 터미널이 붙어 있으면 패널의 알맞은 크기를 요청한다(옆에 붙을 때의 폭, 프롬프트 위에 놓일 때의 줄 수). 요청일 뿐이고, 데스크톱에는 보내지 않는다.
const TERMINAL_COLUMNS = 56
const TERMINAL_ROWS = 30

async function openPane($: EngineInterface): Promise<void> {
  const isTerminal = (await $.session.surfaces()).includes('terminal')

  await $.ui.open({ id: PANE_ID, title: PANE_TITLE, ...(isTerminal ? { rows: TERMINAL_ROWS, columns: TERMINAL_COLUMNS } : {}) })
}

/** 방송이 켜지는 중이거나 나오는 중인가(꺼짐·실패는 아니다). */
const isRunning = (state: RadioState): boolean => state === 'connecting' || state === 'playing'

/** git 저장소가 아니면(null) 막지 않는다: 커밋·정리 명령이 스스로 이유를 알려 준다. */
async function hasChanges($: EngineInterface): Promise<boolean> {
  await refreshGit($) // 저장된 값은 낡았을 수 있어 누른 순간 다시 읽는다
  const info = await readGitInfo($)

  return info === null || info.changed > 0
}

// 확인이 필요한 버튼(커밋·정리): 눌림 하나를 처리하는 동안 들어온 누름은 무시하고(더블클릭이 두 번 실행되는 것을 막는다),
// 새로 대기시킬 때는 옛 타이머를 끊는다(옛 타이머가 새 대기를 일찍 끝내지 못하게). 한 번에 한 버튼만 대기한다.
let isPressBusy = false
let armTimer: Timer | null = null

/** 확인이 필요한 버튼 한 번의 누름을 처리한다. 지금 실행해야 하면 true. */
async function pressConfirmed($: EngineInterface, key: QuickKey, emptyMessage: string): Promise<boolean> {
  if (!(await hasChanges($))) {
    $.ui.toast(emptyMessage)

    return false
  }
  armTimer?.cancel()
  armTimer = null
  if ((await readArmed($)) === key) {
    await writeArmed($, null)

    return true
  }
  await writeArmed($, key) // 다른 버튼이 대기 중이었다면 그 대기는 여기서 풀린다
  armTimer = $.clock.after(ARM_MS, () => void writeArmed($, null))

  return false
}

/** 기분을 저장하고, 음악이 켜져 있으면 새 장면의 방송으로 바꾼다. 방송 고르기는 새 장면의 방송이 속한 묶음으로 돌아간다. */
async function saveMood($: EngineInterface, next: Mood): Promise<void> {
  const before = currentSceneId(await readMood($))

  await writeMood($, next)
  await showStationTab($, '')

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

  // 장면을 모드와 상관없이 차례로 넘긴다(끝에서 처음으로 이어진다). 배너의 ⟳와 패널의 ◀ ▶가 같은 순서를 쓴다.
  const moveScene = async (delta: number): Promise<void> => {
    const ids = MODES.flatMap(entry => entry.scenes)
    const next = ids[(ids.indexOf(currentSceneId(await readMood($))) + delta + ids.length) % ids.length]

    if (next !== undefined) await setScene(next)
  }

  // 누른 순간부터 진행 상태를 보인다. 명령은 세션이 한가할 때 실행되고, 모델 작업이 시작·끝나는 것은 register의 turn 훅이 알려 준다.
  const run = async (command: string, key: QuickKey): Promise<void> => {
    const seq = await startWaiting($, key)

    try {
      await $.command.run({ command })
      await settleWaiting($, seq)
    } catch (error) {
      await clearWork($, seq)
      $.ui.toast(`/${command} 를 실행하지 못했어요: ${String(error)}`)
    }
  }

  return {
    shuffle: () => moveScene(1),
    moveScene,
    setHidden: hidden => writeHidden($, hidden),
    // "?"를 누르면 그 설명이 패널 안에서 펼쳐지고, 다시 누르면 접힌다(하나만 열린다).
    toggleHelp: async id => writeOpenHelp($, (await readOpenHelp($)) === id ? '' : id),
    toggleDiag: () => toggleDiag($),
    toggleStill: () => toggleStill($),
    toggleSection: async id => {
      const ids = await readCollapsed($)

      await writeCollapsed($, ids.includes(id) ? ids.filter(entry => entry !== id) : [...ids, id])
    },
    toggleFiles: async () => writeFilesOpen($, !(await readFilesOpen($))),
    togglePicker: () => togglePicker($),
    // 음량은 재생기를 켤 때 정해지므로, 켜져 있으면 새 음량으로 다시 켠다.
    setVolume: async level => {
      if (!isVolume(level)) return
      await writeVolume($, level)
      if (isRunning(await readRadio($))) await startRadio($, currentSceneId(await readMood($)))
    },
    // 이 장면의 방송을 바꾼다. 같은 방송이면 아무것도 하지 않고, 켜져 있으면 새 방송으로 다시 켠다(꺼져 있으면 켜지 않는다).
    // 옛 방송의 연결 실패·가로채임 표시는 방송을 바꾸면 지운다(장면을 바꿀 때와 같다).
    setStation: async id => {
      const sceneId = currentSceneId(await readMood($))

      if ((await readStation($, sceneId)).id === id) return
      await chooseStation($, sceneId, id)
      const radio = await readRadio($)

      if (isRunning(radio)) await startRadio($, sceneId)
      else if (radio === 'failed' || radio === 'other') await writeRadio($, 'off')
    },
    toggleFavorite: id => toggleFavorite($, id),
    addTodo: async text => {
      if ((await addTodo($, text)) === 'full') $.ui.toast(`할 일은 ${TODOS_MAX}개까지예요. 완료한 것을 지워 주세요`)
    },
    toggleTodo: id => toggleTodo($, id),
    starTodo: id => starTodo($, id),
    clearDoneTodos: () => clearDoneTodos($),
    showGroup: tab => showStationTab($, tab),
    // 켜져 있으면 끄고, 꺼져 있거나 실패한 뒤라면 켠다(다시 시도).
    toggleRadio: async () =>
      isRunning(await readRadio($)) ? stopRadio($) : startRadio($, currentSceneId(await readMood($))),
    // 데스크톱은 file: 링크를 열어 주지 않는다. 프롬프트 칸에 @경로를 넣고, 칸이 없으면 경로를 알려 준다.
    mentionFile: async path => {
      const filled = await $.prompt.fill({ text: `@${path} `, mode: 'append' })

      if (!filled.isFilled) $.ui.toast(`파일 경로: ${path}`)
    },
    openPanel: () => openPane($),
    quick: async key => {
      const item = QUICK.find(entry => entry.key === key)

      if (item === undefined) return
      if (item.confirm === undefined) return run(item.command, key)
      if (isPressBusy) return
      isPressBusy = true
      let shouldRun = false

      try {
        shouldRun = await pressConfirmed($, key, item.confirm.empty)
      } finally {
        isPressBusy = false
      }
      if (shouldRun) await run(item.command, key)
    },
  }
}
