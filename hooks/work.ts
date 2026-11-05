import { atom, read, update } from 'claude-code'
import type { EngineInterface, Timer } from 'claude-code'

import type { QuickKey, TurnEnd, Work } from '../types'

// 빠른 실행 버튼의 진행 상태. 버튼을 누르면 명령은 세션이 한가할 때 실행되고, 모델 작업이 시작·끝나는 것은 turn 훅이 알려 준다.
// 호출이 끝났다는 것이 작업이 끝났다는 뜻은 아니라서(프롬프트를 보내는 명령은 호출 뒤에 작업이 돈다) 턴 이벤트를 따라간다.
const IDLE: Work = { phase: 'idle' }
const work = atom({ plugin: 'pixel-tavern', key: 'work' } as const, IDLE)

const GRACE_MS = 15_000 // 명령 호출이 끝났는데도 모델 작업이 시작되지 않으면(글자만 내놓는 명령 등) 기다림을 접는다
const SHOW_END_MS = 60_000 // 끝난 표시를 남겨 두는 시간

// 접는 타이머는 하나뿐이다: 상태가 바뀔 때마다 끊어서, 옛 타이머가 새 상태를 지우지 못하게 한다.
let timer: Timer | null = null
// 눌림 번호: 세션이 바빠 줄 서 있던 옛 눌림의 호출이 끝나거나 실패해도, 그 뒤에 누른 버튼의 기다림 표시는 건드리지 않는다.
let pressSeq = 0

export function readWork($: EngineInterface): Promise<Work> {
  return read($, work)
}

async function setWork($: EngineInterface, next: Work, expireMs?: number): Promise<void> {
  timer?.cancel()
  timer = null
  await update($, work, () => next)
  if (expireMs !== undefined) timer = $.clock.after(expireMs, () => void update($, work, () => IDLE))
}

/** 버튼을 눌렀다: 명령이 줄을 서고, 모델 작업이 시작되기를 기다린다. 이 눌림의 번호를 돌려준다. */
export async function startWaiting($: EngineInterface, key: QuickKey): Promise<number> {
  pressSeq += 1
  await setWork($, { phase: 'waiting', key })

  return pressSeq
}

/** 그 눌림의 명령 호출이 끝났다. 그 뒤에도 모델 작업이 시작되지 않으면 기다림을 접는다(더 새 눌림이 있으면 건드리지 않는다). */
export async function settleWaiting($: EngineInterface, seq: number): Promise<void> {
  if (seq !== pressSeq || (await read($, work)).phase !== 'waiting') return
  timer?.cancel()
  timer = $.clock.after(GRACE_MS, () => void update($, work, () => IDLE))
}

/** 그 눌림의 명령을 실행하지 못했다: 진행 표시를 지운다(알림은 호출한 쪽이 한다). 더 새 눌림이 있으면 건드리지 않는다. */
export async function clearWork($: EngineInterface, seq: number): Promise<void> {
  if (seq === pressSeq) await setWork($, IDLE)
}

/** 메인 대화의 턴이 시작됐다. 기다리는 중이었다면 이 턴이 눌린 버튼의 작업이다. */
export async function beginTurn($: EngineInterface, turnId: string): Promise<void> {
  const current = await read($, work)

  if (current.phase === 'waiting') await setWork($, { phase: 'running', key: current.key, turnId })
}

/** 메인 대화의 턴이 끝났다. 따라가던 턴일 때만 끝남으로 바꾼다(그 전에 시작한 턴의 끝은 무시). */
export async function endTurn($: EngineInterface, end: { turnId: string; reason: TurnEnd; durationMs: number }): Promise<void> {
  const current = await read($, work)

  if (current.phase !== 'running' || current.turnId !== end.turnId) return
  await setWork($, { phase: 'ended', key: current.key, reason: end.reason, seconds: Math.max(1, Math.round(end.durationMs / 1000)) }, SHOW_END_MS)
}
