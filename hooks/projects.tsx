import type { ProjectToday } from '../types'
import type { Actions } from './actions'
import { isFolded } from './layout'
import type { PanelData } from './panel'
import { SPACE } from './theme'
import type { Ui } from './theme'

const NO_NAME = '이전 기록' // 프로젝트 이름이 없는 칸(이름을 남기기 전의 기록)

const rowOf = (ui: Ui, d: PanelData, entry: ProjectToday) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" gap={SPACE.line}>
      <Text weight="semibold" wrap="truncate-end">
        {entry.project === '' ? NO_NAME : entry.project}
      </Text>
      <Text color={d.scene.muted} size="caption">
        {`프롬프트 ${entry.prompts} · 도구 ${entry.actions} · 파일 ${entry.files.length}`}
      </Text>
    </Box>
  )
}

/**
 * 프로젝트별 오늘: "▸ 프로젝트별 오늘 N개" 한 줄(눌러서 펴고 접는다, 기본은 접힘). 오늘 두 프로젝트 이상에서 일했을 때만 나온다:
 * 하나뿐이면 위의 숫자 세 칸이 곧 그 프로젝트라서 같은 숫자를 두 번 보이지 않는다. 많이 한 프로젝트가 위.
 */
export const projectRows = (ui: Ui, d: PanelData, act: Actions) => {
  const { Button } = ui

  if (d.projects.length < 2) return []
  const isOpen = !isFolded(d, 'projects')

  return [
    <Button key="fold:projects" plain label={`${isOpen ? '▾' : '▸'} 프로젝트별 오늘 ${d.projects.length}개`} onPress={() => act.toggleSection('projects')} />,
    ...(isOpen ? d.projects.map(entry => rowOf(ui, d, entry)) : []),
  ]
}
