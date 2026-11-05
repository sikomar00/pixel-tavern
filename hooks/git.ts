import type { EngineInterface } from 'claude-code'

import type { GitInfo } from '../types'

type Status = Pick<GitInfo, 'branch' | 'changed' | 'ahead' | 'behind'>

/** `git status --porcelain=v1 -b` 출력: 첫 줄이 브랜치, 나머지 한 줄이 변경 한 건. */
export const parseStatus = (out: string): Status => {
  const [head = '', ...rest] = out.split('\n').filter(Boolean)
  const match = /^## (.+?)(?:\.\.\.\S+)?(?: \[(.*)\])?$/.exec(head)
  const track = match?.[2] ?? ''

  return {
    branch: (match?.[1] ?? '?').replace(/^No commits yet on /, ''),
    ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
    changed: rest.length,
  }
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
const SAFE_GIT = ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false']

/** git 저장소가 아니거나 git이 없으면 null. 둘 다 정상적인 상태라 오류로 다루지 않는다. */
export async function readGit($: EngineInterface): Promise<GitInfo | null> {
  const status = await $.process.run([...SAFE_GIT, 'status', '--porcelain=v1', '-b']).catch(() => null)

  if (status === null || status.exitCode !== 0) return null
  const log = await $.process.run([...SAFE_GIT, 'log', '-3', '--pretty=format:%h%x09%s'])

  return { ...parseStatus(status.stdout), commits: log.exitCode === 0 ? parseLog(log.stdout) : [] }
}
