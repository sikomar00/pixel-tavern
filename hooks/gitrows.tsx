import type { ChangeKind, GitFile } from '../types'
import type { Actions } from './actions'
import { shortPath } from './format'
import { chip, isFolded } from './layout'
import type { PanelData } from './panel'
import { clip, WARN_COLOR } from './svg'
import { SPACE } from './theme'
import type { Ui } from './theme'

const CHANGES_SHOWN = 8 // 바뀐 파일 목록에서 보여 주는 최대 줄 수(나머지는 "…외 N개")

// 종류마다 기호 하나: 색을 못 보는 사람도 구분하도록 기호가 뜻을 담는다(뜻은 도움말 "?"에도 있다).
const GLYPH: Record<ChangeKind, string> = { new: '+', modified: '~', deleted: '-', renamed: '>', conflict: '!' }
const NAME: Record<ChangeKind, string> = { new: '새', modified: '수정', deleted: '삭제', renamed: '이동', conflict: '충돌' }
const ORDER: ChangeKind[] = ['conflict', 'new', 'modified', 'deleted', 'renamed']

/** 목록에 보이는 이름: 마지막 두 칸만. 폴더(끝이 /)는 /를 남겨 파일과 구분한다. */
const nameOf = (path: string): string => clip(`${shortPath(path)}${path.endsWith('/') ? '/' : ''}`, 40)

const countsOf = (files: GitFile[]): string =>
  ORDER.map(kind => ({ kind, n: files.filter(file => file.kind === kind).length }))
    .filter(({ n }) => n > 0)
    .map(({ kind, n }) => `${NAME[kind]} ${n}`)
    .join(' · ')

/** 바뀐 파일: "▸ 바뀐 파일 N개" 한 줄(눌러서 펴고 접는다). 펴면 종류별 개수와 파일 줄이 나온다. 충돌·삭제는 경고색. */
const changeRows = (ui: Ui, d: PanelData, act: Actions, files: GitFile[]) => {
  const { Button, Text } = ui
  const isOpen = !isFolded(d, 'changes')
  const rest = files.length - CHANGES_SHOWN

  return [
    <Button key="fold:changes" plain label={`${isOpen ? '▾' : '▸'} 바뀐 파일 ${files.length}개`} onPress={() => act.toggleSection('changes')} />,
    ...(isOpen
      ? [
          <Text color={d.scene.muted} size="caption">
            {countsOf(files)}
          </Text>,
          ...files.slice(0, CHANGES_SHOWN).map(file => (
            <Text color={file.kind === 'deleted' || file.kind === 'conflict' ? WARN_COLOR : d.scene.muted} size="caption" mono>
              {GLYPH[file.kind]} {nameOf(file.path)}
            </Text>
          )),
          ...(rest > 0
            ? [
                <Text color={d.scene.muted} size="caption">
                  …외 {rest}개
                </Text>,
              ]
            : []),
        ]
      : []),
  ]
}

/** git 저장소가 아니면 오류가 아니라 정보로 보여 준다. 최근 커밋 로그는 따로 접는다(기본은 접힘). */
export const gitRows = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const { git, scene } = d

  if (git === null) {
    return [
      <Text color={scene.muted} size="footnote">
        ○ Git 저장소가 아니에요
      </Text>,
    ]
  }
  const sync = [git.ahead > 0 ? `올릴 커밋 ${git.ahead}` : '', git.behind > 0 ? `받을 커밋 ${git.behind}` : '']
  const hint = sync.filter(Boolean).join(' · ')
  const isLogFolded = isFolded(d, 'commits')

  return [
    <Box flexDirection="row" gap={SPACE.control} flexWrap="wrap">
      {chip(ui, d, <Text weight="semibold">{git.branch}</Text>)}
      {chip(
        ui,
        d,
        // 강조색은 글자가 아니라 점에만 쓴다: 칩 배경 위에서 강조색 글자는 대비가 모자라다.
        <Box flexDirection="row" gap={SPACE.line}>
          <Text color={git.changed > 0 ? scene.accent : scene.muted}>●</Text>
          <Text>{git.changed > 0 ? `변경 ${git.changed}개` : '변경 없음'}</Text>
        </Box>,
      )}
    </Box>,
    ...(hint === ''
      ? []
      : [
          <Text color={scene.muted} size="footnote">
            {hint}
          </Text>,
        ]),
    ...(git.files.length === 0 ? [] : changeRows(ui, d, act, git.files)),
    ...(git.commits.length === 0
      ? []
      : [
          <Button
            key="fold:commits"
            plain
            label={`${isLogFolded ? '▸' : '▾'} 최근 커밋 ${git.commits.length}개`}
            onPress={() => act.toggleSection('commits')}
          />,
        ]),
    ...(isLogFolded
      ? []
      : git.commits.map(c => (
          <Text color={scene.muted} size="caption" mono>
            {c.hash} {clip(c.subject, 38)}
          </Text>
        ))),
  ]
}
