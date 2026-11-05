import type { EngineInterface } from 'claude-code'

import type { ChangeKind, GitFile, GitInfo } from '../types'
import { withoutControl } from './format'

type Status = Pick<GitInfo, 'branch' | 'changed' | 'ahead' | 'behind'>

const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/** `XY` 두 글자(index, 작업 폴더)를 사람이 읽는 종류 하나로 줄인다. */
const kindOf = (xy: string): ChangeKind => {
  if (xy === '??') return 'new'
  if (CONFLICTS.has(xy)) return 'conflict'
  if (/[RC]/.test(xy)) return 'renamed'
  if (xy.includes('D')) return 'deleted'
  if (xy.includes('A')) return 'new'

  return 'modified'
}

type Change = { xy: string; path: string }

/**
 * `git status --porcelain=v1 -z -b` 출력을 머리글(브랜치 칸)과 변경 항목들로 나눈다.
 * -z 는 항목을 줄바꿈 대신 NUL(\0)로 끝맺고 이름을 따옴표·이스케이프 없이 그대로 준다: 줄바꿈·탭·따옴표·" -> "가 든 이름도 안전하다.
 * 이름을 바꾼·복사한 항목은 "XY 새 경로" 다음 칸에 옛 경로가 따로 온다(" -> "로 잇지 않는다). 옛 경로 칸은 항목이 아니라서 건너뛴다.
 */
const split = (out: string): { head: string; changes: Change[] } => {
  const [head = '', ...fields] = out.split('\0')
  const changes: Change[] = []

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i] ?? ''
    const xy = field.slice(0, 2)

    if (field.length > 3) changes.push({ xy, path: field.slice(3) })
    if (field !== '' && kindOf(xy) === 'renamed') i += 1 // 옛 경로 칸
  }

  return { head, changes }
}

export const parseStatus = (out: string): Status => {
  const { head, changes } = split(out)
  const match = /^## (.+?)(?:\.\.\.\S+)?(?: \[(.*)\])?$/.exec(head)
  const track = match?.[2] ?? ''

  return {
    branch: (match?.[1] ?? '?').replace(/^No commits yet on /, ''),
    ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
    changed: changes.length,
  }
}

/** 변경 항목을 파일 목록으로. 이름을 바꾼 항목은 새 경로, 제어 문자는 뺀다. 충돌이 먼저, 나머지는 git이 준 순서. */
export const parseFiles = (out: string): GitFile[] => {
  const files = split(out)
    .changes.map(({ xy, path }) => ({ path: withoutControl(path), kind: kindOf(xy) }))
    .filter(file => file.path !== '')

  return [...files.filter(file => file.kind === 'conflict'), ...files.filter(file => file.kind !== 'conflict')]
}

export const parseLog = (out: string): GitInfo['commits'] =>
  out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash = '', ...subject] = line.split('\t')

      return { hash, subject: subject.join('\t') }
    })

// 백그라운드에서 자주 읽는 명령이라 두 가지를 막는다: --no-optional-locks(status가 index를 갱신하며 잠그면 사용자의 commit·add가 "index.lock" 오류로 실패한다),
// core.fsmonitor=false(저장소 설정에 적힌 fsmonitor 명령이 status를 부를 때마다 실행되는 것). 아주 큰 저장소에서는 status가 조금 느려질 수 있다.
const READ_GIT = ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false']

/** git 저장소가 아니거나 git이 없으면 null. 둘 다 정상적인 상태라 오류로 다루지 않는다. */
export async function readGit($: EngineInterface): Promise<GitInfo | null> {
  const status = await $.process.run([...READ_GIT, 'status', '--porcelain=v1', '-z', '-b']).catch(() => null)

  if (status === null || status.exitCode !== 0) return null
  const log = await $.process.run([...READ_GIT, 'log', '-3', '--pretty=format:%h%x09%s'])
  // 출력이 한도(4MiB)에서 잘렸으면 마지막 NUL 뒤의 조각난 항목은 버린다(이상한 파일 줄이 되지 않게).
  const cut = status.stdout.lastIndexOf('\0')
  const out = status.isStdoutTruncated ? (cut >= 0 ? status.stdout.slice(0, cut) : '') : status.stdout

  return { ...parseStatus(out), commits: log.exitCode === 0 ? parseLog(log.stdout) : [], files: parseFiles(out) }
}
