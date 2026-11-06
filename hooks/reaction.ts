import type { EngineInterface, Timer } from 'claude-code'

import type { Reaction, TurnEnd } from '../types'
import { writeReaction } from './state'

// 작업 끝·테스트 결과 반응: 배너 문구가 잠깐(4초) 바뀌고, 효과가 켜져 있으면 그림이 3초 동안 밝아졌다 돌아온다(effects.ts의 flashSvg).
// 테스트 결과를 알려 주는 엔진 호출이 없어서 추정한다: 터미널 명령(Bash·PowerShell)에 테스트 도구 이름이 있으면 테스트로 보고,
// 도구 호출이 오류로 끝났으면(`isError`) 실패, 아니면 통과로 본다. 명령의 글이나 출력은 읽지도 저장하지도 않는다(성공/실패만 잠깐 보인다).
const SHOW_MS = 4_000

// 기다리는 타이머는 하나뿐이다: 새 반응이 오면 끊고 다시 센다(옛 타이머가 새 반응을 일찍 지우지 못하게).
let timer: Timer | null = null

// 명령 한 조각(`&&`·`||`·`;`·`|`로 나눈 것)의 맨 앞만 본다: `npm install vitest`·`git commit -m "jest"`·`cat jest.config.js`처럼 이름만 들어 있는 명령은 테스트가 아니다.
const TOOL = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpx|uvx|pnpm\s+exec|pnpm\s+dlx|uv\s+run|poetry\s+run|python3?\s+-m|py\s+-m|yarn)\s+)*(?:[\w.\\/-]*[\\/])?(?:pytest|vitest|jest|mocha|rspec|phpunit|tsc|typecheck|unittest)\b/
const MANAGER = /^(?:\w+=\S*\s+)*(?:npm|pnpm|yarn|bun|cargo|go|dotnet|mvn|gradle|deno)\s+(?:\S+\s+){0,3}?(?:test|typecheck)(?:[\s:]|$)/
const PLUGIN = /^(?:\w+=\S*\s+)*claude\s+plugin\s+test\b/

/** 테스트로 볼 명령: 테스트 도구(pytest·vitest·jest·mocha·rspec·phpunit·tsc·typecheck·unittest, `npx`·`uv run`·`python -m` 뒤 포함), `<패키지 관리자> … test`, `claude plugin test`. */
export const isTestCommand = (command: string): boolean =>
  command.split(/&&|\|\||[;|\n]/).some(part => {
    const own = part.trim()

    return TOOL.test(own) || MANAGER.test(own) || PLUGIN.test(own)
  })

/** 턴이 끝난 이유에 맞는 반응: 정상은 작업 끝, 사용자가 멈췄으면 중단, 오류·거절은 실패. */
export const reactionOfTurn = (reason: TurnEnd): Exclude<Reaction, ''> => (reason === 'answer' ? 'done' : reason === 'aborted' ? 'stopped' : 'failed')

/** 반응을 4초 동안 보인다. */
export async function flashReaction($: EngineInterface, reaction: Exclude<Reaction, ''>): Promise<void> {
  timer?.cancel()
  await writeReaction($, reaction)
  timer = $.clock.after(SHOW_MS, () => void writeReaction($, ''))
}

/** 터미널 명령 도구 호출이 끝났다: 테스트 명령이었으면 통과·실패 반응을 보인다(거부된 호출은 실행되지 않았으니 무시). */
export async function noteTestRun($: EngineInterface, ran: { deny?: unknown; isError?: boolean }, command: unknown): Promise<void> {
  if (ran.deny !== undefined || typeof command !== 'string' || !isTestCommand(command)) return
  await flashReaction($, ran.isError === true ? 'testFail' : 'testPass')
}
